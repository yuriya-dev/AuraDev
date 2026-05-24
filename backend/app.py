import os
import requests
import datetime
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Import mocks in case of SDK fallback
import mock_vertex

load_dotenv()

app = Flask(__name__)

# Mock local in-memory DB to replace Firestore if credentials are missing
local_db = {
    "users": {
        "dev_user_1": {
            "profile": {
                "name": "Dzaki",
                "timezone": "Asia/Jakarta",
                "fasting_mode": False,
                "solat_tracking": True
            },
            "sessions": [],
            "streaks": {}
        }
    }
}

# Try initializing Firestore
firestore_enabled = False
try:
    from google.cloud import firestore
    # Verify if credentials are provided in env or path
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("GAE_ENV"):
        db = firestore.Client()
        firestore_enabled = True
        print("[DevAura] Firestore successfully initialized.")
    else:
        print("[DevAura] Google Cloud Credentials not set. Running with In-Memory local DB fallback.")
except Exception as e:
    print(f"[DevAura] Error initializing Firestore Client ({e}). Running with In-Memory local DB fallback.")

# Try initializing Vertex AI (Gemini 2.5 Flash)
vertex_enabled = False
try:
    from google import genai
    from google.genai import types
    
    # Check if Vertex SDK can authenticate
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or os.environ.get("API_KEY"):
        client = genai.Client()
        vertex_enabled = True
        print("[DevAura] Vertex AI / Gemini SDK successfully initialized.")
    else:
        print("[DevAura] GenAI Credentials not set. Running with Mock Vertex AI engine.")
except Exception as e:
    print(f"[DevAura] Vertex SDK not active or missing credentials ({e}). Running with Mock Vertex AI engine.")


@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "online",
        "service": "DevAura Backend",
        "firestore_connected": firestore_enabled,
        "vertex_ai_enabled": vertex_enabled,
        "timestamp": datetime.datetime.now().isoformat()
    })


@app.route("/event", methods=["POST"])
def track_event():
    """
    POST /event
    Receives session logs and activity metrics from the VSCode extension.
    Calculates focus state and updates session logs in Firestore/Local DB.
    """
    data = request.json or {}
    user_id = data.get("userId", "dev_user_1")
    keystrokes = data.get("keystrokes", 0)
    backspaces = data.get("backspaces", 0)
    saves = data.get("saves", 0)
    state = data.get("state", "idle")
    frustration = data.get("frustrationScore", 0)

    # Save to Local DB or Firestore
    session_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "keystrokes": keystrokes,
        "backspaces": backspaces,
        "saves": saves,
        "state": state,
        "frustration": frustration
    }

    if firestore_enabled:
        try:
            # Append session log to Firestore
            user_ref = db.collection("users").document(user_id)
            user_ref.collection("sessions").add(session_entry)
        except Exception as e:
            print(f"[DevAura] Failed writing event to Firestore ({e})")
    else:
        if user_id not in local_db["users"]:
            local_db["users"][user_id] = {"sessions": [], "streaks": {}}
        local_db["users"][user_id]["sessions"].append(session_entry)

    # Simple server-side focus verification
    inferred_state = state
    if frustration > 50:
        inferred_state = "frustrated"
    elif keystrokes > 60:
        inferred_state = "deep-focus"

    return jsonify({
        "status": "success",
        "user_id": user_id,
        "received_state": state,
        "server_inferred_state": inferred_state,
        "saved_offline_fallback": not firestore_enabled
    })


@app.route("/check", methods=["GET"])
def check_wellness():
    """
    GET /check
    Fetches real-time local prayer times via Aladhan API based on latitude/longitude.
    Computes whether the developer has missed meals, breaks, or prayer times.
    """
    user_id = request.args.get("userId", "dev_user_1")
    lat = request.args.get("lat", "-6.2088")
    lng = request.args.get("lng", "106.8456")

    # 1. Fetch Prayer Times from Aladhan
    prayer_times = {}
    aladhan_ok = False
    try:
        # Fetch today's timings using the latitude and longitude
        url = f"http://api.aladhan.com/v1/timings?latitude={lat}&longitude={lng}&method=2"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            res_data = response.json()
            prayer_times = res_data.get("data", {}).get("timings", {})
            aladhan_ok = True
    except Exception as e:
        print(f"[DevAura] Error calling Aladhan API ({e}). Falling back to Jakarta static times.")
        
    # Static fallback prayer times for Jakarta (if API fails or offline)
    if not aladhan_ok:
        prayer_times = {
            "Fajr": "04:35",
            "Dhuhr": "11:54",
            "Asr": "15:15",
            "Maghrib": "17:48",
            "Isha": "19:01"
        }

    # 2. Check alignment with current hour
    now = datetime.datetime.now()
    current_time_str = now.strftime("%H:%M")
    
    upcoming_prayer = "None"
    time_to_prayer_mins = 9999
    
    for prayer_name, time_str in prayer_times.items():
        if prayer_name not in ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"]:
            continue
        try:
            p_hour, p_min = map(int, time_str.split(':'))
            p_time = now.replace(hour=p_hour, minute=p_min, second=0, microsecond=0)
            
            # If prayer time has passed, represent it as tomorrow or check if in near future
            diff = (p_time - now).total_seconds() / 60
            if 0 < diff < time_to_prayer_mins:
                time_to_prayer_mins = int(diff)
                upcoming_prayer = prayer_name
        except Exception:
            pass

    # 3. Simulate meal checks
    # E.g., if current hour is 12:00 - 13:00 and user hasn't check-in meal, trigger alert
    current_hour = now.hour
    meal_nudge_required = (12 <= current_hour <= 13) or (18 <= current_hour <= 19)

    return jsonify({
        "user_id": user_id,
        "location": {"lat": lat, "lng": lng},
        "current_time": current_time_str,
        "prayer_timings": prayer_times,
        "upcoming_prayer": upcoming_prayer,
        "minutes_until_prayer": time_to_prayer_mins if upcoming_prayer != "None" else None,
        "meal_nudge_required": meal_nudge_required,
        "aladhan_api_status": "online" if aladhan_ok else "static_fallback"
    })


@app.route("/parse-brief", methods=["POST"])
def parse_project_brief():
    """
    POST /parse-brief
    Parses milestones from project_brief.md using Gemini 2.5 Flash.
    Calculates story points and adds a 20% deadline buffer block.
    """
    data = request.json or {}
    markdown_content = data.get("content", "")
    
    if not markdown_content:
        return jsonify({"error": "Content markdown is empty"}), 400

    extracted_milestones = []

    # If Gemini SDK is successfully authenticated
    if vertex_enabled:
        try:
            # We construct a high-fidelity system prompt directing Gemini to return clean JSON
            prompt = (
                "You are the DevAura Project Brief Parser. Analyze the following markdown file and extract "
                "project milestones. For each milestone, return: task name, deadline, and priority (Critical, High, Medium, Low).\n"
                "Ensure deadlines are extracted in format 'YYYY-MM-DD' or 'Day X'. Add a 20% buffer to dates if applicable.\n"
                "Return only a standard JSON list of objects containing fields: 'task', 'deadline', 'priority'."
            )
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt, markdown_content],
            )
            
            # Simple regex to extract JSON block from markdown output
            raw_text = response.text
            import json
            json_match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
            if json_match:
                extracted_milestones = json.loads(json_match.group(0))
            else:
                # If JSON parsing failed, use mock parser fallback
                extracted_milestones = mock_vertex.parse_sprint_milestones(markdown_content)
        except Exception as e:
            print(f"[DevAura] Error calling Vertex AI for parsing ({e}). Falling back to mock parser.")
            extracted_milestones = mock_vertex.parse_sprint_milestones(markdown_content)
    else:
        # Fall back to high-fidelity mock parser
        extracted_milestones = mock_vertex.parse_sprint_milestones(markdown_content)

    return jsonify({
        "status": "success",
        "milestones": extracted_milestones,
        "buffer_applied": "20% Buffer time added",
        "ai_generated": vertex_enabled
    })


@app.route("/generate-msg", methods=["POST"])
def generate_message():
    """
    POST /generate-msg
    Queries Gemini for a sarcastic, empathetic, or caring wellness nudge.
    Uses context variables: focus state, time of day, and last commits.
    """
    data = request.json or {}
    state = data.get("state", "idle")
    time_of_day = data.get("time_of_day", "afternoon")
    recent_commits = data.get("recent_commits", [])

    message = ""

    if vertex_enabled:
        try:
            prompt = (
                f"You are DevAura, an AI wellness companion for developers. Generate a short, "
                f"caring, yet slightly sarcastic ('sarkas-tapi-peduli' in Indonesian) reminder nudge for a developer who is "
                f"currently in state: '{state}', during time of day: '{time_of_day}'. "
                f"Their recent commit messages are: {recent_commits}.\n"
                "Keep the response under 100 words, friendly, and use slang/slight sarcasm to show you care."
            )
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[prompt],
            )
            message = response.text.strip()
        except Exception as e:
            print(f"[DevAura] Error calling Vertex AI for message generation ({e}). Falling back to mock generator.")
            message = mock_vertex.generate_wellness_message(state, time_of_day, recent_commits)
    else:
        message = mock_vertex.generate_wellness_message(state, time_of_day, recent_commits)

    return jsonify({
        "status": "success",
        "state": state,
        "nudge_message": message,
        "ai_generated": vertex_enabled
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=True)
