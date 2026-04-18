import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
from twilio.rest import Client
import threading
import time
import datetime
import logging

app = Flask(__name__)
CORS(app)

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

TWILIO_ACCOUNT_SID = 'your_account_sid_here'
TWILIO_AUTH_TOKEN = 'your_auth_token_here'
TWILIO_FROM_PHONE = '+1234567890'
USER_PHONE_NUMBER = '+9512890999'

def load_data():
    try:
        df = pd.read_csv('../TS-PS11.csv')
    except Exception:
        df = pd.read_excel('../TS-PS11.csv')
    
    df = df.fillna(0)
    return df

global_df = load_data()

def calculate_pressure(data_point):
    entering_people = float(data_point.get('entry_flow_rate_pax_per_min', 0))
    transport_burst = float(data_point.get('transport_arrival_burst', 0))
    width_of_corridor = float(data_point.get('corridor_width_m', 1))

    if width_of_corridor <= 0: 
        width_of_corridor = 1

    total_people = entering_people + transport_burst
    pressure = total_people / width_of_corridor
    return pressure

def predict_future_risk(history_list):
    pressures = []
    for item in history_list:
        pressures.append(calculate_pressure(item))

    if len(pressures) == 0:
        return 0, 0, "LOW", 0, 0, "momentary"

    current_pressure = pressures[-1]

    if len(pressures) > 1:
        first_pressure = pressures[0]
        last_pressure = pressures[-1]
        slope = (last_pressure - first_pressure) / len(pressures)
    else:
        slope = 0
        
    # Predict 8-12 minutes ahead, average 10
    prediction_minutes = 10
    predicted_pressure = current_pressure + (slope * prediction_minutes)
    
    if predicted_pressure < 0: 
        predicted_pressure = 0
    
    threshold_high = 150
    threshold_medium = 100
    
    worst_case_scenario = max(current_pressure, predicted_pressure)
    
    risk_level = "LOW"
    if worst_case_scenario >= threshold_high:
        risk_level = "HIGH"
    elif worst_case_scenario >= threshold_medium:
        risk_level = "MEDIUM"

    time_to_risk = 0
    if risk_level == "HIGH":
        if current_pressure >= threshold_high:
            time_to_risk = 0
        elif slope > 0:
            time_to_risk = (threshold_high - current_pressure) / slope
        else:
            time_to_risk = prediction_minutes
            
    elif risk_level == "MEDIUM" and slope > 0:
        time_to_risk = (threshold_high - current_pressure) / slope
        
    # Classifier: genuine buildup vs momentary surge
    surge_type = "momentary"
    if len(pressures) >= 5:
        # Check if slope is consistently increasing over last 5 points
        recent_slopes = []
        for i in range(1, len(pressures)):
            recent_slopes.append(pressures[i] - pressures[i-1])
        avg_recent_slope = sum(recent_slopes) / len(recent_slopes)
        if avg_recent_slope > 5 and slope > 2:  # Thresholds for genuine buildup
            surge_type = "genuine"
    
    return current_pressure, predicted_pressure, risk_level, time_to_risk, slope, surge_type

@app.route('/api/data', methods=['GET'])
def send_data_to_react():
    requested_city = request.args.get('location', 'Somnath')
    city_data = global_df[global_df['location'] == requested_city]
    short_list = city_data.head(500)
    
    return jsonify({
        "status": "success", 
        "data": short_list.to_dict(orient='records')
    })

@app.route('/api/predict', methods=['POST'])
def send_prediction_to_react():
    request_data = request.json
    history_data = request_data.get('history', [])
    current, predicted, risk, time_to_risk, slope, surge_type = predict_future_risk(history_data)
    
    return jsonify({
        "current_pressure": current,
        "predicted_pressure": predicted,
        "risk_level": risk,
        "predicted_minutes_to_high_risk": time_to_risk,
        "trend_slope": slope,
        "surge_type": surge_type
    })

SIMULATION_INDEX = 0
def background_sms_job():
    global SIMULATION_INDEX
    while True:
        time.sleep(60)
        if SIMULATION_INDEX < len(global_df):
            history_slice = global_df.iloc[max(0, SIMULATION_INDEX-5) : SIMULATION_INDEX+1]
            history_list = history_slice.to_dict(orient='records')
            
            current, predicted, risk, _, _, _ = predict_future_risk(history_list)
            
            timestamp = datetime.datetime.now().strftime('%H:%M:%S')
            sms_text = f"[CROWD SHIELD ALERT - {timestamp}]\nRisk: {risk}\nCurrent: {round(current,2)} pax/m\nPredicted: {round(predicted,2)} pax/m."
            print(f"\n--- REAL TIME UPDATE ---\n")
            print(sms_text)
            print("-" * 24 + "\n")
                
            if TWILIO_ACCOUNT_SID != 'your_account_sid_here':
                try:
                    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                    client.messages.create(body=sms_text, from_=TWILIO_FROM_PHONE, to=USER_PHONE_NUMBER)
                    print(f"SMS correctly sent to {USER_PHONE_NUMBER}")
                except Exception as e:
                    print(f"Twilio connection failed: {e}")

            SIMULATION_INDEX += 1

threading.Thread(target=background_sms_job, daemon=True).start()

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, port=5000)
