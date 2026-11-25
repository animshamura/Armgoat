package app

import (
	"time"
	"github.com/google/uuid"
)

type ImpactedNode struct {
	ControlID        uuid.UUID `json:"control_id"`
	ControlCode      string    `json:"control_code"`
	ControlTitle     string    `json:"control_title"`
	ComplianceStatus string    `json:"compliance_status"`
	PolicyCode       string    `json:"policy_code"`
	PolicyTitle      string    `json:"policy_title"`
	OwnerID          uuid.UUID `json:"owner_id"`
	OwnerName        string    `json:"owner_name"`
	OwnerEmail       string    `json:"owner_email"`
	Department       string    `json:"department"`
	AffectedSystems  []string  `json:"affected_systems"`
	EvidenceCount    int       `json:"evidence_count"`
	StaleEvidence    int       `json:"stale_evidence_count"`
}

type ClauseChangeRequest struct {
	NewContent    string `json:"new_content"`
	ChangeSummary string `json:"change_summary"`
	DueDays       int    `json:"due_days"`
}

type RemediationTaskDTO struct {
	ID           uuid.UUID  `json:"id"`
	ChangeID     uuid.UUID  `json:"change_id"`
	ClauseNumber string     `json:"clause_number"`
	ControlCode  string     `json:"control_code"`
	ControlTitle string     `json:"control_title"`
	AssigneeName string     `json:"assignee_name"`
	Status       string     `json:"status"`
	DueDate      string     `json:"due_date"`
	Notes        string     `json:"notes"`
	ResolvedAt   *time.Time `json:"resolved_at"`
}

type AuditEvidenceDTO struct {
	ID             uuid.UUID `json:"id"`
	ControlID      uuid.UUID `json:"control_id"`
	Title          string    `json:"title"`
	FileURL        string    `json:"file_url"`
	SHA256Hash     string    `json:"sha256_hash"`
	ValidityStatus string    `json:"validity_status"`
	UploadedAt     time.Time `json:"uploaded_at"`
}

// ClauseDTO is the current state of one regulation clause.
type ClauseDTO struct {
	ID             uuid.UUID `json:"id"`
	RegulationCode string    `json:"regulation_code"`
	RegulationName string    `json:"regulation_name"`
	ClauseNumber   string    `json:"clause_number"`
	Title          string    `json:"title"`
	Content        string    `json:"content"`
	Version        int       `json:"version"`
	Status         string    `json:"status"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ChangeDTO is one published amendment with its remediation progress.
type ChangeDTO struct {
	ID              uuid.UUID `json:"id"`
	ChangeSummary   string    `json:"change_summary"`
	PreviousContent string    `json:"previous_content"`
	NewContent      string    `json:"new_content"`
	DetectedAt      time.Time `json:"detected_at"`
	TasksTotal      int       `json:"tasks_total"`
	TasksClosed     int       `json:"tasks_closed"`
}
