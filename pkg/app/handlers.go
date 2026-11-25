package app

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)
type App struct {
	DB *pgxpool.Pool
}

// GET /api/clauses/{id}/impact
// Traverses Clause -> Policy -> Control -> System -> Owner
func (a *App) GetClauseImpact(w http.ResponseWriter, r *http.Request) {
	clauseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid clause id", http.StatusBadRequest)
		return
	}

	query := `
		SELECT 
			c.id, c.code, c.title, c.compliance_status,
			p.code, p.title,
			o.id, o.full_name, o.email, o.department,
			COALESCE(ARRAY_AGG(DISTINCT s.name) FILTER (WHERE s.name IS NOT NULL), '{}') AS systems,
			COUNT(DISTINCT ae.id) AS evidence_count,
			COUNT(DISTINCT ae.id) FILTER (WHERE ae.validity_status = 'STALE_NEEDS_REVIEW') AS stale_count
		FROM clause_policy_map cpm
		JOIN policies p ON p.id = cpm.policy_id
		JOIN policy_control_map pcm ON pcm.policy_id = p.id
		JOIN controls c ON c.id = pcm.control_id
		JOIN owners o ON o.id = c.owner_id
		LEFT JOIN control_system_map csm ON csm.control_id = c.id
		LEFT JOIN systems s ON s.id = csm.system_id
		LEFT JOIN audit_evidence ae ON ae.control_id = c.id
		WHERE cpm.clause_id = $1
		GROUP BY c.id, p.code, p.title, o.id
	`

	rows, err := a.DB.Query(r.Context(), query, clauseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	results := make([]ImpactedNode, 0)
	for rows.Next() {
		var node ImpactedNode
		if err := rows.Scan(
			&node.ControlID, &node.ControlCode, &node.ControlTitle, &node.ComplianceStatus,
			&node.PolicyCode, &node.PolicyTitle,
			&node.OwnerID, &node.OwnerName, &node.OwnerEmail, &node.Department,
			&node.AffectedSystems, &node.EvidenceCount, &node.StaleEvidence,
		); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		results = append(results, node)
	}

	writeJSON(w, http.StatusOK, results)
}

// POST /api/clauses/{id}/amend
// Atomically updates the clause, flags controls as IMPACTED, marks evidence STALE, and generates remediation tasks
func (a *App) AmendRegulationClause(w http.ResponseWriter, r *http.Request) {
	clauseID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid clause id", http.StatusBadRequest)
		return
	}

	var req ClauseChangeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}
	if req.DueDays <= 0 {
		req.DueDays = 14
	}

	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	// 1. Fetch old content & bump clause version
	var oldContent string
	err = tx.QueryRow(ctx, `SELECT content FROM regulation_clauses WHERE id = $1 FOR UPDATE`, clauseID).Scan(&oldContent)
	if err != nil {
		http.Error(w, "clause not found", http.StatusNotFound)
		return
	}

	_, err = tx.Exec(ctx, `
		UPDATE regulation_clauses 
		SET content = $1, version = version + 1, status = 'AMENDED', updated_at = NOW() 
		WHERE id = $2
	`, req.NewContent, clauseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Record regulatory change event
	var changeID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO regulatory_changes (clause_id, previous_content, new_content, change_summary)
		VALUES ($1, $2, $3, $4) RETURNING id
	`, clauseID, oldContent, req.NewContent, req.ChangeSummary).Scan(&changeID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// 3. Identify all downstream controls & owners
	rows, err := tx.Query(ctx, `
		SELECT DISTINCT c.id, c.owner_id
		FROM clause_policy_map cpm
		JOIN policy_control_map pcm ON pcm.policy_id = cpm.policy_id
		JOIN controls c ON c.id = pcm.control_id
		WHERE cpm.clause_id = $1
	`, clauseID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	type controlTarget struct {
		ControlID uuid.UUID
		OwnerID   uuid.UUID
	}
	var targets []controlTarget
	for rows.Next() {
		var t controlTarget
		if err := rows.Scan(&t.ControlID, &t.OwnerID); err == nil {
			targets = append(targets, t)
		}
	}
	rows.Close()

	dueDate := time.Now().AddDate(0, 0, req.DueDays).Format("2006-01-02")

	// 4. Cascade status updates and spawn remediation tasks
	for _, t := range targets {
		_, err = tx.Exec(ctx, `
			UPDATE controls SET compliance_status = 'IMPACTED', updated_at = NOW() WHERE id = $1
		`, t.ControlID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Mark existing audit evidence stale until re-verified
		_, err = tx.Exec(ctx, `
			UPDATE audit_evidence SET validity_status = 'STALE_NEEDS_REVIEW' WHERE control_id = $1
		`, t.ControlID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Create remediation task
		_, err = tx.Exec(ctx, `
			INSERT INTO remediation_tasks (change_id, control_id, assignee_id, due_date, notes)
			VALUES ($1, $2, $3, $4, $5)
		`, changeID, t.ControlID, t.OwnerID, dueDate, "Auto-generated due to regulatory amendment: "+req.ChangeSummary)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"change_id":         changeID,
		"impacted_controls": len(targets),
		"due_date":          dueDate,
	})
}

// POST /api/controls/{id}/evidence
// Attaches tamper-evident audit evidence and optionally resolves open remediation
func (a *App) AttachAuditEvidence(w http.ResponseWriter, r *http.Request) {
	controlID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid control id", http.StatusBadRequest)
		return
	}

	var body struct {
		Title             string `json:"title"`
		FileURL           string `json:"file_url"`
		RawContentForHash string `json:"raw_content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(body.Title) == "" || strings.TrimSpace(body.FileURL) == "" {
		http.Error(w, "title and file_url are required", http.StatusBadRequest)
		return
	}

	sum := sha256.Sum256([]byte(body.FileURL + "|" + body.RawContentForHash))
	hashStr := hex.EncodeToString(sum[:])

	var evidenceID uuid.UUID
	err = a.DB.QueryRow(r.Context(), `
		INSERT INTO audit_evidence (control_id, title, file_url, sha256_hash, validity_status)
		VALUES ($1, $2, $3, $4, 'VALID') RETURNING id
	`, controlID, body.Title, body.FileURL, hashStr).Scan(&evidenceID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"evidence_id": evidenceID,
		"sha256_hash": hashStr,
	})
}

// PATCH /api/remediations/{id}/resolve
func (a *App) ResolveRemediation(w http.ResponseWriter, r *http.Request) {
	taskID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		http.Error(w, "invalid task id", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	tx, err := a.DB.Begin(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(ctx)

	var controlID uuid.UUID
	err = tx.QueryRow(ctx, `
		UPDATE remediation_tasks 
		SET status = 'CLOSED', resolved_at = NOW() 
		WHERE id = $1 RETURNING control_id
	`, taskID).Scan(&controlID)
	if err != nil {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}

	// Restore control compliance if no other open tasks exist for this control
	var openCount int
	_ = tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM remediation_tasks WHERE control_id = $1 AND status != 'CLOSED'
	`, controlID).Scan(&openCount)

	if openCount == 0 {
		_, _ = tx.Exec(ctx, `UPDATE controls SET compliance_status = 'COMPLIANT' WHERE id = $1`, controlID)
	}

	_ = tx.Commit(ctx)
	writeJSON(w, http.StatusOK, map[string]string{"status": "CLOSED"})
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
// GET /api/remediations — list remediation work with linked control and owner details.
func (a *App) ListRemediations(w http.ResponseWriter, r *http.Request) {
 rows, err := a.DB.Query(r.Context(), `
  SELECT rt.id, rt.change_id, rc.clause_number, c.code, c.title, o.full_name,
         rt.status, rt.due_date::text, COALESCE(rt.notes,''), rt.resolved_at
  FROM remediation_tasks rt
  JOIN controls c ON c.id = rt.control_id
  JOIN owners o ON o.id = rt.assignee_id
  JOIN regulatory_changes ch ON ch.id = rt.change_id
  JOIN regulation_clauses rc ON rc.id = ch.clause_id
  ORDER BY CASE WHEN rt.status='CLOSED' THEN 1 ELSE 0 END, rt.due_date ASC`)
 if err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
 defer rows.Close()
 results := make([]RemediationTaskDTO, 0)
 for rows.Next() {
  var item RemediationTaskDTO
  if err := rows.Scan(&item.ID, &item.ChangeID, &item.ClauseNumber, &item.ControlCode, &item.ControlTitle, &item.AssigneeName, &item.Status, &item.DueDate, &item.Notes, &item.ResolvedAt); err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
  results = append(results, item)
 }
 if err := rows.Err(); err != nil { http.Error(w, err.Error(), http.StatusInternalServerError); return }
 writeJSON(w, http.StatusOK, results)
}

// PATCH /api/remediations/{id}/status — move a task through its workflow.
func (a *App) UpdateRemediationStatus(w http.ResponseWriter, r *http.Request) {
 taskID, err := uuid.Parse(r.PathValue("id")); if err != nil { http.Error(w, "invalid task id", http.StatusBadRequest); return }
 var body struct { Status string `json:"status"` }
 if err := json.NewDecoder(r.Body).Decode(&body); err != nil { http.Error(w, "invalid payload", http.StatusBadRequest); return }
 switch body.Status { case "OPEN", "IN_PROGRESS", "REVIEW", "CLOSED": default: http.Error(w, "invalid status", http.StatusBadRequest); return }
 var controlID uuid.UUID
 err = a.DB.QueryRow(r.Context(), `UPDATE remediation_tasks SET status=$1, resolved_at=CASE WHEN $1='CLOSED' THEN NOW() ELSE NULL END WHERE id=$2 RETURNING control_id`, body.Status, taskID).Scan(&controlID)
 if err != nil { http.Error(w, "task not found", http.StatusNotFound); return }
 if body.Status == "CLOSED" {
  var count int
  if err := a.DB.QueryRow(r.Context(), `SELECT COUNT(*) FROM remediation_tasks WHERE control_id=$1 AND status <> 'CLOSED'`, controlID).Scan(&count); err == nil && count == 0 {
   _, _ = a.DB.Exec(r.Context(), `UPDATE controls SET compliance_status='COMPLIANT', updated_at=NOW() WHERE id=$1`, controlID)
  }
 } else {
  _, _ = a.DB.Exec(r.Context(), `UPDATE controls SET compliance_status='IMPACTED', updated_at=NOW() WHERE id=$1`, controlID)
 }
 writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
}
