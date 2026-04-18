# CrowdShield: Beginner-Friendly Code Explanation
*Use this guide to easily explain the code and project flow to your faculty during the hackathon presentation.*

---

## 1. The Core Idea (How it works in plain english)
Our project has two main pieces:
**The Backend (Python):** Think of this as the "Brain". It reads our raw data (`TS-PS11.csv`), does the math to figure out crowd pressure, and predicts if things will get dangerous.
**The Frontend (React.js):** Think of this as the "Face". It talks to the Backend brain, asks for the data, and draws the beautiful charts, pop-ups, and alerts you see on screen.

## 2. Explaining `backend/app.py` (The Python Brain)
This file is written using **Flask**, which is just a tool to make our Python code accessible over the internet via "URLs" (called APIs).

### The Math: `calc_pressure`
We created a custom formula to calculate **Crowd Pressure**.
```python
Pressure = (Entry Flow + Transport Burst) / Corridor Width
```
* **Explanation for Faculty:** "Sir/Ma'am, to know the true density of a crowd, you can't just count people. You must divide the *number of people entering* by the *physical width of the corridor*. A corridor 2 meters wide handling 100 people is much more dangerous than a corridor 10 meters wide handling 100 people. Our math reflects this."

### The AI Prediction: `get_prediction_for_history`
We didn't use an overly complex Machine Learning model because predicting crowd crushing requires simple, fast physics.
Instead of heavy AI, we look at the **trend (slope)** of the line. If pressure went from 50 -> 60 -> 70, the slope is positive `+10`.
* **Explanation for Faculty:** "We used linear slope prediction. We look at the last 5 minutes of data, draw a line of best fit, and mathematically project where the pressure will be 10 minutes in the future. If that future pressure crosses our 'High Risk Threshold' (150 people per meter), we trigger the alarm today, not when it's too late."

### Background Real-Time Alert System
There is a background setup running `real_time_job()` every 60 seconds.
* **Explanation for Faculty:** "A dashboard is useless if nobody is looking at it. We programmed a background loop that checks the math every 60 seconds. If it detects danger, it uses an external service (Twilio) to automatically text message the police and temple authorities instantly."

---

## 3. Explaining `frontend/src/App.jsx` (The React Face)
This file handles everything you see on the screen. It is written in React, which builds websites using "Components" (like building blocks).

### Fetching the Data (`useEffect` hooks)
`useEffect` is a React command that basically says: *"As soon as the page loads, do this."*
In our code, as soon as the page loads, it asks Python for the dataset using a system called `axios`. 

### The Play/Pause Simulation Loop
To demonstrate the project without waiting real hours, we built a simulation loop using Javascript's `setTimeout`.
* **How it works:** It grabs one row of data from our dataset, waits 1.5 seconds, then grabs the next row. It's like fast-forwarding security camera footage.
* **Explanation for Faculty:** "To demo real-world conditions, I programmed an asynchronous time-loop. Every 1.5 seconds, it feeds the newest minute of data to our prediction model so you can watch the system react in real-time."

### The "Emergency Lock" mechanism
When the python brain tells React `risk_level == 'HIGH'`, a massive sequence triggers:
1. `isPlaying` is forced to `false` (pausing the simulation).
2. The code applies a CSS `blur(6px)` to the background to lock out the user.
3. An HTML `Audio` object plays an alarm siren.
4. `showActionModal` is turned to `true`, forcing the pop-up boxes you see on screen to appear.

* **Explanation for Faculty:** "Upon predicting high-risk, the frontend triggers a forced-acknowledgment protocol. It blurs the interface and rings an alarm to prevent the operator from ignoring the warning. The app forcefully locks itself until the operator clicks 'Yes, Action Taken'. We did this to guarantee zero operator negligence in extreme situations."
