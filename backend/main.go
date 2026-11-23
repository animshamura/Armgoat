package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/compliance_map?sslmode=disable"
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	app := &App{DB: pool}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/clauses/{id}/impact", app.GetClauseImpact)
	mux.HandleFunc("POST /api/clauses/{id}/amend", app.AmendRegulationClause)
	mux.HandleFunc("POST /api/controls/{id}/evidence", app.AttachAuditEvidence)
	mux.HandleFunc("PATCH /api/remediations/{id}/resolve", app.ResolveRemediation)
	mux.HandleFunc("GET /api/remediations", app.ListRemediations)
	mux.HandleFunc("PATCH /api/remediations/{id}/status", app.UpdateRemediationStatus)

	log.Println("Compliance Impact Map API listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", corsMiddleware(mux)))
}

func corsMiddleware(next http.Handler) http.Handler {
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