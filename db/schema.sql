CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Regulations & Clauses
CREATE TABLE regulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'GDPR', 'SOC2', 'DORA'
    name VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE regulation_clauses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id UUID NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
    clause_number VARCHAR(50) NOT NULL, -- e.g., 'Art. 32(1)(b)'
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, AMENDED, DEPRECATED
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(regulation_id, clause_number)
);

-- 2. Internal Policies, Controls, Systems & Owners
CREATE TABLE owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    department VARCHAR(100) NOT NULL
);

CREATE TABLE systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL UNIQUE, -- e.g., 'Core Banking API', 'AWS Prod'
    criticality VARCHAR(20) NOT NULL DEFAULT 'HIGH', -- LOW, MEDIUM, HIGH, CRITICAL
    owner_id UUID REFERENCES owners(id)
);

CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'POL-SEC-001'
    title VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES owners(id)
);

CREATE TABLE controls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE, -- e.g., 'CTRL-IAM-04'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    compliance_status VARCHAR(30) NOT NULL DEFAULT 'COMPLIANT', -- COMPLIANT, IMPACTED, NON_COMPLIANT
    owner_id UUID NOT NULL REFERENCES owners(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Many-to-Many Lineage Mapping Tables
CREATE TABLE clause_policy_map (
    clause_id UUID REFERENCES regulation_clauses(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
    PRIMARY KEY (clause_id, policy_id)
);

CREATE TABLE policy_control_map (
    policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
    control_id UUID REFERENCES controls(id) ON DELETE CASCADE,
    PRIMARY KEY (policy_id, control_id)
);

CREATE TABLE control_system_map (
    control_id UUID REFERENCES controls(id) ON DELETE CASCADE,
    system_id UUID REFERENCES systems(id) ON DELETE CASCADE,
    PRIMARY KEY (control_id, system_id)
);

-- 4. Regulatory Change Events & Remediation Tracking
CREATE TABLE regulatory_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clause_id UUID NOT NULL REFERENCES regulation_clauses(id),
    previous_content TEXT NOT NULL,
    new_content TEXT NOT NULL,
    change_summary TEXT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE remediation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    change_id UUID NOT NULL REFERENCES regulatory_changes(id) ON DELETE CASCADE,
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    assignee_id UUID NOT NULL REFERENCES owners(id),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, REVIEW, CLOSED
    due_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 5. Audit Evidence Attached to Controls
CREATE TABLE audit_evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    control_id UUID NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    validity_status VARCHAR(30) NOT NULL DEFAULT 'VALID', -- VALID, STALE_NEEDS_REVIEW
    uploaded_by UUID REFERENCES owners(id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clause_policy ON clause_policy_map(clause_id);
CREATE INDEX idx_policy_control ON policy_control_map(policy_id);
CREATE INDEX idx_remediation_change ON remediation_tasks(change_id);