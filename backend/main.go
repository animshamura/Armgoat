package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"armgoat/internal/app"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/compliance_map?sslmode=disable"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer pool.Close()

	log.Printf("Armgoat API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, app.NewHandler(pool)))
}
