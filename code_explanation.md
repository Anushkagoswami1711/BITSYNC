# CrowdShield: Complete Code Explanation
*Use this guide to explain the code and project flow during the hackathon presentation.*

---

## 1. The Core Idea

Our project has two main pieces:

**The Backend (Python/Flask):** The "Brain". It reads raw data (`TS-PS11.csv`), calculates crowd pressure using physics-based formulas, classifies crowd patterns (Surge vs Crush), predicts future risk, and can send SMS alerts via Twilio.

**The Frontend (React.js/Vite):** The "Face". It talks to the backend, runs a visual simulation, draws real-time charts, shows interactive maps, triggers emergency pop-ups with alarm sounds, and routes operators through a multi-agency confirmation workflow.

---

## 2. Backend: `backend/app.py`

Written using **Flask** — a lightweight Python web framework that exposes our logic as REST APIs.

### 2.1 Pressure Calculation: `calculate_pressure()`
Custom physics-based formula:
```
Pressure = (Entry Flow Rate + Transport Burst) / Corridor Width
```
**For Faculty:** "To measure true crowd density, you can't just count people. You must divide the number of people entering by the physical corridor width. 100 people in a 2m corridor is far more dangerous than 100 people in a 10m corridor."

### 2.2 Predictive Engine: `predict_future_risk()`
Uses linear slope projection, not heavy ML, because crowd crush prediction requires fast, interpretable physics.
- Looks at the last 5-6 data points
- Calculates the **trend slope** (rate of pressure change)
- Projects pressure **10 minutes into the future**
- Classifies risk as `LOW` / `MEDIUM` / `HIGH` based on thresholds (100 and 150 pax/m)
- Calculates **minutes until high risk** (the "Crush Window")
- Returns a `surge_type` flag (genuine buildup vs momentary spike)

**For Faculty:** "We used linear slope prediction. We look at the last 5 minutes, draw a best-fit line, and project where pressure will be in 10 minutes. If that crosses 150 pax/m, we trigger the alarm today, not when it's too late."

### 2.3 Pattern Classifier: `classify_pattern()`
Differentiates between a temporary crowd spike (safe) and a continuous dangerous buildup.
- Takes the last 5 pressure values
- Finds the peak pressure and its position
- If the **peak is at the end** (still rising) → returns `"CRUSH"`
- If pressure **dropped 10%+ from peak** (spike then fall) → returns `"SURGE"`

**For Faculty:** "Not every spike is dangerous. A bus arrival causes a temporary surge that naturally dissipates. But if pressure keeps climbing without dropping, that's a crush buildup. Our classifier distinguishes these two patterns in real-time so operators don't panic over false alarms."

### 2.4 API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/data?location=Somnath` | GET | Returns up to 500 rows of city-specific data |
| `/api/predict` | POST | Takes history array, returns pressure, risk, pattern, crush window |

### 2.5 Background SMS Alert System
A daemon thread runs `background_sms_job()` every 60 seconds.
- Reads the next data point from the global dataset
- Runs the prediction pipeline
- Prints a console alert
- If Twilio credentials are configured, sends an SMS to authorities

**For Faculty:** "A dashboard is useless if nobody is watching. We programmed a background loop that checks every 60 seconds. If it detects danger, it automatically texts police and temple authorities using Twilio."

---

## 3. Frontend: `frontend/src/App.jsx`

Written in React with Vite as the build tool. Uses Recharts for graphs, Leaflet for maps, and Lucide for icons.

### 3.1 Page Routing (No React Router needed)
The app has two pages managed by a simple `page` state variable:
- **`home`** — Main dashboard with charts, map, simulation controls
- **`agency`** — Full-screen agency deployment confirmation page

**For Faculty:** "We didn't need a heavy routing library. A single state variable switches between the dashboard view and the agency confirmation view — lightweight and fast."

### 3.2 Data Loading (`useEffect` on city change)
When the operator selects a city (Somnath, Pavagadh, Ambaji, or Dwarka) by clicking a map marker:
1. Resets all state (chart, logs, index, emergency flags)
2. Fetches that city's data from `/api/data?location=CityName`
3. Processes the first data point to initialize the display

### 3.3 Simulation Loop (Replay Mode)
The simulation uses `setInterval` with a configurable speed:
- **Speed selector** in the header: `0.5×` (3s) / `1×` (1.5s) / `2×` (750ms) / `5×` (300ms)
- **Play/Pause** button starts and stops the interval
- **Reset** button resets index to 0, clears chart and logs, reloads the first data point
- Each tick advances to the next data row and calls `processStep()`

**For Faculty:** "To demo real-world conditions, we built a configurable time-loop. Every tick, it feeds the next minute of data to our prediction model. The speed selector lets us show hours of data in seconds during a demo."

### 3.4 Core Step Processor: `processStep()`
Called on every simulation tick:
1. Slices the last 20 points for the chart
2. Sends the last 6 points to `/api/predict`
3. Updates pressure, risk level, pattern, and crush window
4. If `risk_level === 'HIGH'` → triggers the emergency sequence

### 3.5 Surge vs Crush Badge
Displayed inside the Pressure Index card:
- **CRUSH BUILDUP 🚨** (red) — pressure is continuously increasing, danger
- **TEMPORARY SURGE ✅** (green) — pressure spiked but is now falling, safe
- **ANALYSING...** (grey) — while initial data is loading

**For Faculty:** "This badge gives operators instant visual context. A red 'CRUSH BUILDUP' means escalating danger. A green 'TEMPORARY SURGE' means the spike is natural and subsiding — like a bus arrival. It prevents unnecessary panic."

### 3.6 Emergency Trigger Sequence
When `risk_level === 'HIGH'`:
1. A random **emergency scenario** is selected from a pool of 5 unique real-world archetypes
2. Simulation **pauses** automatically
3. An **alarm sound** plays (looping)
4. The dashboard **blurs** and locks
5. A **Step 1 modal** appears: "Did you take any action or not?"

### 3.7 Dynamic Emergency Scenarios
Five distinct scenario archetypes, each with unique:
- Headline (e.g., "MASS SURGE AT ENTRY GATE", "CORRIDOR BOTTLENECK")
- Context subtext
- Specific location within the city
- Duration (15-30 minutes based on severity)
- Tailored instructions for each of the 3 agencies

**For Faculty:** "We built 5 distinct emergency scenarios that randomize on each alert. This demonstrates the system's versatility — it doesn't give the same instruction every time, it adapts to the situation. During a demo, you'll see a different scenario each time HIGH risk triggers."

### 3.8 Two-Step Emergency Modal Flow

**Step 1 — Action Check:**
- Question: "Did you take any action or not?"
- **YES** → alarm stops, simulation resumes, logged as "Operator confirmed action taken"
- **NO** → escalates to Step 2

**Step 2 — Escalation Brief:**
- Shows the full emergency card with scenario headline, location, time, duration
- Displays read-only agency-specific instructions for Police, Temple, Transport
- Button: **"CONFIRM ALL AGENCY TASKS →"** → navigates to the Agency Confirmation page

**For Faculty:** "This is a forced-acknowledgment protocol. The operator cannot ignore the warning — the interface locks until they respond. If they haven't acted, the system escalates with detailed instructions and sends them to confirm each agency deployment individually."

### 3.9 Agency Confirmation Page
A dedicated full-screen page showing:
- Emergency context (location, time, duration)
- Three agency cards, each with their scenario-specific task
- Individual **Confirm Deployment** buttons per agency
- A final **"ALL AGENCIES CONFIRMED — RETURN TO DASHBOARD"** button that only unlocks when all 3 agencies are confirmed (shows progress: 0/3, 1/3, 2/3, 3/3)

**For Faculty:** "This enforces a real-world protocol. In actual disasters, each agency must independently confirm they've deployed. Our system won't let the operator return to monitoring until all three agencies — Police, Temple Trust, and GSRTC Transport — have confirmed their actions."

### 3.10 Interactive Map (Leaflet)
- Shows 4 Gujarat pilgrim cities: Somnath, Pavagadh, Ambaji, Dwarka
- Click any marker to switch monitoring to that city
- Active city marker is **blue** (or **red** during HIGH risk)
- Inactive markers are **grey**

### 3.11 Pressure Timeline Chart (Recharts)
- Displays the last 20 data points as a line chart
- Red dashed reference line at the 150 pax/m danger threshold
- Line color changes: **blue** (normal) → **red** (HIGH risk)
- Tooltip shows exact pressure on hover

### 3.12 Event Log
A scrollable table that records every significant event with timestamps:
- HIGH RISK detections with scenario name and pressure reading
- Operator confirmations
- Agency deployment confirmations
- Simulation resume events

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite, Recharts, Leaflet.js, Lucide-React, Axios |
| Backend | Flask (Python), Pandas, Twilio |
| Data | TS-PS11.csv (crowd simulation dataset) |
| Communication | REST APIs (JSON over HTTP) |

---

## 5. How to Run

```bash
# Terminal 1 — Backend
cd backend
pip install flask flask-cors pandas twilio
python app.py
# Runs on http://127.0.0.1:5000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 6. File Structure

```
BITSYNC/
├── TS-PS11.csv              # Crowd simulation dataset
├── code_explanation.md       # This file
├── backend/
│   ├── app.py               # Flask API + prediction + classifier + SMS
│   └── requirements.txt     # Python dependencies
└── frontend/
    ├── index.html            # Entry HTML
    ├── vite.config.js        # Vite configuration
    ├── package.json          # Node dependencies
    └── src/
        ├── App.jsx           # Main React component (all logic + UI)
        └── index.css         # Global styles + animations
```

---

## 7. Key Design Decisions

1. **Linear slope over ML:** Crowd crush is a physics problem, not a pattern recognition problem. A simple slope is faster, more interpretable, and more reliable than a neural network for this use case.

2. **Scenario randomization:** Prevents "demo blindness" — judges see a different emergency each time, proving the system is versatile.

3. **Forced acknowledgment:** The blur-lock guarantees zero operator negligence. This is borrowed from aviation cockpit design where alerts cannot be dismissed without action.

4. **Page-based agency flow:** Separates the monitoring (dashboard) from the response (agency page). The operator can't return to monitoring until all agencies confirm — just like real multi-agency coordination protocols.

5. **Pattern classifier (Surge vs Crush):** Reduces false alarms. A temporary bus arrival spike is fundamentally different from a sustained dangerous buildup — our classifier tells the operator which one they're facing.
