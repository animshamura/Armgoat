package app

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// NewHandler wires every API route to the database pool.
// It is shared by the Docker server (backend/main.go) and the Vercel function (api/index.go).
func NewHandler(db *pgxpool.Pool) http.Handler {
	a := &App{DB: db}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/clauses/{id}", a.GetClause)
	mux.HandleFunc("GET /api/clauses/{id}/history", a.GetClauseHistory)
	mux.HandleFunc("GET /api/clauses/{id}/impact", a.GetClauseImpact)
	mux.HandleFunc("PATCH /api/controls/{id}/status", a.UpdateControlStatus)
	mux.HandleFunc("GET /api/controls/{id}/evidence", a.ListControlEvidence)
	mux.HandleFunc("PATCH /api/evidence/{id}/verify", a.VerifyEvidence)
	mux.HandleFunc("POST /api/clauses/{id}/amend", a.AmendRegulationClause)
	mux.HandleFunc("POST /api/controls/{id}/evidence", a.AttachAuditEvidence)
	mux.HandleFunc("PATCH /api/remediations/{id}/resolve", a.ResolveRemediation)
	mux.HandleFunc("GET /api/remediations", a.ListRemediations)
	mux.HandleFunc("PATCH /api/remediations/{id}/status", a.UpdateRemediationStatus)

	return cors(mux)
}

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
