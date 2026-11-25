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

export type Tab = 'overview' | 'controls' | 'remediation';

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
