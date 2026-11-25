import type { ImpactedNode, Task } from './types';
import { STATUS_LABEL, TASK_LABEL, formatDate, isOverdue } from './types';

type IconName = 'refresh' | 'download' | 'plus' | 'close' | 'check' | 'alert' | 'logo';

export function Icon({ name }: { name: IconName }) {
  const p = {
    width: 16,
    height: 16,
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
    case 'logo':
      return (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="20" height="20" rx="5" fill="currentColor" />
          <path d="M6 11h4m0 0 3-4m-3 4 3 4M13 7h3M13 15h3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
  }
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
  if (!nodes.length) return <div className="empty">No controls match your search. Clear the filter to see all controls.</div>;
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
                <button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); onSelect(n); }}>
                  {n.control_title}
                </button>
                <span className="code">{n.control_code}</span>
              </td>
              <td>
                <span className="code plain">{n.policy_code}</span>
              </td>
              <td>
                {n.owner_name}
                <span className="sub">{n.department}</span>
              </td>
              <td>{n.affected_systems.join(', ') || '—'}</td>
              <td className="num">{n.evidence_count}</td>
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
    return <div className="empty">No remediation tasks yet. Publish an amendment and tasks are created for every affected control.</div>;
  }
  return (
    <ul className="tasks">
      {tasks.map((t) => {
        const late = isOverdue(t);
        return (
          <li key={t.id} className={`task ${t.status === 'CLOSED' ? 'closed' : ''}`}>
            <div className="task-main">
              <b>{t.control_title}</b>
              <span className="sub">
                <span className="code plain">{t.control_code}</span> · {t.clause_number} · {t.assignee_name}
              </span>
              {full && t.notes && <p>{t.notes}</p>}
            </div>
            <div className={`task-due ${late ? 'late' : ''}`}>
              {late && <Icon name="alert" />}
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
