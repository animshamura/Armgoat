import type { ReactNode } from 'react';
import type { Change, Evidence, ImpactedNode, Task } from './types';
import { STATUS_LABEL, TASK_LABEL, formatDate, formatDateTime, isOverdue } from './types';

export type IconName =
  | 'refresh'
  | 'download'
  | 'plus'
  | 'close'
  | 'check'
  | 'alert'
  | 'logo'
  | 'overview'
  | 'controls'
  | 'remediation'
  | 'history'
  | 'search'
  | 'inbox';

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  if (name === 'logo') {
    // A source node fanning out to two targets: the impact trace in miniature.
    return (
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect width="28" height="28" rx="7" style={{ fill: 'var(--logo-bg)' }} />
        <g strokeWidth="1.8" strokeLinecap="round" fill="none" style={{ stroke: 'var(--logo-glyph)' }}>
          <path d="M10.9 14c3.6 0 4.6-5.5 6.2-5.5M10.9 14c3.6 0 4.6 5.5 6.2 5.5" />
          <circle cx="8.5" cy="14" r="2.4" style={{ fill: 'var(--logo-glyph)' }} />
          <circle cx="19.5" cy="8.5" r="2.4" />
          <circle cx="19.5" cy="19.5" r="2.4" />
        </g>
      </svg>
    );
  }
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (name) {
    case 'refresh':
      return (
        <svg {...p}>
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
          <path d="M13.5 2.5v3h-3" />
        </svg>
      );
    case 'download':
      return (
        <svg {...p}>
          <path d="M8 2v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...p}>
          <path d="M8 3v10M3 8h10" />
        </svg>
      );
    case 'close':
      return (
        <svg {...p}>
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      );
    case 'check':
      return (
        <svg {...p}>
          <path d="M3 8.5 6.5 12 13 4.5" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...p}>
          <path d="M8 2 1.8 13h12.4L8 2Z" />
          <path d="M8 6.5v3M8 11.3v.2" />
        </svg>
      );
    case 'overview':
      return (
        <svg {...p}>
          <rect x="2" y="2" width="5" height="5" rx="1.2" />
          <rect x="9" y="2" width="5" height="5" rx="1.2" />
          <rect x="2" y="9" width="5" height="5" rx="1.2" />
          <rect x="9" y="9" width="5" height="5" rx="1.2" />
        </svg>
      );
    case 'controls':
      return (
        <svg {...p}>
          <path d="M8 1.8 13 3.7v4.1c0 3-2.1 5.1-5 6.4-2.9-1.3-5-3.4-5-6.4V3.7L8 1.8Z" />
          <path d="m5.8 8 1.6 1.6 3-3.2" />
        </svg>
      );
    case 'remediation':
      return (
        <svg {...p}>
          <rect x="3" y="2.5" width="10" height="11.5" rx="1.8" />
          <path d="M6 2.5h4v1.6a.6.6 0 0 1-.6.6H6.6a.6.6 0 0 1-.6-.6V2.5Z" />
          <path d="m5.6 9 1.7 1.7 3.1-3.3" />
        </svg>
      );
    case 'history':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="5.8" />
          <path d="M8 4.8V8l2.2 1.4" />
        </svg>
      );
    case 'search':
      return (
        <svg {...p}>
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.4 10.4 3.1 3.1" />
        </svg>
      );
    case 'inbox':
      return (
        <svg {...p}>
          <path d="M2 9.5 3.8 3.5h8.4L14 9.5v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3Z" />
          <path d="M2 9.5h3.6l.9 1.5h3l.9-1.5H14" />
        </svg>
      );
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar sm" aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Skeleton({ height = 120 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-ico">
        <Icon name={icon} size={18} />
      </span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status.toLowerCase()}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function PostureBar({ nodes }: { nodes: ImpactedNode[] }) {
  const total = nodes.length || 1;
  const parts = [
    { key: 'compliant', label: 'Compliant', n: nodes.filter((n) => n.compliance_status === 'COMPLIANT').length },
    { key: 'impacted', label: 'Needs review', n: nodes.filter((n) => n.compliance_status === 'IMPACTED').length },
    { key: 'non_compliant', label: 'Non-compliant', n: nodes.filter((n) => n.compliance_status === 'NON_COMPLIANT').length },
  ];
  return (
    <div className="posture">
      <div className="posture-bar" role="img" aria-label={parts.map((p) => `${p.n} ${p.label}`).join(', ')}>
        {parts.map((p) => p.n > 0 && <i key={p.key} className={p.key} style={{ flexGrow: p.n / total }} />)}
        {!nodes.length && <i className="empty-seg" style={{ flexGrow: 1 }} />}
      </div>
      <ul className="posture-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <i className={p.key} />
            {p.label} <b>{p.n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ControlTable({ nodes, onSelect }: { nodes: ImpactedNode[]; onSelect: (n: ImpactedNode) => void }) {
  if (!nodes.length) {
    return (
      <EmptyState icon="search" title="No controls match your search">
        Clear the search or choose a different status to see every control.
      </EmptyState>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Policy</th>
            <th>Owner</th>
            <th>Systems</th>
            <th className="num">Evidence</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={n.control_id} onClick={() => onSelect(n)}>
              <td>
                <button
                  type="button"
                  className="row-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(n);
                  }}
                >
                  {n.control_title}
                </button>
                <span className="code">{n.control_code}</span>
              </td>
              <td>
                <span className="code-chip">{n.policy_code}</span>
              </td>
              <td>
                <div className="person">
                  <Avatar name={n.owner_name} />
                  <div>
                    <span className="person-name">{n.owner_name}</span>
                    <span className="sub">{n.department}</span>
                  </div>
                </div>
              </td>
              <td>
                {n.affected_systems.length ? (
                  <div className="chips">
                    {n.affected_systems.map((s) => (
                      <span key={s}>{s}</span>
                    ))}
                  </div>
                ) : (
                  <span className="none">None mapped</span>
                )}
              </td>
              <td className="num">
                {n.evidence_count}
                {n.stale_evidence_count > 0 && <span className="stale-note">{n.stale_evidence_count} stale</span>}
              </td>
              <td>
                <StatusBadge status={n.compliance_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TaskTable({
  tasks,
  onUpdate,
  full = false,
}: {
  tasks: Task[];
  onUpdate: (id: string, status: string) => void;
  full?: boolean;
}) {
  if (!tasks.length) {
    return (
      <EmptyState icon="remediation" title="No remediation tasks yet">
        Publish an amendment and a task is created for every affected control.
      </EmptyState>
    );
  }
  return (
    <ul className="tasks">
      {tasks.map((t) => {
        const late = isOverdue(t);
        return (
          <li key={t.id} className={`task ${t.status === 'CLOSED' ? 'closed' : ''}`}>
            <div className="task-main">
              <b>{t.control_title}</b>
              <span className="meta">
                <span className="code-chip">{t.control_code}</span>
                <span>{t.clause_number}</span>
                <span>{t.assignee_name}</span>
              </span>
              {full && t.notes && <p>{t.notes}</p>}
            </div>
            <div className={`task-due ${late ? 'late' : ''}`}>
              {late && <Icon name="alert" size={14} />}
              <span>
                {late ? 'Overdue since ' : 'Due '}
                {formatDate(t.due_date)}
              </span>
            </div>
            <select aria-label={`Status for ${t.control_code}`} value={t.status} onChange={(e) => onUpdate(t.id, e.target.value)}>
              {Object.entries(TASK_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </li>
        );
      })}
    </ul>
  );
}

export function EvidenceList({
  items,
  onVerify,
  busy,
}: {
  items: Evidence[];
  onVerify: (id: string) => void;
  busy: boolean;
}) {
  if (!items.length) return <p className="muted-note">No evidence attached yet.</p>;
  return (
    <ul className="evidence">
      {items.map((e) => {
        const stale = e.validity_status === 'STALE_NEEDS_REVIEW';
        return (
          <li key={e.id} className={stale ? 'stale' : ''}>
            <div>
              <b>{e.title}</b>
              <span className="meta">
                <span>{formatDateTime(e.uploaded_at)}</span>
                <span className="code-chip" title={e.sha256_hash}>
                  {e.sha256_hash.slice(0, 12)}…
                </span>
              </span>
              <span className={`pill ${stale ? 'stale' : 'valid'}`}>{stale ? 'Stale: needs review' : 'Valid'}</span>
            </div>
            {stale && (
              <button type="button" className="btn small" disabled={busy} onClick={() => onVerify(e.id)}>
                Re-verify
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function HistoryList({ changes }: { changes: Change[] }) {
  if (!changes.length) {
    return (
      <EmptyState icon="history" title="No amendments yet">
        Publish one from the Overview tab and it will be recorded here.
      </EmptyState>
    );
  }
  return (
    <ol className="history">
      {changes.map((c, i) => {
        const pct = c.tasks_total ? Math.round((c.tasks_closed / c.tasks_total) * 100) : 100;
        return (
          <li key={c.id}>
            <div className="history-head">
              <div>
                <span className="version">Change {changes.length - i}</span>
                <h3>{c.change_summary}</h3>
                <span className="sub">{formatDateTime(c.detected_at)}</span>
              </div>
              <div className="history-progress" aria-label={`${c.tasks_closed} of ${c.tasks_total} tasks closed`}>
                <span>
                  {c.tasks_closed} of {c.tasks_total} tasks closed
                </span>
                <div className="meter">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
            <div className="diff">
              <div className="diff-col before">
                <h4>
                  <i />
                  Before
                </h4>
                <blockquote>{c.previous_content}</blockquote>
              </div>
              <div className="diff-col after">
                <h4>
                  <i />
                  After
                </h4>
                <blockquote>{c.new_content}</blockquote>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
