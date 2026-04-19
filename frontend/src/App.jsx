import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShieldAlert, Play, Pause, UserCheck, Building2, Bus, Activity,
         AlertTriangle, CheckCircle, AlertCircle, MapPin, Clock, Moon, Sun } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API            = 'http://127.0.0.1:5000/api';
const THRESHOLD_HIGH = 150;

const CITIES = {
  'Somnath':  [20.9060, 70.4012],
  'Pavagadh': [22.4646, 73.5238],
  'Ambaji':   [24.3310, 72.8510],
  'Dwarka':   [22.2442, 68.9685]
};

const SCENARIOS = [
  {
    headline: 'MASS SURGE AT ENTRY GATE',
    subtext:  'Sudden influx of pilgrims is overwhelming the main corridor.',
    location: 'Main Entry Gate / Choke Point A',
    duration: '20 minutes',
    police: 'Deploy officers to Entry Gate A immediately. Form a human barrier and activate crowd-control protocol. Log arrival time.',
    temple: 'Halt all new darshan tokens. Lock inner gate. Announce PA message asking pilgrims to wait at rest zones.',
    gsrtc:  'Stop all incoming buses at 3 km holding checkpoint. Radio drivers with alternate drop-off coordinates.',
  },
  {
    headline: 'CORRIDOR BOTTLENECK - CRUSH IMMINENT',
    subtext:  'Bidirectional crowd flow causing dangerous compression in the narrow passage.',
    location: 'Inner Corridor - Narrow Passage B',
    duration: '15 minutes',
    police: 'Send 2 units to Passage B. Enforce one-directional flow. Redirect exit crowd via Side Lane 2.',
    temple: 'Suspend darshan queue movement. Hold pilgrims inside courtyard until corridor pressure drops.',
    gsrtc:  'Issue NO-ENTRY for all vehicles within 3 km. Hold shuttle services at depot until further notice.',
  },
  {
    headline: 'TRANSPORT BURST OVERLOADING CAPACITY',
    subtext:  'Multiple buses arrived simultaneously causing an unmanaged crowd surge at drop-off.',
    location: 'Bus Drop-off Zone / Platform 1',
    duration: '25 minutes',
    police: 'Cordon off Platform 1. Guide disembarked pilgrims to staged waiting areas before allowing forward movement.',
    temple: 'Divert all incoming pilgrim groups to outer queue. Pause inner darshan movement for 15 minutes.',
    gsrtc:  'Cancel all scheduled arrivals for next 30 minutes. Reroute buses to Holding Point C (Highway Junction).',
  },
  {
    headline: 'PEAK HOUR DENSITY CRITICAL',
    subtext:  'Pressure index has exceeded safe density limits for the current corridor width.',
    location: 'Main Corridor / Gate A & B',
    duration: '15 minutes',
    police: 'Activate crowd-management formation at Gate A & B. Begin gradual thinning. Do NOT use force.',
    temple: 'Close inner sanctum to new entries immediately. Open emergency side exits. Broadcast calming announcement.',
    gsrtc:  'Hold all vehicles. Deploy GSRTC staff to assist with pedestrian flow management at drop-off zones.',
  },
  {
    headline: 'FLOW RATE 2x SAFE CAPACITY',
    subtext:  'Entry rate is double the safe threshold. Risk of crowd collapse within minutes.',
    location: 'All Active Entry Points',
    duration: '30 minutes',
    police: 'HIGHEST PRIORITY - all available units to all entry points. Implement full crowd-freeze protocol immediately.',
    temple: 'FULL DARSHAN SUSPENSION. Lock all gates. Announce 30-minute suspension over PA system.',
    gsrtc:  'FULL STOP on all incoming transport. Coordinate with police for vehicle turnaround 5 km from site.',
  },
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default function App() {

  // ── Simulation state ───────────────────────────────────────────────
  const [city, setCity]           = useState('Somnath');
  const [data, setData]           = useState([]);
  const [idx, setIdx]             = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [chartData, setChartData] = useState([]);
  const [logs, setLogs]           = useState([]);
  const [pred, setPred]           = useState({
    current_pressure: 0, predicted_pressure: 0, risk_level: 'LOW',
    predicted_minutes_to_high_risk: 0, trend_slope: 0, pattern: 'UNKNOWN'
  });

  // Replay speed: ms between steps
  const [replaySpeed, setReplaySpeed] = useState(1500);

  // ── Dark mode ─────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() =>
    localStorage.getItem('cs-dark') === 'true'
  );
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('cs-dark', darkMode);
  }, [darkMode]);

  // ── Modal (step 1 & 2) ─────────────────────────────────────────────
  const [modal, setModal]         = useState(null);   // null | 'ask' | 'warn'
  const [eventTime, setEventTime] = useState('');
  const [scenario, setScenario]   = useState(SCENARIOS[0]);

  // ── SLA Timer ──────────────────────────────────────────────────────
  const [slaTimer, setSlaTimer]     = useState(90);
  const [slaBreach, setSlaBreach]   = useState(false);
  const slaStartRef                 = useRef(null);  // Date.now() when modal opened
  const slaBreachLoggedRef          = useRef(false); // prevent duplicate breach logs

  // ── Agency confirmations (used in Step 2 modal) ────────────────────
  const [policeAck, setPoliceAck] = useState(false);
  const [templeAck, setTempleAck] = useState(false);
  const [gsrtcAck,  setGsrtcAck]  = useState(false);
  // Per-agency response times (null until confirmed)
  const [policeAckTime, setPoliceAckTime] = useState(null);
  const [templeAckTime, setTempleAckTime] = useState(null);
  const [gsrtcAckTime,  setGsrtcAckTime]  = useState(null);

  const emergencyRef = useRef(false);
  const audioRef     = useRef(null);

  /* ── Audio init ─────────────────────────────────────────────────── */
  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    audioRef.current.loop = true;
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

  /* ── SLA 90s countdown (runs while modal is open) ───────────────── */
  useEffect(() => {
    if (!modal) { setSlaTimer(90); return; }
    const tick = setInterval(() => {
      setSlaTimer(prev => {
        if (prev <= 1) {
          clearInterval(tick);
          setSlaBreach(true);
          if (!slaBreachLoggedRef.current) {
            slaBreachLoggedRef.current = true;
            setLogs(p => [{ time: new Date().toLocaleTimeString(), detail: '[SLA BREACHED] No action taken within 90 seconds', breach: true }, ...p]);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [modal]);

  /* ── Load data on city change ───────────────────────────────────── */
  useEffect(() => {
    setPlaying(false); setChartData([]); setLogs([]); setIdx(0);
    emergencyRef.current = false; setModal(null);
    setPred({ current_pressure: 0, predicted_pressure: 0, risk_level: 'LOW', predicted_minutes_to_high_risk: 0, trend_slope: 0 });

    axios.get(`${API}/data?location=${city}`)
      .then(r => {
        if (r.data?.data) {
          setData(r.data.data);
          if (r.data.data.length > 0) processStep(0, r.data.data);
        }
      })
      .catch(console.error);
  }, [city]);

  /* ── Simulation ticker ──────────────────────────────────────────── */
  useEffect(() => {
    let t;
    if (playing && !emergencyRef.current && data.length > 0) {
      t = setInterval(() => {
        setIdx(prev => {
          if (prev >= data.length - 1) { setPlaying(false); return prev; }
          const next = prev + 1;
          processStep(next, data);
          return next;
        });
      }, replaySpeed);
    }
    return () => clearInterval(t);
  }, [playing, data, replaySpeed]);

  /* ── Core step processor ────────────────────────────────────────── */
  const processStep = async (step, dataset) => {
    if (emergencyRef.current) return;
    const history = dataset.slice(Math.max(0, step - 20), step + 1);
    setChartData(history);
    const context = dataset.slice(Math.max(0, step - 5), step + 1);
    try {
      const res = await axios.post(`${API}/predict`, { history: context });
      const p = res.data;
      setPred(prev => ({ ...prev, ...p }));
      if (p.risk_level === 'HIGH' && !emergencyRef.current) triggerEmergency(p.current_pressure);
    } catch (e) { console.error(e); }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

  const handleReset = () => {
    setPlaying(false);
    setIdx(0);
    setChartData([]);
    setLogs([]);
    setModal(null);
    emergencyRef.current = false;
    stopAudio();
    setPred({ current_pressure: 0, predicted_pressure: 0, risk_level: 'LOW', predicted_minutes_to_high_risk: 0, trend_slope: 0, pattern: 'UNKNOWN' });
    if (data.length > 0) processStep(0, data);
  };

  /* ── Emergency trigger ──────────────────────────────────────────── */
  const triggerEmergency = (pressure) => {
    const chosen = pickRandom(SCENARIOS);
    setScenario(chosen);
    emergencyRef.current = true;
    setPlaying(false);
    setPoliceAck(false); setTempleAck(false); setGsrtcAck(false);
    setPoliceAckTime(null); setTempleAckTime(null); setGsrtcAckTime(null);
    setSlaBreach(false);
    slaBreachLoggedRef.current = false;
    setSlaTimer(90);
    slaStartRef.current = Date.now();
    const t = new Date().toLocaleTimeString();
    setEventTime(t);
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setModal('ask');
    setLogs(prev => [{ time: t, detail: `HIGH RISK @ ${city} - ${chosen.headline} (${pressure.toFixed(1)} pax/m)` }, ...prev]);
  };

  /* ── Modal Step 1: YES (with response time tracking) ────────────── */
  const handleActionYes = () => {
    const elapsed = Math.round((Date.now() - slaStartRef.current) / 1000);
    const overdue = elapsed > 90;
    stopAudio();
    emergencyRef.current = false;
    setModal(null);
    setPlaying(true);
    const msg = overdue
      ? `Operator confirmed action (${elapsed}s — OVERDUE by ${elapsed - 90}s) - simulation resumed.`
      : `Operator confirmed action in ${elapsed} seconds - simulation resumed.`;
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), detail: msg, breach: overdue }, ...prev]);
  };

  /* ── Modal Step 1: NO → show Step 2 with agency confirms ────────── */
  const handleActionNo = () => setModal('warn');

  /* ── Agency ack handler (used in Step 2 modal) ──────────────────── */
  const handleAgencyAck = (agency) => {
    const elapsed = Math.round((Date.now() - slaStartRef.current) / 1000);
    const overdue = elapsed > 90;
    const t = new Date().toLocaleTimeString();
    const overdueTag = overdue ? ` — OVERDUE by ${elapsed - 90}s` : '';
    if (agency === 'police')  { setPoliceAck(true);  setPoliceAckTime(elapsed); setLogs(prev => [{ time: t, detail: `District Police confirmed (${elapsed}s${overdueTag})`, breach: overdue }, ...prev]); }
    if (agency === 'temple')  { setTempleAck(true);  setTempleAckTime(elapsed); setLogs(prev => [{ time: t, detail: `Temple Trust confirmed (${elapsed}s${overdueTag})`, breach: overdue }, ...prev]); }
    if (agency === 'gsrtc')   { setGsrtcAck(true);   setGsrtcAckTime(elapsed);  setLogs(prev => [{ time: t, detail: `GSRTC Transport confirmed (${elapsed}s${overdueTag})`, breach: overdue }, ...prev]); }
  };

  /* ── Close modal once all 3 agencies confirmed ─────────────────── */
  const handleAllDone = () => {
    stopAudio();
    emergencyRef.current = false;
    setModal(null);
    setPlaying(true);
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), detail: 'All agencies confirmed - simulation resumed.' }, ...prev]);
  };

  const allAgenciesDone = policeAck && templeAck && gsrtcAck;

  /* ── Chart data ─────────────────────────────────────────────────── */
  const lines = chartData.map((d, i) => ({
    time: String(i),
    pressure: d.corridor_width_m > 0
      ? (d.entry_flow_rate_pax_per_min + d.transport_arrival_burst) / d.corridor_width_m : 0
  }));

  const makeIcon = (c) => new L.Icon({
    iconUrl: (c === city && pred.risk_level === 'HIGH')
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
      : c === city
        ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'
        : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
  });

  const isHigh    = pred.risk_level === 'HIGH';
  const appLocked = modal !== null;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     HOME PAGE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="dashboard-container">

      {/* ── MODAL OVERLAY (Step 1 & 2) ──────────────────────────── */}
      {appLocked && (
        <div className="modal-overlay">

          {/* STEP 1: Did you take action? + 90s SLA Timer */}
          {modal === 'ask' && (
            <div className="modal-box shadow-xl" style={{ borderTop: '8px solid #ef4444', maxWidth: 500 }}>
              {/* SLA Timer bar */}
              <div style={{ position: 'relative', height: 6, background: '#f1f5f9', borderRadius: 99, marginBottom: '1.25rem', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99,
                  width: `${(slaTimer / 90) * 100}%`, transition: 'width 1s linear',
                  background: slaTimer > 30 ? '#2563eb' : slaTimer > 10 ? '#f59e0b' : '#ef4444' }} />
              </div>
              <div style={{ textAlign: 'center', color: '#ef4444', marginBottom: '0.75rem' }}>
                <AlertTriangle size={52} style={{ animation: 'pulse-icon 1.5s infinite' }} />
              </div>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '2rem', fontWeight: 800,
                  color: slaTimer > 30 ? '#1e293b' : slaTimer > 10 ? '#d97706' : '#dc2626' }}>
                  {slaTimer}s
                </span>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  SLA Response Window
                </div>
              </div>
              <h2 style={{ textAlign: 'center', marginBottom: '0.4rem', fontSize: '1.25rem', color: '#0f172a' }}>
                ⚠️ {scenario.headline}
              </h2>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                {scenario.subtext}
              </p>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                📍 <strong>{city} - {scenario.location}</strong> &nbsp;|&nbsp; ⏰ <strong>{eventTime}</strong>
              </p>
              <p className="modal-question" style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: '1.5rem', color: '#0f172a' }}>
                Did you take any action or not?
              </p>
              {slaBreach && (
                <div className="sla-breach-banner" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '0.6rem 1rem', marginBottom: '1rem', textAlign: 'center', color: '#b91c1c', fontWeight: 700, fontSize: '0.85rem' }}>
                  ⏱️ SLA BREACHED — Response window expired!
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-success" style={{ flex: 1, padding: '0.75rem' }} onClick={handleActionYes}>
                  <CheckCircle size={18} /> YES - Action Taken
                </button>
                <button className="btn btn-danger" style={{ flex: 1, padding: '0.75rem' }} onClick={handleActionNo}>
                  <AlertCircle size={18} /> NO
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Individual agency confirmation */}
          {modal === 'warn' && (
            <div className="modal-box shadow-xl" style={{ borderTop: '8px solid #ef4444', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto' }}>
              {/* SLA Timer bar - track uses dark-friendly color */}
              <div style={{ position: 'relative', height: 6, background: 'var(--border-color)', borderRadius: 99, marginBottom: '1rem', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99,
                  width: `${(slaTimer / 90) * 100}%`, transition: 'width 1s linear',
                  background: slaTimer > 30 ? '#2563eb' : slaTimer > 10 ? '#f59e0b' : '#ef4444' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 style={{ color: '#ef4444', marginBottom: 0, fontSize: '1.15rem' }}>
                  🚨 CONFIRM EACH AGENCY
                </h2>
                <span className="sla-count" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem',
                  color: slaTimer > 30 ? '#1e293b' : slaTimer > 10 ? '#d97706' : '#dc2626' }}>
                  {slaTimer}s
                </span>
              </div>

              <div className="modal-info-box" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '0.65rem 0.9rem', marginBottom: '1rem', fontSize: '0.82rem', lineHeight: 1.7 }}>
                <div><MapPin size={13} style={{ verticalAlign: 'middle' }} /> <strong>Location:</strong> {city} - {scenario.location}</div>
                <div><Clock size={13} style={{ verticalAlign: 'middle' }} /> <strong>Alert Time:</strong> {eventTime}</div>
                <div>⏳ <strong>Duration:</strong> {scenario.duration}</div>
              </div>

              {/* Individual agency confirm cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <AgencyConfirmRow icon={<UserCheck size={16} />} color="#1e3a8a" bg="#eff6ff"
                  agency="District Police" action={scenario.police}
                  isAcked={policeAck} ackTime={policeAckTime} onAck={() => handleAgencyAck('police')} />
                <AgencyConfirmRow icon={<Building2 size={16} />} color="#92400e" bg="#fffbeb"
                  agency="Temple Trust" action={scenario.temple}
                  isAcked={templeAck} ackTime={templeAckTime} onAck={() => handleAgencyAck('temple')} />
                <AgencyConfirmRow icon={<Bus size={16} />} color="#166534" bg="#f0fdf4"
                  agency="GSRTC Transport" action={scenario.gsrtc}
                  isAcked={gsrtcAck} ackTime={gsrtcAckTime} onAck={() => handleAgencyAck('gsrtc')} />
              </div>

              {/* Progress + Return button */}
              <div className="modal-progress" style={{ textAlign: 'center', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>
                {[policeAck, templeAck, gsrtcAck].filter(Boolean).length}/3 agencies confirmed
              </div>
              <button className="btn btn-success" style={{ width: '100%', padding: '0.8rem', fontSize: '0.9rem',
                opacity: allAgenciesDone ? 1 : 0.35, cursor: allAgenciesDone ? 'pointer' : 'not-allowed' }}
                disabled={!allAgenciesDone} onClick={handleAllDone}>
                <CheckCircle size={18} />
                {allAgenciesDone ? 'ALL CONFIRMED - RETURN TO DASHBOARD' : 'Confirm all agencies to continue'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN DASHBOARD (blurs behind modal) ─────────────────── */}
      <div style={{ filter: appLocked ? 'blur(5px) grayscale(30%)' : 'none', pointerEvents: appLocked ? 'none' : 'auto', transition: 'filter 0.3s' }}>

        <header className="header">
          <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldAlert size={28} color="#2563eb" />
            <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#1e293b' }}>CROWD SHIELD</span>
            <span className="header-subtitle" style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '0.5rem' }}>Multi-Agency Dashboard</span>
          </div>
          <div className="header-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Crush Window</div>
              <div style={{ fontWeight: 800, color: isHigh ? '#dc2626' : '#1e293b' }}>
                {pred.predicted_minutes_to_high_risk > 0 ? `${pred.predicted_minutes_to_high_risk.toFixed(0)} min` : pred.risk_level === 'HIGH' ? 'NOW' : '--'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Trend</div>
              <div style={{ fontWeight: 700 }}>{pred.trend_slope > 0 ? '↗ Rising' : '↘ Falling'}</div>
            </div>
            {/* Replay speed selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Speed</span>
              <select
                value={replaySpeed}
                onChange={e => setReplaySpeed(Number(e.target.value))}
                style={{ fontSize: '0.78rem', fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 6,
                  padding: '0.3rem 0.5rem', background: '#f8fafc', color: '#1e293b', cursor: 'pointer' }}
              >
                <option value={3000}>0.5×</option>
                <option value={1500}>1×</option>
                <option value={750}>2×</option>
                <option value={300}>5×</option>
              </select>
            </div>
            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(d => !d)}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              style={{ width: 'auto', padding: '0.5rem 0.7rem', background: 'var(--bg-main)',
                color: 'var(--text-main)', border: '1px solid var(--border-color)',
                borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s' }}>
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
              <span className="header-subtitle">{darkMode ? 'Light' : 'Dark'}</span>
            </button>
            {/* Reset button */}
            <button className="btn" style={{ width: 'auto', padding: '0.5rem 1rem', background: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
              onClick={handleReset}>
              🔄 RESET
            </button>
            <button className={`btn ${playing ? 'btn-danger' : 'btn-primary'}`}
              style={{ width: 'auto', padding: '0.5rem 1.25rem' }}
              onClick={() => {
                if (idx >= data.length - 1) { setIdx(0); setChartData([]); setLogs([]); }
                setPlaying(!playing);
              }}>
              {playing ? <><Pause size={16} /> PAUSE</> : <><Play size={16} /> RUN SIM</>}
            </button>
          </div>
        </header>

        <div className="grid-layout">
          {/* LEFT: Pressure + Map */}
          <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card shadow-sm">
              <div className="flex-between">
                <div className="card-title">Pressure Index</div>
                <span className={`status-badge status-${pred.risk_level}`}>{pred.risk_level}</span>
              </div>
              <div className="metric-value" style={{ color: isHigh ? '#dc2626' : pred.risk_level === 'MEDIUM' ? '#d97706' : '#2563eb' }}>
                {pred.current_pressure.toFixed(1)}
                <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 500 }}> person approx/min</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                Predicted (10 min): <strong style={{ color: '#1e293b' }}>{pred.predicted_pressure.toFixed(1)} pax/m</strong>
              </div>
              {/* Pattern classifier badge */}
              <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Pattern:</span>
                {pred.pattern === 'CRUSH' ? (
                  <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca',
                    padding: '0.2rem 0.65rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>
                    CRUSH BUILDUP 🚨
                  </span>
                ) : pred.pattern === 'SURGE' ? (
                  <span style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0',
                    padding: '0.2rem 0.65rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>
                    TEMPORARY SURGE ✅
                  </span>
                ) : (
                  <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0',
                    padding: '0.2rem 0.65rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>
                    ANALYSING...
                  </span>
                )}
              </div>
            </div>

            <div className="card shadow-sm" style={{ padding: 0, overflow: 'hidden', height: '220px', borderRadius: '12px' }}>
              <MapContainer center={[22.3, 71.2]} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                {Object.entries(CITIES).map(([name, coords]) => (
                  <Marker key={name} position={coords} icon={makeIcon(name)} eventHandlers={{ click: () => setCity(name) }}>
                    <Popup><strong>{name}</strong><br />{name === city ? 'Monitoring' : 'Click to monitor'}</Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* RIGHT: Graph + Log */}
          <div className="col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card shadow-sm" style={{ height: '300px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Activity size={16} color="#64748b" />
                <div className="card-title" style={{ margin: 0 }}>Pressure Timeline - {city}</div>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Pressure = (People entering + Crowd burst) / Corridor width
              </div>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={lines}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} domain={[0, 200]} />
                  <Tooltip formatter={(v) => [Number(v).toFixed(2), 'Pressure']} />
                  <ReferenceLine y={THRESHOLD_HIGH} stroke="#ef4444" strokeDasharray="5 5"
                    label={{ position: 'insideTopRight', value: 'Danger (150)', fill: '#ef4444', fontSize: 11 }} />
                  <Line type="monotone" dataKey="pressure"
                    stroke={isHigh ? '#ef4444' : '#2563eb'} strokeWidth={2.5}
                    dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card shadow-sm" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              <div className="card-title">Event Log</div>
              {logs.length === 0
                ? <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No events. Start the simulation.</div>
                : <table className="modern-table">
                    <thead><tr><th>Time</th><th>Details</th></tr></thead>
                    <tbody>
                      {logs.map((l, i) => (
                        <tr key={i}>
                          <td style={{ color: l.breach ? '#dc2626' : '#94a3b8' }}>{l.time}</td>
                          <td style={{ fontWeight: 600, color: l.breach ? '#dc2626' : 'inherit' }}>{l.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
          </div>
        </div>
        {/* NOTE: Agency panel intentionally removed from home page */}
      </div>
    </div>
  );
}

/* ── SUBCOMPONENTS ─────────────────────────────────────────────────── */

function AgencyConfirmCard({ icon, name, color, bg, task, isAcked, onAck }) {
  return (
    <div className="card shadow-sm" style={{
      borderLeft: `5px solid ${isAcked ? '#10b981' : color}`,
      transition: 'border-color 0.4s',
      background: isAcked ? '#f0fdf4' : '#fff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 700, color: isAcked ? '#059669' : color, fontSize: '0.95rem' }}>
          {icon} {name}
        </div>
        {isAcked && <span style={{ background: '#dcfce7', color: '#059669', padding: '0.2rem 0.7rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700 }}>✓ CONFIRMED</span>}
      </div>
      <div style={{ background: isAcked ? '#bbf7d033' : bg, border: `1px solid ${color}22`,
        borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.85rem', color: '#1e293b', marginBottom: '0.9rem', lineHeight: 1.6 }}>
        {task}
      </div>
      <button
        className={`btn ${isAcked ? 'btn-success' : 'btn-primary'}`}
        style={{ background: isAcked ? '#10b981' : color }}
        disabled={isAcked}
        onClick={onAck}
      >
        {isAcked ? '✓ Deployment Confirmed' : `Confirm ${name} Deployment`}
      </button>
    </div>
  );
}

function AgencyRow({ icon, color, agency, action }) {
  return (
    <div style={{ display: 'flex', gap: '0.65rem', background: '#f8fafc',
      border: `1px solid ${color}22`, borderRadius: 8, padding: '0.55rem 0.8rem', alignItems: 'flex-start' }}>
      <span style={{ color, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', color, marginBottom: '0.1rem' }}>{agency}</div>
        <div style={{ fontSize: '0.8rem', color: '#475569' }}>{action}</div>
      </div>
    </div>
  );
}

function AgencyConfirmRow({ icon, color, bg, agency, action, isAcked, ackTime, onAck }) {
  const isOverdue = ackTime !== null && ackTime > 90;
  return (
    <div className="agency-confirm-row" style={{ display: 'flex', gap: '0.65rem',
      background: isAcked ? '#f0fdf4' : bg,
      border: `1px solid ${isAcked ? (isOverdue ? '#fecaca' : '#a7f3d0') : color + '30'}`,
      borderRadius: 10, padding: '0.65rem 0.85rem', alignItems: 'flex-start',
      transition: 'all 0.3s' }}>
      <span style={{ color: isAcked ? (isOverdue ? '#dc2626' : '#059669') : color, marginTop: 2, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: isAcked ? (isOverdue ? '#dc2626' : '#059669') : color, marginBottom: '0.15rem' }}>{agency}</div>
        <div className="agency-action-text" style={{ fontSize: '0.78rem', color: '#475569', marginBottom: '0.5rem', lineHeight: 1.5 }}>{action}</div>
        <button
          className={`btn ${isAcked ? 'btn-success' : 'btn-primary'}`}
          style={{ width: '100%', padding: '0.4rem', fontSize: '0.75rem',
            background: isAcked ? (isOverdue ? '#dc2626' : '#10b981') : color }}
          disabled={isAcked}
          onClick={onAck}
        >
          {isAcked ? '✓ Confirmed' : `Confirm ${agency}`}
        </button>
        {/* Response time display under the button */}
        {isAcked && ackTime !== null && (
          <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', fontWeight: 700, textAlign: 'center',
            color: isOverdue ? '#dc2626' : '#059669' }}>
            {isOverdue
              ? `⏱️ Responded in ${ackTime}s — OVERDUE by ${ackTime - 90}s`
              : `✔️ Responded in ${ackTime}s`}
          </div>
        )}
      </div>
    </div>
  );
}

