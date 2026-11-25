package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// GET /api/clauses/{id}
// Returns the current text and version of a clause, so the UI never has to hard-code it.
func (a *App) GetClause(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid clause id", http.StatusBadRequest)
		return
	}
	var c ClauseDTO
	err = a.DB.QueryRow(r.Context(), `
		SELECT rc.id, reg.code, reg.name, rc.clause_number, rc.title, rc.content,
		       rc.version, rc.status, COALESCE(rc.updated_at, NOW())
		FROM regulation_clauses rc
		JOIN regulations reg ON reg.id = rc.regulation_id
		WHERE rc.id = $1`, id).
		Scan(&c.ID, &c.RegulationCode, &c.RegulationName, &c.ClauseNumber, &c.Title,
			&c.Content, &c.Version, &c.Status, &c.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "clause not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// GET /api/clauses/{id}/history
// Every amendment to the clause, newest first, with previous and new text and task progress.
func (a *App) GetClauseHistory(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid clause id", http.StatusBadRequest)
		return
	}
	rows, err := a.DB.Query(r.Context(), `
		SELECT ch.id, ch.change_summary, ch.previous_content, ch.new_content,
		       COALESCE(ch.detected_at, NOW()),
		       COUNT(rt.id),
		       COUNT(rt.id) FILTER (WHERE rt.status = 'CLOSED')
		FROM regulatory_changes ch
		LEFT JOIN remediation_tasks rt ON rt.change_id = ch.id
		WHERE ch.clause_id = $1
		GROUP BY ch.id
		ORDER BY ch.detected_at DESC`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := make([]ChangeDTO, 0)
	for rows.Next() {
		var c ChangeDTO
		if err := rows.Scan(&c.ID, &c.ChangeSummary, &c.PreviousContent, &c.NewContent,
			&c.DetectedAt, &c.TasksTotal, &c.TasksClosed); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, c)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

// PATCH /api/controls/{id}/status
// Lets an analyst set a control's status by hand, for example to flag a failed test as NON_COMPLIANT.
// A control cannot be marked COMPLIANT while it still has unfinished remediation tasks.
func (a *App) UpdateControlStatus(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid control id", http.StatusBadRequest)
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	switch body.Status {
	case "COMPLIANT", "IMPACTED", "NON_COMPLIANT":
	default:
		http.Error(w, "invalid status", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err := tx.QueryRow(ctx, `SELECT TRUE FROM controls WHERE id = $1 FOR UPDATE`, id).Scan(&exists); err != nil {
		http.Error(w, "control not found", http.StatusNotFound)
		return
	}

	if body.Status == "COMPLIANT" {
		var open int
		if err := tx.QueryRow(ctx, `
			SELECT COUNT(*) FROM remediation_tasks WHERE control_id = $1 AND status <> 'CLOSED'`, id).Scan(&open); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if open > 0 {
			http.Error(w, "close the open remediation tasks before marking this control compliant", http.StatusConflict)
			return
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE controls SET compliance_status = $1, updated_at = NOW() WHERE id = $2`, body.Status, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if err := tx.Commit(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}

// GET /api/controls/{id}/evidence
// Lists the evidence attached to a control, newest first.
func (a *App) ListControlEvidence(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid control id", http.StatusBadRequest)
		return
	}
	rows, err := a.DB.Query(r.Context(), `
		SELECT id, control_id, title, file_url, sha256_hash, validity_status, COALESCE(uploaded_at, NOW())
		FROM audit_evidence
		WHERE control_id = $1
		ORDER BY uploaded_at DESC`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := make([]AuditEvidenceDTO, 0)
	for rows.Next() {
		var e AuditEvidenceDTO
		if err := rows.Scan(&e.ID, &e.ControlID, &e.Title, &e.FileURL, &e.SHA256Hash, &e.ValidityStatus, &e.UploadedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, e)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, results)
}

// PATCH /api/evidence/{id}/verify
// Re-verifies evidence that an amendment marked STALE_NEEDS_REVIEW.
func (a *App) VerifyEvidence(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid evidence id", http.StatusBadRequest)
		return
	}
	var verifiedAt time.Time
	err = a.DB.QueryRow(r.Context(), `
		UPDATE audit_evidence SET validity_status = 'VALID' WHERE id = $1 RETURNING NOW()`, id).Scan(&verifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "evidence not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"validity_status": "VALID",
		"verified_at":     verifiedAt,
	})
}
