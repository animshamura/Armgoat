export type Status = 'COMPLIANT' | 'IMPACTED' | 'NON_COMPLIANT';

export interface ImpactedNode {
  control_id: string;
  control_code: string;
  control_title: string;
  compliance_status: Status;
  policy_code: string;
  policy_title: string;
  owner_id: string;
  owner_name: string;
  owner_email: string;
  department: string;
  affected_systems: string[];
  evidence_count: number;
  stale_evidence_count: number;
}

export interface Clause {
  id: string;
  regulation: string;
  clause_number: string;
  title: string;
  content: string;
  version: number;
}

export interface Task {
  id: string;
  change_id: string;
  clause_number: string;
  control_code: string;
  control_title: string;
  assignee_name: string;
  status: string;
  due_date: string;
  notes: string;
  resolved_at: string | null;
}

export interface Evidence {
  id: string;
  control_id: string;
  title: string;
  file_url: string;
  sha256_hash: string;
  validity_status: 'VALID' | 'STALE_NEEDS_REVIEW';
  uploaded_at: string;
}

export interface Change {
  id: string;
  change_summary: string;
  previous_content: string;
  new_content: string;
  detected_at: string;
  tasks_total: number;
  tasks_closed: number;
}

export interface ClauseApi {
  id: string;
  regulation_code: string;
  regulation_name: string;
  clause_number: string;
  title: string;
  content: string;
  version: number;
  status: string;
}

export type Tab = 'overview' | 'controls' | 'remediation' | 'history';

export const STATUS_LABEL: Record<string, string> = {
  COMPLIANT: 'Compliant',
  IMPACTED: 'Needs review',
  NON_COMPLIANT: 'Non-compliant',
};

export const TASK_LABEL: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  REVIEW: 'In review',
  CLOSED: 'Closed',
};

export function isOverdue(t: Task): boolean {
  return t.status !== 'CLOSED' && new Date(t.due_date + 'T23:59:59') < new Date();
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
