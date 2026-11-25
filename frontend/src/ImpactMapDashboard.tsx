import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './dashboard.css';
import Lineage from './Lineage';
import { ControlTable, Icon, PostureBar, StatusBadge, TaskTable } from './components';
import type { Clause, ImpactedNode, Tab, Task } from './types';
import { isOverdue } from './types';

const API = '/api';

const initialClause: Clause = {
  id: '11111111-1111-1111-1111-111111111111',
  regulation: 'DORA · EU 2022/2554',
  clause_number: 'Art. 9(4)(c)',
  title: 'Cryptographic key management and rotation',
  content: 'Financial entities shall implement policies for cryptographic key lifecycle management.',
  version: 1,
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'controls', label: 'Controls' },
  { id: 'remediation', label: 'Remediation' },
];

const PAGE_TITLE: Record<Tab, string> = {
  overview: 'Regulatory impact',
  controls: 'Controls',
  remediation: 'Remediation queue',
};

export default function ImpactMapDashboard() {
  const [clause, setClause] = useState(initialClause);
  const [nodes, setNodes] = useState<ImpactedNode[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
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

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, b] = await Promise.all([fetch(`${API}/clauses/${clause.id}/impact`), fetch(`${API}/remediations`)]);
      if (!a.ok) throw new Error(`Impact API returned ${a.status}`);
      if (!b.ok) throw new Error(`Remediation API returned ${b.status}`);
      setNodes((await a.json()) || []);
      setTasks((await b.json()) || []);
      setConnected(true);
    } catch (e) {
      setConnected(false);
      setError(e instanceof Error ? e.message : 'Unable to connect to the API.');
    }
  }, [clause.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

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
      setClause((c) => ({ ...c, content: amendText, version: c.version + 1 }));
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
      await load();
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

  function exportCSV() {
    const rows = [
      ['Control', 'Title', 'Status', 'Policy', 'Owner', 'Department', 'Systems', 'Evidence'],
      ...filtered.map((n) => [
        n.control_code,
        n.control_title,
        n.compliance_status,
        n.policy_code,
        n.owner_name,
        n.department,
        n.affected_systems.join('; '),
        String(n.evidence_count),
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

  const count = (t: Tab) => (t === 'controls' ? nodes.length : t === 'remediation' ? openTasks : null);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Armgoat home">
            <Icon name="logo" />
            <span>Armgoat</span>
          </a>
          <nav className="tabs" aria-label="Primary">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab ${tab === t.id ? 'active' : ''}`}
                aria-current={tab === t.id ? 'page' : undefined}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {count(t.id) !== null && <span className="tab-count">{count(t.id)}</span>}
              </button>
            ))}
          </nav>
          <div className="topbar-end">
            <span className={`conn ${connected ? 'ok' : 'down'}`}>
              <i /> {connected ? 'API connected' : 'API unreachable'}
            </span>
            <button type="button" className="icon-btn" title="Refresh data" aria-label="Refresh data" onClick={load}>
              <Icon name="refresh" />
            </button>
            <span className="avatar" title="Workspace admin">
              WA
            </span>
          </div>
        </div>
      </header>

      <main className="page">
        <div className="page-head">
          <div>
            <h1>{PAGE_TITLE[tab]}</h1>
            <p>
              {tab === 'overview' && 'See which policies, controls and systems a regulatory change touches, and who owns the fix.'}
              {tab === 'controls' && 'Every control mapped to this clause, with its owner, systems and evidence.'}
              {tab === 'remediation' && 'Tasks created by regulatory amendments. Update the status as work moves forward.'}
            </p>
          </div>
          <div className="page-actions">
            <button type="button" className="btn" onClick={exportCSV}>
              <Icon name="download" /> Export CSV
            </button>
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
            <section className="clause-band" aria-labelledby="clause-h">
              <div className="clause-text">
                <p className="cite">
                  {clause.regulation} <span aria-hidden="true">/</span> {clause.clause_number}
                  <span className="version">Version {clause.version}</span>
                </p>
                <h2 id="clause-h">{clause.title}</h2>
                <blockquote>{clause.content}</blockquote>
              </div>
              <dl className="figures">
                <div>
                  <dt>Compliance</dt>
                  <dd>{score}%</dd>
                  <span>{compliant} of {nodes.length} controls</span>
                </div>
                <div>
                  <dt>Need review</dt>
                  <dd className={impacted ? 'warn' : ''}>{impacted}</dd>
                  <span>after latest change</span>
                </div>
                <div>
                  <dt>Open tasks</dt>
                  <dd>{openTasks}</dd>
                  <span className={overdue ? 'late' : ''}>{overdue} overdue</span>
                </div>
              </dl>
              <PostureBar nodes={nodes} />
            </section>

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
              <Lineage clause={clause} nodes={nodes} onSelect={setSelected} />
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
                  <label className="narrow">
                    Tasks due in
                    <select value={dueDays} onChange={(e) => setDueDays(Number(e.target.value))}>
                      <option value={7}>7 days</option>
                      <option value={14}>14 days</option>
                      <option value={30}>30 days</option>
                      <option value={60}>60 days</option>
                    </select>
                  </label>
                  <div>
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
              <input
                type="search"
                aria-label="Search controls"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by control, owner, system or policy"
              />
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

        <footer className="foot">Armgoat · Data is read live from your compliance API.</footer>
      </main>

      {selected && (
        <div className="scrim" onClick={() => setSelected(null)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={`${selected.control_code} details`} onClick={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <span className="code">{selected.control_code}</span>
                <h2>{selected.control_title}</h2>
              </div>
              <button type="button" className="icon-btn" aria-label="Close details" onClick={() => setSelected(null)}>
                <Icon name="close" />
              </button>
            </div>
            <StatusBadge status={selected.compliance_status} />
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
                <dt>Evidence records</dt>
                <dd>{selected.evidence_count}</dd>
              </div>
              <div>
                <dt>Systems</dt>
                <dd className="chips">
                  {selected.affected_systems.length ? selected.affected_systems.map((s) => <span key={s}>{s}</span>) : '—'}
                </dd>
              </div>
            </dl>
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
