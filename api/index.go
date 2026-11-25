package handler

import (
	"context"
	"net/http"
	"os"
	"sync"

	"armgoat/internal/app"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	once    sync.Once
	h       http.Handler
	initErr error
)

// Handler is the Vercel serverless entry point. The pool is created once per warm instance.
func Handler(w http.ResponseWriter, r *http.Request) {
	once.Do(func() {
		cfg, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
		if err != nil {
			initErr = err
			return
		}
		cfg.MaxConns = 3 // keep serverless instances from exhausting database connections
		pool, err := pgxpool.NewWithConfig(context.Background(), cfg)
		if err != nil {
			initErr = err
			return
		}
		h = app.NewHandler(pool)
	})
	if initErr != nil {
		http.Error(w, "database is not configured: set DATABASE_URL", http.StatusInternalServerError)
		return
	}
	h.ServeHTTP(w, r)
}
