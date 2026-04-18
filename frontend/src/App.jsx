import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
<<<<<<< HEAD
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ShieldAlert, Play, Pause, UserCheck, Building2, Bus, Activity,
         AlertTriangle, CheckCircle, AlertCircle, MapPin, Clock, ArrowRight } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
=======
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { 
  ShieldAlert, Play, Pause, AlertTriangle, Clock, Activity, CheckCircle, MapPin 
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './index.css';
>>>>>>> 0799b0d790880040d2d56f37f44af788cd9dc9c9

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
<<<<<<< HEAD
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

/* ── PAGE CONSTANTS ───────────────────────────────────────────────── */
const PAGE_HOME    = 'home';
const PAGE_AGENCY  = 'agency';   // full-screen agency confirmation page

export default function App() {
  // ── Routing ────────────────────────────────────────────────────────
  const [page, setPage] = useState(PAGE_HOME);

  // ── Simulation state ───────────────────────────────────────────────
  const [city, setCity]           = useState('Somnath');
  const [data, setData]           = useState([]);
  const [idx, setIdx]             = useState(0);
  const [playing, setPlaying]     = useState(false);
  const [chartData, setChartData] = useState([]);
  const [logs, setLogs]           = useState([]);
  const [pred, setPred]           = useState({
    current_pressure: 0, predicted_pressure: 0, risk_level: 'LOW',
    predicted_minutes_to_high_risk: 0, trend_slope: 0
  });

  // ── Modal (step 1 & 2) ─────────────────────────────────────────────
  const [modal, setModal]         = useState(null);   // null | 'ask' | 'warn'
  const [eventTime, setEventTime] = useState('');
  const [scenario, setScenario]   = useState(SCENARIOS[0]);

  // ── Agency confirmations (used on PAGE_AGENCY) ─────────────────────
  const [policeAck, setPoliceAck] = useState(false);
  const [templeAck, setTempleAck] = useState(false);
  const [gsrtcAck,  setGsrtcAck]  = useState(false);

  const emergencyRef = useRef(false);
  const audioRef     = useRef(null);

  /* ── Audio init ─────────────────────────────────────────────────── */
  useEffect(() => {
    audioRef.current = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
    audioRef.current.loop = true;
    return () => { if (audioRef.current) audioRef.current.pause(); };
  }, []);

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
      }, 1500);
    }
    return () => clearInterval(t);
  }, [playing, data]);

  /* ── Core step processor ────────────────────────────────────────── */
  const processStep = async (step, dataset) => {
    if (emergencyRef.current) return;
    const history = dataset.slice(Math.max(0, step - 20), step + 1);
    setChartData(history);
    const context = dataset.slice(Math.max(0, step - 5), step + 1);
    try {
      const res = await axios.post(`${API}/predict`, { history: context });
      const p   = res.data;
      setPred(p);
      if (p.risk_level === 'HIGH' && !emergencyRef.current) triggerEmergency(p.current_pressure);
    } catch (e) { console.error(e); }
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  };

  /* ── Emergency trigger ──────────────────────────────────────────── */
  const triggerEmergency = (pressure) => {
    const chosen = pickRandom(SCENARIOS);
    setScenario(chosen);
    emergencyRef.current = true;
    setPlaying(false);
    setPoliceAck(false); setTempleAck(false); setGsrtcAck(false);
    const t = new Date().toLocaleTimeString();
    setEventTime(t);
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setModal('ask');
    setLogs(prev => [{ time: t, detail: `HIGH RISK @ ${city} - ${chosen.headline} (${pressure.toFixed(1)} pax/m)` }, ...prev]);
  };

  /* ── Modal Step 1: YES ──────────────────────────────────────────── */
  const handleActionYes = () => {
    stopAudio();
    emergencyRef.current = false;
    setModal(null);
    setPlaying(true);
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), detail: 'Operator confirmed action taken - simulation resumed.' }, ...prev]);
  };

  /* ── Modal Step 1: NO → show Step 2 ────────────────────────────── */
  const handleActionNo = () => setModal('warn');

  /* ── Modal Step 2: "Confirm All Agency Tasks" → go to Agency Page ── */
  const handleGoToAgencyPage = () => {
    setModal(null);
    setPage(PAGE_AGENCY);   // navigate to the agency confirmation page
  };

  /* ── Agency Page: called when all 3 are confirmed ──────────────── */
  const handleAllAgenciesConfirmed = () => {
    stopAudio();
    emergencyRef.current = false;
    setPage(PAGE_HOME);
    setPlaying(true);
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), detail: 'All agencies confirmed deployment - simulation resumed.' }, ...prev]);
  };

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
     AGENCY CONFIRMATION PAGE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (page === PAGE_AGENCY) {
    const allDone = policeAck && templeAck && gsrtcAck;
    return (
      <div className="dashboard-container" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '2rem 0 1rem' }}>
          <AlertTriangle size={48} color="#ef4444" style={{ animation: allDone ? 'none' : 'pulse-icon 1.5s infinite' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.75rem' }}>
            AGENCY DEPLOYMENT CONFIRMATION
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Confirm that each agency has received and acted on their assigned task before resuming.
          </p>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '0.75rem 1.25rem', margin: '1rem auto', maxWidth: 500, fontSize: '0.85rem', lineHeight: 1.8, textAlign: 'left' }}>
            <div><MapPin size={13} style={{ verticalAlign: 'middle' }} /> <strong>Location:</strong> {city} - {scenario.location}</div>
            <div><Clock size={13} style={{ verticalAlign: 'middle' }} /> <strong>Alert Time:</strong> {eventTime}</div>
            <div>⏳ <strong>Duration:</strong> {scenario.duration}</div>
          </div>
        </div>

        {/* 3 Agency Confirmation Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <AgencyConfirmCard
            icon={<UserCheck size={22} />}
            name="DISTRICT POLICE"
            color="#1e3a8a" bg="#eff6ff"
            task={scenario.police}
            isAcked={policeAck}
            onAck={() => setPoliceAck(true)}
          />
          <AgencyConfirmCard
            icon={<Building2 size={22} />}
            name="TEMPLE TRUST"
            color="#92400e" bg="#fffbeb"
            task={scenario.temple}
            isAcked={templeAck}
            onAck={() => setTempleAck(true)}
          />
          <AgencyConfirmCard
            icon={<Bus size={22} />}
            name="GSRTC TRANSPORT"
            color="#166534" bg="#f0fdf4"
            task={scenario.gsrtc}
            isAcked={gsrtcAck}
            onAck={() => setGsrtcAck(true)}
          />
        </div>

        {/* Final confirm button — only enabled when all 3 checked */}
        <div style={{ marginTop: '1.5rem', paddingBottom: '2rem' }}>
          <button
            className="btn btn-success"
            style={{ width: '100%', padding: '1rem', fontSize: '1rem', opacity: allDone ? 1 : 0.4, cursor: allDone ? 'pointer' : 'not-allowed' }}
            disabled={!allDone}
            onClick={handleAllAgenciesConfirmed}
          >
            <CheckCircle size={20} />
            {allDone ? 'ALL AGENCIES CONFIRMED - RETURN TO DASHBOARD' : `Confirm all 3 agencies to continue (${[policeAck, templeAck, gsrtcAck].filter(Boolean).length}/3 done)`}
          </button>
        </div>
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     HOME PAGE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="dashboard-container">

      {/* ── MODAL OVERLAY (Step 1 & 2) ──────────────────────────── */}
      {appLocked && (
        <div className="modal-overlay">

          {/* STEP 1: Did you take action? */}
          {modal === 'ask' && (
            <div className="modal-box shadow-xl" style={{ borderTop: '8px solid #ef4444', maxWidth: 480 }}>
              <div style={{ textAlign: 'center', color: '#ef4444', marginBottom: '1rem' }}>
                <AlertTriangle size={60} style={{ animation: 'pulse-icon 1.5s infinite' }} />
              </div>
              <h2 style={{ textAlign: 'center', marginBottom: '0.4rem', fontSize: '1.35rem', color: '#0f172a' }}>
                ⚠️ {scenario.headline}
              </h2>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.88rem', marginBottom: '0.4rem' }}>
                {scenario.subtext}
              </p>
              <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                📍 <strong>{city} - {scenario.location}</strong> &nbsp;|&nbsp; ⏰ <strong>{eventTime}</strong>
              </p>
              <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1.05rem', marginBottom: '1.75rem', color: '#0f172a' }}>
                Did you take any action or not?
              </p>
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

          {/* STEP 2: Full escalation + "Go to Agency Page" */}
          {modal === 'warn' && (
            <div className="modal-box shadow-xl" style={{ borderTop: '8px solid #ef4444', maxWidth: 540 }}>
              <h2 style={{ color: '#ef4444', marginBottom: '0.4rem', fontSize: '1.25rem' }}>
                🚨 IMMEDIATE ACTION REQUIRED
              </h2>
              <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {scenario.subtext}. Immediate coordinated action is required from all agencies.
              </p>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: 1.8 }}>
                <div><MapPin size={13} style={{ verticalAlign: 'middle' }} /> <strong>Location:</strong> {city} - {scenario.location}</div>
                <div><Clock size={13} style={{ verticalAlign: 'middle' }} /> <strong>Alert Time:</strong> {eventTime}</div>
                <div>⏳ <strong>Duration:</strong> {scenario.duration}</div>
              </div>

              {/* Agency summary (read-only) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <AgencyRow icon={<UserCheck size={16} />} color="#1e3a8a" agency="District Police"  action={scenario.police} />
                <AgencyRow icon={<Building2 size={16} />} color="#92400e" agency="Temple Trust"     action={scenario.temple} />
                <AgencyRow icon={<Bus size={16} />}       color="#166534" agency="GSRTC Transport"  action={scenario.gsrtc} />
              </div>

              <button className="btn btn-danger" style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
                onClick={handleGoToAgencyPage}>
                <ArrowRight size={18} /> CONFIRM ALL AGENCY TASKS
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MAIN DASHBOARD (blurs behind modal) ─────────────────── */}
      <div style={{ filter: appLocked ? 'blur(5px) grayscale(30%)' : 'none', pointerEvents: appLocked ? 'none' : 'auto', transition: 'filter 0.3s' }}>

        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldAlert size={28} color="#2563eb" />
            <span style={{ fontWeight: 800, fontSize: '1.4rem', color: '#1e293b' }}>CROWD SHIELD</span>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '0.5rem' }}>Multi-Agency Dashboard</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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
                          <td style={{ color: '#94a3b8' }}>{l.time}</td>
                          <td style={{ fontWeight: 600 }}>{l.detail}</td>
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
=======
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PYTHON_BACKEND_URL = 'http://127.0.0.1:5000/api';
const THRESHOLD_HIGH = 150; // Threshold matching backend logic

const CITY_LOCATIONS = {
  'Somnath': [20.9060, 70.4012],
  'Pavagadh': [22.4646, 73.5238],
  'Ambaji': [24.3310, 72.8510],
  'Dwarka': [22.2442, 68.9685]
};

function App() {
  const [activeCity, setActiveCity] = useState('Somnath');
  const [dataset, setDataset] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [chartData, setChartData] = useState([]);
  
  const [prediction, setPrediction] = useState({
    current_pressure: 0,
    predicted_pressure: 0,
    risk_level: "LOW",
    predicted_minutes_to_high_risk: 0,
    trend_slope: 0,
    surge_type: "momentary"
  });

  const [alertActive, setAlertActive] = useState(false);
  const [alertStartTime, setAlertStartTime] = useState(null);
  
  const [agencyResponses, setAgencyResponses] = useState({
    Police: { status: 'Pending', time: null },
    Temple: { status: 'Pending', time: null },
    Transport: { status: 'Pending', time: null }
  });

  const [eventLogs, setEventLogs] = useState([]);

  // Load Data based on activeCity
  useEffect(() => {
    setCurrentIndex(0);
    setIsReplaying(false);
    setEventLogs([]);
    setAlertActive(false);

    axios.get(`${PYTHON_BACKEND_URL}/data?location=${activeCity}`)
      .then(res => {
        setDataset(res.data.data || []);
      })
      .catch(err => console.error(err));
  }, [activeCity]);

  // Replay Simulator Loop
  useEffect(() => {
    let timer;
    if (isReplaying && dataset.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= dataset.length - 1) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // 1.5 seconds per step
    }
    return () => clearInterval(timer);
  }, [isReplaying, dataset]);

  // Process data at current step
  useEffect(() => {
    if (dataset.length === 0) return;

    const historySize = 30; // Points for line chart
    const predictionSize = 6; // Points for risk prediction
    
    const sliceStart = Math.max(0, currentIndex - historySize);
    const historyData = dataset.slice(sliceStart, currentIndex + 1);
    
    const predictData = dataset.slice(Math.max(0, currentIndex - predictionSize), currentIndex + 1);

    // Prepare chart data (pressure calculation)
    const formattedChartData = historyData.map((d, i) => {
      let pressure = 0;
      if (d.corridor_width_m > 0) {
        pressure = (d.entry_flow_rate_pax_per_min + d.transport_arrival_burst) / d.corridor_width_m;
      }
      return { time: String(i), pressure };
    });
    setChartData(formattedChartData);

    // Call predict API
    axios.post(`${PYTHON_BACKEND_URL}/predict`, { history: predictData })
      .then(res => {
        const pred = res.data;
        setPrediction(pred);

        // Check Risk & trigger alert
        if (pred.risk_level === 'HIGH' && !alertActive) {
          setAlertActive(true);
          setAlertStartTime(Date.now());
          
          Object.keys(agencyResponses).forEach(agency => {
            agencyResponses[agency] = { status: 'Pending', time: null };
          });
          setAgencyResponses({...agencyResponses});

          logEvent(pred.current_pressure, "HIGH", "System triggered HIGH RISK multi-agency alert");
        } 
      })
      .catch(err => console.error(err));
  }, [currentIndex, dataset]);

  const logEvent = (pressure, risk, action) => {
    setEventLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString(),
        pressure: Number(pressure).toFixed(1),
        risk,
        action
      },
      ...prev
    ]);
  };

  const handleAcknowledge = (agencyName) => {
    if (!alertStartTime) return;
    const timeTaken = ((Date.now() - alertStartTime) / 1000).toFixed(1);
    
    setAgencyResponses(prev => ({
      ...prev,
      [agencyName]: { status: 'Acknowledged', time: timeTaken }
    }));

    logEvent(prediction.current_pressure, prediction.risk_level, `${agencyName} Response Acknowledged in ${timeTaken}s`);
  };

  const toggleSimulation = () => {
    if (currentIndex >= dataset.length - 1) {
      setCurrentIndex(0);
      setEventLogs([]);
      setAlertActive(false);
    }
    setIsReplaying(!isReplaying);
  };

  // UI Helpers
  const riskColorClass = `risk-${prediction.risk_level}`;
  let predictionText = "System operating normally";
  if (prediction.risk_level === 'HIGH') {
    predictionText = "CRITICAL: Threshold breached. Immediate action required.";
  } else if (prediction.predicted_minutes_to_high_risk > 0) {
    predictionText = `Crush risk expected in ${prediction.predicted_minutes_to_high_risk.toFixed(0)} minutes`;
  } else if (prediction.risk_level === 'MEDIUM') {
    predictionText = "Elevated crowd pressure detected.";
  }

  const dynamicIcon = new L.Icon({
    iconUrl: prediction.risk_level === 'HIGH'
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
      : prediction.risk_level === 'MEDIUM' 
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png'
      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const standardIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  return (
    <div className="dashboard-layout">
      {/* HEADER & REPLAY BUTTON */}
      <header className="header-bar">
        <div className="title-area">
          <ShieldAlert size={32} color="#3b82f6" />
          <span className="title-text">Stampede Window Predictor (CrowdShield)</span>
        </div>
        <button 
          className={`btn-replay ${isReplaying ? 'active' : ''}`}
          onClick={toggleSimulation}
        >
          {isReplaying ? <Pause size={20} /> : <Play size={20} />}
          {isReplaying ? 'PAUSE SIMULATION' : 'REPLAY SIMULATION'}
        </button>
      </header>

      {/* 1. TOP SECTION (Main Info Bar) */}
      <div className="top-section">
        <div className="info-card">
          <span className="info-label">Current Corridor Pressure Index</span>
          <span className={`info-value ${riskColorClass}`}>
            {prediction.current_pressure.toFixed(1)} <span style={{fontSize:'1rem', color:'var(--text-muted)'}}>pax/m</span>
          </span>
        </div>
        <div className="info-card">
          <span className="info-label">Live Risk Level</span>
          <span className={`info-value ${riskColorClass}`}>
            {prediction.risk_level}
          </span>
        </div>
        <div className="info-card" style={{borderLeft: prediction.risk_level==='HIGH'?'4px solid var(--danger)':''}}>
          <span className="info-label">Prediction Status</span>
          <span className="info-value" style={{fontSize: '1.25rem', color: prediction.risk_level==='HIGH'?'var(--danger)':'var(--text-main)', marginTop:'0.5rem'}}>
            {predictionText}
          </span>
          {prediction.surge_type === 'momentary' && prediction.risk_level !== 'LOW' && (
            <span style={{color: 'var(--safe)', fontSize:'0.85rem', marginTop:'0.5rem'}}>(AI Classifier: Momentary safe surge)</span>
          )}
          {prediction.surge_type === 'genuine' && (
             <span style={{color: 'var(--danger)', fontSize:'0.85rem', marginTop:'0.5rem'}}>(AI Classifier: Genuine crush buildup)</span>
          )}
        </div>
      </div>

      <div className="main-grid">
        {/* LEFT PANELS */}
        <div className="left-panels">
          <div className="map-section">
             <h2 className="section-title"><MapPin size={20}/> Target Location Map ({activeCity} Corridor)</h2>
             <MapContainer center={[22.3094, 71.1843]} zoom={6} scrollWheelZoom={false}>
               <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
               {Object.entries(CITY_LOCATIONS).map(([cityName, coords]) => (
                 <Marker 
                   key={cityName} 
                   position={coords} 
                   icon={cityName === activeCity ? dynamicIcon : standardIcon}
                   eventHandlers={{
                     click: () => setActiveCity(cityName)
                   }}
                 >
                   <Popup>
                     <strong>{cityName} Corridor</strong><br/>
                     {cityName === activeCity ? `Risk Level: ${prediction.risk_level}` : 'Click to Monitor Data'}
                   </Popup>
                 </Marker>
               ))}
             </MapContainer>
          </div>

          {/* 2. GRAPH SECTION (Center Left) */}
          <div className="graph-section">
            <h2 className="section-title"><Activity size={20}/> Pressure Timeline vs Time</h2>
            <div style={{ flex: 1, width: '100%', minHeight:'300px' }}>
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 200]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                  itemStyle={{ color: '#fff' }}
                />
                <ReferenceLine y={THRESHOLD_HIGH} label={{ position: 'top', value: 'Danger Threshold', fill: '#ef4444', fontSize: 12 }} stroke="#ef4444" strokeDasharray="5 5" />
                <Line 
                  type="monotone" 
                  dataKey="pressure" 
                  stroke={prediction.risk_level === 'HIGH' ? '#ef4444' : '#3b82f6'} 
                  strokeWidth={3} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </div> {/* End left-panels */}

        {/* 3 & 4. RIGHT PANELS */}
        <div className="right-panels">
          
          {/* 3. ALERT PANEL */}
          <div className={`alert-panel ${alertActive ? 'active-alert' : ''}`}>
            {alertActive ? (
              <>
                <div className="alert-header">
                  <AlertTriangle size={24} className="pulse-icon" /> 
                  🚨 HIGH RISK ALERT
                </div>
                <p style={{fontSize:'0.9rem', color:'var(--text-main)'}}>Recommended Actions:</p>
                <ul className="action-list">
                  <li><strong>Police</strong> &#8594; Deploy officers to choke point</li>
                  <li><strong>Temple</strong> &#8594; Stop entry / hold darshan</li>
                  <li><strong>Transport</strong> &#8594; Hold incoming vehicles</li>
                </ul>
              </>
            ) : (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--safe)', opacity: 0.8}}>
                <CheckCircle size={48} style={{marginBottom:'1rem'}}/>
                <h3 style={{fontWeight:600}}>System Normal</h3>
                <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>No active alerts at this time.</p>
              </div>
            )}
          </div>

          {/* 4. RESPONSE TRACKING PANEL */}
          <div className="info-card" style={{alignItems:'flex-start', padding:'1.5rem'}}>
            <h2 className="section-title" style={{width:'100%', marginBottom:'0'}}><Clock size={20}/> Agency Response Tracking</h2>
            <table className="response-table">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Status</th>
                  <th>Response Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(agencyResponses).map(([agency, data]) => (
                  <tr key={agency}>
                    <td style={{fontWeight:600}}>{agency}</td>
                    <td>
                      <span className={`status-badge ${data.status.toLowerCase()}`}>
                        {data.status}
                      </span>
                    </td>
                    <td>{data.time ? `${data.time} s` : '--'}</td>
                    <td>
                      {data.status !== 'Acknowledged' ? (
                        <button 
                          className="btn-ack" 
                          onClick={() => handleAcknowledge(agency)}
                          disabled={!alertActive}
                          style={{opacity: !alertActive ? 0.3 : 1, cursor: !alertActive ? 'not-allowed' : 'pointer'}}
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span style={{color:'var(--safe)'}}>&#10003;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. EVENT LOG (Bottom Section) */}
      <div className="event-log-section">
        <h2 className="section-title">System Event Log</h2>
        <div className="log-table-container">
          <table className="log-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Pressure</th>
                <th>Risk Level</th>
                <th>Action Taken</th>
              </tr>
            </thead>
            <tbody>
              {eventLogs.length > 0 ? (
                eventLogs.map((log, i) => (
                  <tr key={i}>
                    <td style={{color:'var(--text-muted)'}}>{log.timestamp}</td>
                    <td style={{fontWeight:600}}>{log.pressure}</td>
                    <td><span className={`risk-${log.risk}`} style={{fontWeight:700}}>{log.risk}</span></td>
                    <td>{log.action}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" style={{textAlign:'center', color:'var(--text-muted)', padding:'2rem'}}>
                    No events recorded yet. Run simulation to populate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
>>>>>>> 0799b0d790880040d2d56f37f44af788cd9dc9c9
    </div>
  );
}

<<<<<<< HEAD
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
=======
export default App;
>>>>>>> 0799b0d790880040d2d56f37f44af788cd9dc9c9
