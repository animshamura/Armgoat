import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Clause, ImpactedNode } from './types';
import { STATUS_LABEL } from './types';
import { EmptyState } from './components';

interface Edge {
  key: string;
  d: string;
  controls: string[];
  tone: string;
  /** 1 = clause to policy, 2 = policy to control, 3 = control to system. Drives the draw-in order. */
  stage: 1 | 2 | 3;
}

/**
 * Four-column trace: clause -> policies -> controls -> systems.
 * Links are measured from the rendered nodes so they follow any layout.
 */
export default function Lineage({
  clause,
  nodes,
  onSelect,
}: {
  clause: Clause;
  nodes: ImpactedNode[];
  onSelect: (n: ImpactedNode) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLElement>());
  const [edges, setEdges] = useState<Edge[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [focus, setFocus] = useState<string | null>(null);

  const policies = useMemo(() => {
    const m = new Map<string, { code: string; title: string; controls: string[] }>();
    nodes.forEach((n) => {
      const p = m.get(n.policy_code) ?? { code: n.policy_code, title: n.policy_title, controls: [] };
      p.controls.push(n.control_id);
      m.set(n.policy_code, p);
    });
    return [...m.values()];
  }, [nodes]);

  const systems = useMemo(() => {
    const m = new Map<string, string[]>();
    nodes.forEach((n) => n.affected_systems.forEach((s) => m.set(s, [...(m.get(s) ?? []), n.control_id])));
    return [...m.entries()].map(([name, controls]) => ({ name, controls }));
  }, [nodes]);

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const pt = (id: string, side: 'l' | 'r') => {
        const n = refs.current.get(id);
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: (side === 'r' ? r.right : r.left) - box.left, y: r.top + r.height / 2 - box.top };
      };
      const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
        const mx = (a.x + b.x) / 2;
        return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
      };
      const next: Edge[] = [];
      policies.forEach((p) => {
        const a = pt('clause', 'r');
        const b = pt(`p:${p.code}`, 'l');
        if (a && b) next.push({ key: `c-${p.code}`, d: curve(a, b), controls: p.controls, tone: 'neutral', stage: 1 });
      });
      nodes.forEach((n) => {
        const tone = n.compliance_status.toLowerCase();
        const a = pt(`p:${n.policy_code}`, 'r');
        const b = pt(`k:${n.control_id}`, 'l');
        if (a && b) next.push({ key: `p-${n.control_id}`, d: curve(a, b), controls: [n.control_id], tone, stage: 2 });
        n.affected_systems.forEach((s) => {
          const c = pt(`k:${n.control_id}`, 'r');
          const d = pt(`s:${s}`, 'l');
          if (c && d) next.push({ key: `s-${n.control_id}-${s}`, d: curve(c, d), controls: [n.control_id], tone, stage: 3 });
        });
      });
      setEdges(next);
      setSize({ w: box.width, h: box.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [nodes, policies, systems]);

  if (!nodes.length) {
    return (
      <EmptyState icon="controls" title="No controls are mapped to this clause">
        Map controls to a policy that implements this clause and they will appear in the trace.
      </EmptyState>
    );
  }

  return (
    <div className="lineage-scroll">
      <div className="lineage-heads" aria-hidden="true">
        <span>Regulation</span>
        <span>
          Policies <b>{policies.length}</b>
        </span>
        <span>
          Controls <b>{nodes.length}</b>
        </span>
        <span>
          Systems <b>{systems.length}</b>
        </span>
      </div>
      <div className="lineage" ref={wrap} onMouseLeave={() => setFocus(null)}>
        <svg className="lineage-links" width={size.w} height={size.h} aria-hidden="true">
          {edges.map((e) => (
            <path
              key={e.key}
              d={e.d}
              pathLength={1}
              className={`link ${e.tone} s${e.stage} ${focus && !e.controls.includes(focus) ? 'dim' : ''} ${
                focus && e.controls.includes(focus) ? 'lit' : ''
              }`}
            />
          ))}
        </svg>

        <div className="lcol">
          <div className="lnode clause-node" ref={setRef('clause')}>
            <span className="lnode-code">{clause.clause_number}</span>
            <span className="lnode-title">{clause.title}</span>
            <span className="lnode-sub">{clause.regulation_code}</span>
          </div>
        </div>

        <div className="lcol">
          {policies.map((p) => (
            <div className="lnode" key={p.code} ref={setRef(`p:${p.code}`)}>
              <span className="lnode-code">{p.code}</span>
              <span className="lnode-title">{p.title}</span>
            </div>
          ))}
        </div>

        <div className="lcol">
          {nodes.map((n) => (
            <button
              type="button"
              key={n.control_id}
              className={`lnode control-node ${n.compliance_status.toLowerCase()}`}
              ref={setRef(`k:${n.control_id}`)}
              onClick={() => onSelect(n)}
              onMouseEnter={() => setFocus(n.control_id)}
              onFocus={() => setFocus(n.control_id)}
              onBlur={() => setFocus(null)}
            >
              <span className="lnode-code">{n.control_code}</span>
              <span className="lnode-title">{n.control_title}</span>
              <span className="lnode-sub">
                <i className="dot" />
                {STATUS_LABEL[n.compliance_status]}
              </span>
              <span className="lnode-owner">{n.owner_name}</span>
            </button>
          ))}
        </div>

        <div className="lcol">
          {systems.map((s) => (
            <div className="lnode system-node" key={s.name} ref={setRef(`s:${s.name}`)}>
              <span className="lnode-title">{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
