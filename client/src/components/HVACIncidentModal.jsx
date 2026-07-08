import React, { useEffect, useRef, useState } from 'react';

/**
 * HVACIncidentModal — full incident-response workflow for an HVAC fault.
 * Adapted for ZMU: AHU-02 (asset AHU-027) supply-fan fault in Academic
 * Block B (Z03). Brief → Plan → Execution, with simulated team dispatch,
 * notification delivery and step-by-step remediation (approve/execute).
 */

const STEPS = [
  { id: 'R1', title: 'Confirm fault via BMS sensor array', detail: 'Cross-check AHU-02 trip code with vibration sensor, differential pressure and supply-fan current. Rule out sensor false-positive.', owner: 'BMS Engineer', eta: '3 min', etaMs: 2600, requires: 'auto' },
  { id: 'R2', title: 'Isolate AHU-02 — transfer load to AHU-01 / AHU-03', detail: 'Via BMS: HVAC → AHU-02 → Emergency Bypass. Enable load transfer to AHU-026 and AHU-028. Verify ramp-up to compensate.', owner: 'BMS Engineer', eta: '4 min', etaMs: 3200, requires: 'approval' },
  { id: 'R3', title: 'Issue temperature advisory to Block B occupants', detail: 'Push notification + PA announcement to affected classrooms and labs. Advise of temporary HVAC delay.', owner: 'Facility Manager', eta: '2 min', etaMs: 1800, requires: 'auto' },
  { id: 'R4', title: 'Dispatch HVAC technician to AHU-02', detail: 'Technician to bring supply-fan bearing kit, vibration analyser, spare contactor. Access via F3 plant room.', owner: 'HVAC Tech', eta: '8 min', etaMs: 4200, requires: 'auto' },
  { id: 'R5', title: 'Deploy portable cooling — affected classrooms', detail: 'Retrieve 2× portable AC units from central store. Position in the two worst-affected classrooms until AHU-02 recommissioned.', owner: 'Temp Labour', eta: '15 min', etaMs: 5000, requires: 'approval' },
  { id: 'R6', title: 'Diagnose & repair AHU-02', detail: 'Technician on-site: inspect supply-fan bearing, check vibration signature, re-seat drive coupling. Log findings in CMMS.', owner: 'HVAC Tech', eta: '35 min', etaMs: 6200, requires: 'auto' },
  { id: 'R7', title: 'Recommission AHU-02 & rebalance zones', detail: 'Restart AHU-02, monitor airflow ramp-up, re-assign FCUs to primary feed. Withdraw portable units once zone reaches setpoint.', owner: 'BMS Engineer', eta: '10 min', etaMs: 3600, requires: 'approval' },
  { id: 'R8', title: 'Close incident — sign off & log', detail: 'Facility Manager verifies all zones at setpoint ±1°C. Log in CAFM. Schedule AHU-02 preventive maintenance within 7 days.', owner: 'Facility Manager', eta: '5 min', etaMs: 2200, requires: 'approval' },
];

const TEAM = [
  { name: 'Khalid Al Mansoori', role: 'HVAC Tech', badge: '🔧', eta: '8 min' },
  { name: 'Sarah Chen', role: 'BMS Engineer', badge: '💻', eta: '2 min' },
  { name: 'Ravi Menon', role: 'Facility Manager', badge: '🏢', eta: '5 min' },
  { name: 'Mohammed Al Zaabi', role: 'Temp Labour', badge: '🔨', eta: '12 min' },
];

const NOTIF_TARGETS = [
  { id: 't1', team: 'HVAC Maintenance', icon: '🔧' },
  { id: 't2', team: 'BMS Control Room', icon: '💻' },
  { id: 't3', team: 'Facility Manager', icon: '🏢' },
  { id: 't4', team: 'Campus Security', icon: '🛡️' },
];
const STATUS_PROG = ['queued', 'sending', 'delivered', 'acknowledged'];
const STATUS_THRESH_S = [0, 1.2, 3, 6];
const STATUS_COLOR = { queued: '#475569', sending: '#fbbf24', delivered: '#60a5fa', acknowledged: '#4ade80' };
const STEP_LABEL = { pending: 'Pending', in_progress: 'In Progress', waiting_approval: 'Awaiting Approval', done: 'Completed' };
const stepColor = (s) => (s === 'done' ? '#4ade80' : s === 'in_progress' ? '#60a5fa' : s === 'waiting_approval' ? '#fbbf24' : '#475569');

export default function HVACIncidentModal({ onClose, onResolve, asset }) {
  const [phase, setPhase] = useState('brief');
  const [steps, setSteps] = useState(STEPS.map((s) => ({ ...s, status: 'pending' })));
  const [notifs, setNotifs] = useState([]);
  const [team, setTeam] = useState(TEAM.map((t) => ({ ...t, status: 'standby' })));
  const [activeStep, setActiveStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!started) return;
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [started]);

  const launch = () => {
    setStarted(true);
    setNotifs(NOTIF_TARGETS.map((t) => ({ ...t, status: 'queued', sentAt: Date.now() })));
    setPhase('plan');
  };

  useEffect(() => {
    if (!notifs.length) return;
    const t = setInterval(() => {
      const now = Date.now();
      setNotifs((prev) => prev.map((n) => {
        const idx = STATUS_PROG.indexOf(n.status);
        const secs = (now - n.sentAt) / 1000;
        const next = idx + 1;
        return next < STATUS_PROG.length && secs > STATUS_THRESH_S[next] ? { ...n, status: STATUS_PROG[next] } : n;
      }));
    }, 700);
    return () => clearInterval(t);
  }, [notifs.length]);

  useEffect(() => {
    if (!started) return;
    const timers = [
      setTimeout(() => setTeam((p) => p.map((m) => (m.role === 'BMS Engineer' ? { ...m, status: 'on_site' } : m))), 3500),
      setTimeout(() => setTeam((p) => p.map((m) => (m.role === 'Facility Manager' ? { ...m, status: 'acknowledged' } : m))), 4500),
      setTimeout(() => setTeam((p) => p.map((m) => (m.role === 'HVAC Tech' ? { ...m, status: 'acknowledged' } : m))), 6000),
      setTimeout(() => setTeam((p) => p.map((m) => (m.role === 'HVAC Tech' ? { ...m, status: 'on_site' } : m))), 15000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [started]);

  const beginStep = (idx) => {
    if (idx >= STEPS.length) return;
    const step = STEPS[idx];
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: step.requires === 'approval' ? 'waiting_approval' : 'in_progress' } : s)));
    setActiveStep(idx);
    if (step.requires === 'auto') setTimeout(() => completeStep(idx), step.etaMs);
  };
  const approveStep = (idx) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: 'in_progress' } : s)));
    setTimeout(() => completeStep(idx), STEPS[idx].etaMs);
  };
  const completeStep = (idx) => {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: 'done' } : s)));
    if (idx + 1 < STEPS.length) setTimeout(() => beginStep(idx + 1), 500);
  };
  const startExecution = () => { setPhase('exec'); beginStep(0); };

  const doneCount = steps.filter((s) => s.status === 'done').length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;
  const elapsedStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const nAck = notifs.filter((n) => n.status === 'acknowledged').length;

  return (
    <div className="hip-overlay">
      <div className="hip-panel">
        <div className="hip-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="status-chip status-chip-danger">HIGH</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>HVAC Fault — {asset?.asset_id ?? 'AHU-027'} (AHU-02) Supply Fan</div>
              <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginTop: 2 }}>INC-2026-{asset?.asset_id ?? 'AHU-027'} · Academic Block B (Z03) · F3 Plant Room</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {started && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 6, padding: '5px 10px' }}>
                <span>⏱</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>{elapsedStr}</span>
                <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 10 }}>elapsed</span>
                <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10, marginLeft: 6, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 8 }}>SLA: 45 min</span>
              </div>
            )}
            <button className="bdt-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="hip-tabs">
          {['brief', 'plan', 'exec'].map((t) => (
            <button key={t} className={`hip-tab${phase === t ? ' is-active' : ''}`} onClick={() => setPhase(t)}>
              {t === 'brief' ? '📋 Incident Brief' : t === 'plan' ? '📝 Response Plan' : `⚙ Execution ${pct}%`}
            </button>
          ))}
        </div>

        {phase === 'brief' && (
          <div className="hip-body">
            <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 11, fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: '#ef4444', display: 'inline-block' }} className="animate-blink" />
                ACTIVE FAULT <span style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: '#fca5a5' }}>{asset?.asset_id ?? 'AHU-027'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  ['Location', 'Academic Block B (Z03) · F3 Plant Room · serves classrooms & labs'],
                  ['Fault', 'Supply-fan bearing degradation · airflow reduced, temp drift 18h'],
                  ['Zone temp', '25.4°C and rising (setpoint 22.5°C)'],
                  ['Asset health', `${asset?.health_pct ?? 41}% · status FAULT`],
                  ['Occupants', 'Approx. 14 classrooms affected'],
                  ['SLA target', '45 min'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>{k}</span>
                    <span style={{ color: '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bdt-advisory" style={{ marginBottom: 14 }}>
              <div className="bdt-advisory-title">🤖 SiA AI Advisory — Recommended Actions <span style={{ marginLeft: 'auto', fontSize: 9.5, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid #ef4444' }}>Risk: HIGH</span></div>
              {[
                'Isolate AHU-02 — transfer zone load to AHU-026/AHU-028 backup circuit',
                'Increase adjacent AHU output slightly for thermal compensation',
                'Issue temperature advisory to Block B occupants via push notification',
                'Dispatch HVAC maintenance team with bearing service kit (ETA 8 min)',
                'Deploy 2× portable AC units to worst-affected classrooms',
                'Recommission AHU-02 on-site — estimated 35 min repair window',
              ].map((a, i) => <div key={i} className="bdt-advisory-action">{a}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 4 }}>
              {[
                { label: 'Airflow', value: '38%', color: '#ef4444', sub: 'of nominal' },
                { label: 'Zone Temp', value: '25.4°', color: '#fb923c', sub: 'and rising' },
                { label: 'Asset health', value: `${asset?.health_pct ?? 41}%`, color: '#fbbf24', sub: 'AHU-02' },
                { label: 'Rooms affected', value: '14', color: '#60a5fa', sub: 'classrooms' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={{ background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.45)' }}>{sub}</div>
                </div>
              ))}
            </div>

            <button className="hip-cta" onClick={launch} disabled={started}>
              {started ? '✓ Plan Activated' : '🚀 Activate Response Plan'}
            </button>
          </div>
        )}

        {phase === 'plan' && (
          <div className="hip-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>📡 Notifications Sent</div>
                {notifs.length === 0 && <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.35)', textAlign: 'center', padding: '10px 0' }}>Activate plan to send notifications</div>}
                {notifs.map((n) => (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{n.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{n.team}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: STATUS_COLOR[n.status] }}>
                      <span style={{ width: 6, height: 6, borderRadius: 99, background: STATUS_COLOR[n.status], display: 'inline-block' }} />
                      {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                    </div>
                  </div>
                ))}
                {notifs.length > 0 && <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.5)', textAlign: 'right', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>{nAck}/{notifs.length} teams acknowledged</div>}
              </div>

              <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>👷 Team Dispatch</div>
                {team.map((m) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{m.badge}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.5)' }}>{m.role}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 600, color: m.status === 'on_site' ? '#4ade80' : m.status === 'acknowledged' ? '#60a5fa' : '#fbbf24' }}>
                        {m.status === 'on_site' ? '✓ On site' : m.status === 'acknowledged' ? '✓ Ack' : '⏳ Standby'}
                      </div>
                      <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.45)' }}>ETA {m.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(148,163,184,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '14px 0 8px' }}>📋 Remediation Plan Overview</div>
            {STEPS.map((s) => (
              <div key={s.id} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 7, marginBottom: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.seq ?? STEPS.indexOf(s) + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{s.title}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: 'rgba(96,165,250,0.7)' }}>{s.owner}</span>
                    <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.45)' }}>⏱ {s.eta}</span>
                    {s.requires === 'approval' && <span style={{ fontSize: 9.5, color: '#fbbf24', background: 'rgba(251,191,36,0.1)', borderRadius: 3, padding: '1px 6px' }}>⚠ Approval required</span>}
                  </div>
                </div>
              </div>
            ))}

            <button className="hip-cta" onClick={startExecution} disabled={!started || phase === 'exec'}>
              ▶ Begin Step-by-Step Execution
            </button>
          </div>
        )}

        {phase === 'exec' && (
          <div className="hip-body">
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #3b82f6, #4ade80)', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.55)', textAlign: 'right', marginTop: 4 }}>{doneCount}/{steps.length} steps complete · {pct}%</div>
            </div>

            {steps.map((step, idx) => {
              const color = stepColor(step.status);
              const isActive = activeStep === idx;
              return (
                <div key={step.id} className={`hip-exec-step hip-exec-step--${step.status}`} onClick={() => setActiveStep(isActive ? -1 : idx)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                    <div style={{ width: 26, height: 26, borderRadius: 99, border: `1.5px solid ${color}`, color, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {step.status === 'done' ? '✓' : idx + 1}
                    </div>
                    <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#e2e8f0' }}>{step.title}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.5)' }}>{step.owner}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{STEP_LABEL[step.status]}</span>
                    </div>
                  </div>
                  {isActive && (
                    <div style={{ padding: '0 12px 12px 48px' }}>
                      <div style={{ fontSize: 12, color: 'rgba(203,213,225,0.75)', lineHeight: 1.55, marginBottom: 10 }}>{step.detail}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.45)' }}>⏱ Expected: {step.eta}</span>
                        {step.status === 'waiting_approval' && (
                          <button onClick={(e) => { e.stopPropagation(); approveStep(idx); }}
                            style={{ padding: '6px 14px', background: 'linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.28))', border: '1px solid rgba(251,191,36,0.5)', color: '#fde68a', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                            ✅ Approve &amp; Execute
                          </button>
                        )}
                        {step.status === 'in_progress' && <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#60a5fa' }}><span className="hip-spinner" />In progress…</span>}
                        {step.status === 'done' && <span style={{ fontSize: 11.5, color: '#4ade80', fontWeight: 700 }}>✓ Completed</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {allDone && (
              <div className="hip-resolved">
                <div style={{ fontSize: 30, marginBottom: 6 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#4ade80' }}>Incident Resolved</div>
                <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.7)', marginTop: 5 }}>
                  All {steps.length} remediation steps complete · AHU-02 recommissioned · zones at setpoint
                </div>
                <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(74,222,128,0.12)' }}>
                  ⏱ Resolution time: {elapsedStr} · SLA: 45 min {elapsed <= 2700 ? '✓ Within SLA' : '⚠ SLA breached'}
                </div>
                <button className="hip-cta hip-cta--green" onClick={() => { onResolve?.(); onClose(); }}>
                  ✓ Close &amp; Log Incident
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
