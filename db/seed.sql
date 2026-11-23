INSERT INTO owners (id, full_name, email, department) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sarah Chen', 's.chen@fintech.io', 'Cloud Security'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Marcus Vance', 'm.vance@fintech.io', 'Platform Engineering');

INSERT INTO systems (id, name, criticality, owner_id) VALUES
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'AWS KMS Prod', 'CRITICAL', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Core Ledger Vault', 'CRITICAL', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO regulations (id, code, name, jurisdiction) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'DORA', 'Digital Operational Resilience Act (EU 2022/2554)', 'European Union');

INSERT INTO regulation_clauses (id, regulation_id, clause_number, title, content) VALUES
('11111111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Art. 9(4)(c)', 'Cryptographic Key Management & Rotation', 'Financial entities shall implement policies for cryptographic key lifecycle management.');

INSERT INTO policies (id, code, title, owner_id) VALUES
('22222222-2222-2222-2222-222222222222', 'POL-SEC-004', 'Enterprise Cryptography & Key Management Policy', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

INSERT INTO controls (id, code, title, description, owner_id) VALUES
('33333333-3333-3333-3333-333333333333', 'CTRL-KMS-01', 'Automated KMS Key Rotation', 'Enforce automated rotation of master encryption keys.', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
('44444444-4444-4444-4444-444444444444', 'CTRL-VLT-02', 'HSM Hardware Root-of-Trust Enforcement', 'All production signing keys must reside in FIPS 140-3 Level 3 HSMs.', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO clause_policy_map VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
INSERT INTO policy_control_map VALUES 
('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');

INSERT INTO control_system_map VALUES
('33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

INSERT INTO audit_evidence (control_id, title, file_url, sha256_hash) VALUES
('33333333-3333-3333-3333-333333333333', 'Q1 AWS KMS Rotation Audit Export', 's3://compliance-vault/kms-q1.json', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');