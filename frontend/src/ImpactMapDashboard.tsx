import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './dashboard.css';
import Lineage from './Lineage';
import { ControlTable, EmptyState, EvidenceList, HistoryList, Icon, PostureBar, Skeleton, StatusBadge, TaskTable } from './components';
import type { IconName } from './components';
import type { Change, Clause, ClauseApi, Evidence, ImpactedNode, Tab, Task } from './types';
import { STATUS_LABEL, isOverdue } from './types';

const API = '/api';

const initialClause: Clause = {
  id: '11111111-1111-1111-1111-111111111111',
  regulation_code: 'DORA',
  regulation_name: 'Digital Operational Resilience Act (EU 2022/2554)',
  clause_number: 'Art. 9(4)(c)',
  title: 'Cryptographic key management and rotation',
  content: 'Financial entities shall implement policies for cryptographic key lifecycle management.',
  version: 1,
};

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'controls', label: 'Controls', icon: 'controls' },
  { id: 'remediation', label: 'Remediation', icon: 'remediation' },
  { id: 'history', label: 'History', icon: 'history' },
];

const PAGE_TITLE: Record<Tab, string> = {
  overview: 'Regulatory impact',
  controls: 'Controls',
  remediation: 'Remediation queue',
  history: 'Change history',
};

const PAGE_DESC: Record<Tab, string> = {
  overview: 'See which policies, controls and systems a regulatory change touches, and who owns the fix.',
  controls: 'Every control mapped to this clause, with its owner, systems and evidence.',
  remediation: 'Tasks created by regulatory amendments. Update the status as work moves forward.',
  history: 'Every amendment to this clause, with the text before and after and how much of the resulting work is done.',
};

export default function ImpactMapDashboard() {
  const [clause, setClause] = useState(initialClause);
  const [nodes, setNodes] = useState<ImpactedNode[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selected, setSelected] = useState<ImpactedNode | null>(null);
  const [amendText, setAmendText] = useState('');
  const [summary, setSummary] = useState('');
  const [dueDays, setDueDays] = useState(14);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connected, setConnected] = useState(true);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, b, c, h] = await Promise.all([
        fetch(`${API}/clauses/${clause.id}/impact`),
        fetch(`${API}/remediations`),
        fetch(`${API}/clauses/${clause.id}`),
        fetch(`${API}/clauses/${clause.id}/history`),
      ]);
      if (!a.ok) throw new Error(`Impact API returned ${a.status}`);
      if (!b.ok) throw new Error(`Remediation API returned ${b.status}`);
      if (!c.ok) throw new Error(`Clause API returned ${c.status}`);
      if (!h.ok) throw new Error(`History API returned ${h.status}`);
      setNodes((await a.json()) || []);
      setTasks((await b.json()) || []);
      const cl: ClauseApi = await c.json();
      setClause({
        id: cl.id,
        regulation_code: cl.regulation_code,
        regulation_name: cl.regulation_name,
        clause_number: cl.clause_number,
        title: cl.title,
        content: cl.content,
        version: cl.version,
      });
      setChanges((await h.json()) || []);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Unable to connect to the API.');
    } finally {
      setReady(true);
    }
  }, [clause.id]);

  useEffect(() => {
    load();
  }, [load]);

  const loadEvidence = useCallback(async (controlId: string) => {
    try {
      const r = await fetch(`${API}/controls/${controlId}/evidence`);
      if (!r.ok) throw new Error(`Evidence API returned ${r.status}`);
      setEvidence((await r.json()) || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load evidence.');
    }
  }, []);

  useEffect(() => {
    setEvidence([]);
    if (selected) loadEvidence(selected.control_id);
  }, [selected?.control_id, loadEvidence]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  useEffect(() => {
    setSelected((cur) => (cur ? nodes.find((n) => n.control_id === cur.control_id) ?? cur : cur));
  }, [nodes]);

  const filtered = useMemo(
    () =>
      nodes.filter(
        (n) =>
          (statusFilter === 'ALL' || n.compliance_status === statusFilter) &&
          `${n.control_code} ${n.control_title} ${n.owner_name} ${n.department} ${n.policy_code} ${n.affected_systems.join(' ')}`
            .toLowerCase()
            .includes(query.toLowerCase())
      ),
    [nodes, statusFilter, query]
  );

  const compliant = nodes.filter((n) => n.compliance_status === 'COMPLIANT').length;
  const impacted = nodes.filter((n) => n.compliance_status === 'IMPACTED').length;
  const openTasks = tasks.filter((t) => t.status !== 'CLOSED').length;
  const overdue = tasks.filter(isOverdue).length;
  const staleEvidence = nodes.reduce((sum, n) => sum + n.stale_evidence_count, 0);
  const score = nodes.length ? Math.round((compliant / nodes.length) * 100) : 0;

  const toast = (s: string) => {
    setNotice(s);
    window.setTimeout(() => setNotice(''), 3500);
  };

  async function amend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const r = await fetch(`${API}/clauses/${clause.id}/amend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_content: amendText, change_summary: summary, due_days: dueDays }),
      });
      if (!r.ok) throw new Error(await r.text());
      setAmendText('');
      setSummary('');
      await load();
      toast('Amendment published. Remediation tasks were created for affected controls.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Amendment failed.');
    } finally {
      setLoading(false);
    }
  }

  async function attach(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/controls/${selected.control_id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: evidenceTitle,
          file_url: evidenceUrl,
          raw_content: `${selected.control_code}|${evidenceTitle}|${evidenceUrl}`,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setEvidenceTitle('');
      setEvidenceUrl('');
      await Promise.all([load(), loadEvidence(selected.control_id)]);
      toast('Evidence attached.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Evidence upload failed.');
    } finally {
      setLoading(false);
    }
  }

  async function updateTask(id: string, status: string) {
    try {
      const r = await fetch(`${API}/remediations/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
      toast(`Task moved to ${status.replace('_', ' ').toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Task update failed.');
    }
  }

  async function setControlStatus(status: string) {
    if (!selected || status === selected.compliance_status) return;
    try {
      const r = await fetch(`${API}/controls/${selected.control_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await r.text());
      await load();
      toast(`${selected.control_code} marked ${(STATUS_LABEL[status] ?? status).toLowerCase()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed.');
    }
  }

  async function verifyEvidence(id: string) {
    if (!selected) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/evidence/${id}/verify`, { method: 'PATCH' });
      if (!r.ok) throw new Error(await r.text());
      await Promise.all([load(), loadEvidence(selected.control_id)]);
      toast('Evidence re-verified.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['Control', 'Title', 'Status', 'Policy', 'Owner', 'Department', 'Systems', 'Evidence', 'Stale evidence'],
      ...filtered.map((n) => [
        n.control_code,
        n.control_title,
        n.compliance_status,
        n.policy_code,
        n.owner_name,
        n.department,
        n.affected_systems.join('; '),
        String(n.evidence_count),
        String(n.stale_evidence_count),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compliance-controls.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const count = (t: Tab) => (t === 'controls' ? nodes.length : t === 'remediation' ? openTasks : t === 'history' ? changes.length : null);

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Armgoat home">
          <Icon name="logo" size={28} />
          <span>Armgoat</span>
        </a>
        <nav className="nav" aria-label="Primary">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
              {count(t.id) !== null && <span className="nav-count">{count(t.id)}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className={`conn ${connected ? 'ok' : 'down'}`} role="status">
            <i />
            <span className="conn-text">{connected ? 'API connected' : 'API unreachable'}</span>
          </span>
          <span className="user" title="Workspace admin">
            <span className="avatar">WA</span>
            <span className="user-name">Workspace admin</span>
          </span>
        </div>
      </aside>

      <div className="main-col">
        <main className="page">
          <div className="page-head">
            <div>
              <h1>{PAGE_TITLE[tab]}</h1>
              <p>{PAGE_DESC[tab]}</p>
            </div>
            <div className="page-actions">
              <button type="button" className="btn square" title="Refresh data" aria-label="Refresh data" onClick={load}>
                <Icon name="refresh" />
              </button>
              {tab === 'controls' && (
                <button type="button" className="btn" onClick={exportCSV}>
                  <Icon name="download" /> Export CSV
                </button>
              )}
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setTab('overview');
                  window.setTimeout(() => document.getElementById('amend-form')?.scrollIntoView({ behavior: 'smooth' }), 30);
                }}
              >
                <Icon name="plus" /> New amendment
              </button>
            </div>
          </div>

          {error && (
            <div className="alert error" role="alert">
              <Icon name="alert" />
              <div>
                <b>Couldn’t complete that request</b>
                <span>{error}</span>
              </div>
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setError('')}>
                <Icon name="close" />
              </button>
            </div>
          )}

          {tab === 'overview' && (
            <>
              <div className="overview-top">
                <section className="clause-card" aria-labelledby="clause-h">
                  <p className="cite">
                    <span className="reg-chip">{clause.regulation_code}</span>
                    <span>{clause.regulation_name}</span>
                    <span className="version">Version {clause.version}</span>
                  </p>
                  <span className="clause-no">{clause.clause_number}</span>
                  <h2 id="clause-h">{clause.title}</h2>
                  <blockquote>{clause.content}</blockquote>
                </section>

                <section className="posture-card" aria-label="Compliance posture">
                  {!ready ? (
                    <Skeleton height={176} />
                  ) : (
                    <>
                      <div className="score">
                        <span className="score-num">
                          {nodes.length ? score : '–'}
                          {nodes.length > 0 && <small>%</small>}
                        </span>
                        <span className="score-label">
                          {compliant} of {nodes.length} controls compliant
                        </span>
                      </div>
                      <PostureBar nodes={nodes} />
                      <dl className="mini-stats">
                        <div>
                          <dt>Open tasks</dt>
                          <dd>{openTasks}</dd>
                        </div>
                        <div>
                          <dt>Overdue</dt>
                          <dd className={overdue ? 'bad' : ''}>{overdue}</dd>
                        </div>
                        <div>
                          <dt>Stale evidence</dt>
                          <dd className={staleEvidence ? 'warn' : ''}>{staleEvidence}</dd>
                        </div>
                      </dl>
                    </>
                  )}
                </section>
              </div>

              <section className="panel" aria-labelledby="trace-h">
                <div className="panel-head">
                  <div>
                    <h2 id="trace-h">Impact trace</h2>
                    <p>Hover or focus a control to follow its path to policy and systems. Select it for details.</p>
                  </div>
                  <button type="button" className="link-btn" onClick={() => setTab('controls')}>
                    Open control list
                  </button>
                </div>
                {!ready ? (
                  <div className="panel-pad">
                    <Skeleton height={240} />
                  </div>
                ) : !connected && !nodes.length ? (
                  <EmptyState
                    icon="alert"
                    title="Can’t reach the compliance API"
                    action={
                      <button type="button" className="btn small" onClick={load}>
                        Try again
                      </button>
                    }
                  >
                    Check that the backend is running, then try again.
                  </EmptyState>
                ) : (
                  <Lineage clause={clause} nodes={nodes} onSelect={setSelected} />
                )}
              </section>

              <div className="split">
                <section className="panel" id="amend-form" aria-labelledby="amend-h">
                  <div className="panel-head">
                    <div>
                      <h2 id="amend-h">Publish an amendment</h2>
                      <p>Update the clause text. Every mapped control gets a remediation task.</p>
                    </div>
                  </div>
                  <form className="form" onSubmit={amend}>
                    <label>
                      Change summary
                      <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Require quarterly key rotation" required />
                    </label>
                    <label>
                      New clause text
                      <textarea value={amendText} onChange={(e) => setAmendText(e.target.value)} rows={4} placeholder="Paste the amended requirement" required />
                    </label>
                    <div className="form-foot">
                      <label className="inline">
                        Tasks due in
                        <select value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))}>
                          <option value={7}>7 days</option>
                          <option value={14}>14 days</option>
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                        </select>
                      </label>
                      <button className="btn primary" disabled={loading}>
                        {loading ? 'Publishing…' : 'Publish amendment'}
                      </button>
                    </div>
                  </form>
                </section>

                <section className="panel" aria-labelledby="act-h">
                  <div className="panel-head">
                    <div>
                      <h2 id="act-h">Recent remediation</h2>
                      <p>Latest tasks created from changes.</p>
                    </div>
                    <button type="button" className="link-btn" onClick={() => setTab('remediation')}>
                      See all
                    </button>
                  </div>
                  <TaskTable tasks={tasks.slice(0, 5)} onUpdate={updateTask} />
                </section>
              </div>
            </>
          )}

          {tab === 'controls' && (
            <section className="panel">
              <div className="toolbar">
                <div className="search">
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Search controls"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by control, owner, system or policy"
                  />
                </div>
                <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="ALL">All statuses</option>
                  <option value="COMPLIANT">Compliant</option>
                  <option value="IMPACTED">Needs review</option>
                  <option value="NON_COMPLIANT">Non-compliant</option>
                </select>
                <span className="result-count">
                  {filtered.length} of {nodes.length}
                </span>
              </div>
              <ControlTable nodes={filtered} onSelect={setSelected} />
            </section>
          )}

          {tab === 'remediation' && (
            <section className="panel">
              <div className="toolbar">
                <span className="result-count">
                  {openTasks} open · {overdue} overdue · {tasks.length - openTasks} closed
                </span>
              </div>
              <TaskTable tasks={tasks} onUpdate={updateTask} full />
            </section>
          )}

          {tab === 'history' && (
            <section className="panel">
              <HistoryList changes={changes} />
            </section>
          )}

          <footer className="foot">Armgoat reads data live from your compliance API.</footer>
        </main>
      </div>

      {selected && (
        <div className="scrim" onClick={() => setSelected(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${selected.control_code} details`} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="code">{selected.control_code}</span>
                <h2>{selected.control_title}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Close details" autoFocus onClick={() => setSelected(null)}>
                <Icon name="close" />
              </button>
            </div>

            <div className="drawer-section status-row">
              <div className="status-now">
                <span className="field-label">Current status</span>
                <StatusBadge status={selected.compliance_status} />
              </div>
              <label className="status-set">
                Set status
                <select value={selected.compliance_status} onChange={(e) => setControlStatus(e.target.value)}>
                  <option value="COMPLIANT">Compliant</option>
                  <option value="IMPACTED">Needs review</option>
                  <option value="NON_COMPLIANT">Non-compliant</option>
                </select>
              </label>
            </div>

            <dl className="facts">
              <div>
                <dt>Policy</dt>
                <dd>
                  {selected.policy_title}
                  <span className="code">{selected.policy_code}</span>
                </dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>
                  {selected.owner_name}
                  <span className="sub">{selected.owner_email}</span>
                </dd>
              </div>
              <div>
                <dt>Department</dt>
                <dd>{selected.department}</dd>
              </div>
              <div>
                <dt>Systems</dt>
                <dd className="chips">
                  {selected.affected_systems.length ? selected.affected_systems.map((s) => <span key={s}>{s}</span>) : '—'}
                </dd>
              </div>
            </dl>

            <div className="drawer-section">
              <h3>
                Evidence <span className="h-count">{selected.evidence_count}</span>
              </h3>
              <EvidenceList items={evidence} onVerify={verifyEvidence} busy={loading} />
            </div>

            <form className="form" onSubmit={attach}>
              <h3>Attach evidence</h3>
              <label>
                Title
                <input value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} placeholder="Q2 access review report" required />
              </label>
              <label>
                Link
                <input type="url" value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://… or vault URL" required />
              </label>
              <div>
                <button className="btn primary" disabled={loading}>
                  {loading ? 'Saving…' : 'Attach evidence'}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          <Icon name="check" /> {notice}
        </div>
      )}
    </div>
  );
}
