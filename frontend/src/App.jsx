import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
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

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
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
    </div>
  );
}

export default App;
