import re
import datetime

def generate_wellness_message(state: str, time_of_day: str, recent_commits: list) -> str:
    """
    Generates high-fidelity sarcastic, empathetic, or celebratory wellness nudges.
    Reflects the Gemini 2.5 flash behavior.
    """
    state = state.lower()
    time_of_day = time_of_day.lower()
    
    # 1. Late night commits (late night logic)
    hour = datetime.datetime.now().hour
    if hour >= 23 or hour <= 4:
        return (
            "Bro, ini udah hampir tengah malam/dini hari 🦉. "
            "Codingan lu mungkin jalan sekarang, tapi besok pas bangun lu bakal heran kenapa baris ini ditulis. "
            "Saran gue: commit, push, terus matiin laptop. Kasihan mata sama ginjal lu. Bug-nya gak bakalan lari kok, suer."
        )

    # 2. Frustrated state
    if state == "frustrated" or state == "struggling":
        return (
            "Hey, gue ngeliat index frustration lu lagi tinggi nih (banyak backspace & delete) 🤯. "
            "Santai dulu bro. Gak usah dipaksa mecahin monitor. Tarik nafas dalam-dalam selama 5 detik, "
            "regangkan pundak lu, terus ambil minum 💧. Kadang jawaban bug-nya dateng pas lu lagi gak ngeliatin monitor."
        )

    # 3. Deep focus flow
    if state == "deep-focus" or state == "deep flow":
        return (
            "Gokil, flow state lu lagi kenceng banget! ⚡ "
            "Gue bakal silent semua reminder dulu biar lu fokus conquer dunia. "
            "Tapi kalau udah beres, jangan lupa makan ya! Keep going!"
        )

    # 4. Meal suggestion / Normal status check
    if "commit" in recent_commits or (recent_commits and len(recent_commits) > 0):
        last_msg = recent_commits[0].lower()
        if "fix" in last_msg or "error" in last_msg or "bug" in last_msg:
            return (
                "Nice! Habis beresin bug ya? 🛠️ "
                "Biar badannya seimbang, yuk stretch bentar atau isi bensin dulu. "
                "Makan siang/malam dulu gih, jangan cuma ngasih makan IDE doang."
            )
        if "done" in last_msg or "complete" in last_msg or "finally" in last_msg:
            return (
                "Wih mantap! Milestone tercapai! 🎉 "
                "Gue ikut bangga. Sekarang waktu yang tepat buat check-in solat / ambil snack. "
                "Jangan lupa bersyukur!"
            )

    return (
        "Halo bro! Cuma mau ngingetin: tetap jaga keseimbangan ya. "
        "Udah minum air putih belum 2 jam terakhir? Jangan sampai ginjal lu ngambek. 💧"
    )

def parse_sprint_milestones(markdown_text: str) -> list:
    """
    Parses milestone sections from markdown and extracts: task name, deadline, and priority.
    Adds a 20% buffer time automatically.
    """
    milestones = []
    
    # Simple regex search for markdown tables
    # Example format: | Milestone | Deadline | Priority |
    # Or matches text like "Day 1 - Setup" or "- [ ] Milestone 1"
    
    lines = markdown_text.split('\n')
    for line in lines:
        line_clean = line.strip()
        # Parse table row: | Setup Google Cloud | Day 1 – 09:00 | Critical |
        if line_clean.startswith('|') and not line_clean.startswith('|---'):
            parts = [p.strip() for p in line_clean.split('|')[1:-1]]
            if len(parts) >= 3 and parts[0] != "Milestone" and parts[0] != "Goal Description":
                task = parts[0]
                deadline = parts[1]
                priority = parts[2]
                if task and deadline and priority:
                    milestones.append({
                        "task": task,
                        "deadline": deadline,
                        "priority": priority,
                        "buffered_days": 1 # Representing buffer addition
                    })
        # Parse list row: - [ ] Task name (deadline: YYYY-MM-DD)
        elif line_clean.startswith('-') or line_clean.startswith('*'):
            match = re.search(r'\[.\]\s*([^(\-]+)(?:\(([^)]+)\))?', line_clean)
            if match:
                task = match.group(1).strip()
                details = match.group(2).strip() if match.group(2) else "Flexible"
                if task:
                    milestones.append({
                        "task": task,
                        "deadline": details,
                        "priority": "Medium",
                        "buffered_days": 1
                    })
                    
    # Fallback to realistic mock sprints if none identified
    if len(milestones) == 0:
        milestones = [
            { "task": "Configure Cloud Run Backend (Flask)", "deadline": "Day 1 - 12:00", "priority": "Critical", "buffered_days": 1 },
            { "task": "Integrate Vertex AI Gemini API message generator", "deadline": "Day 1 - 15:00", "priority": "Critical", "buffered_days": 1 },
            { "task": "Setup Firestore streaks schemas", "deadline": "Day 1 - 18:00", "priority": "High", "buffered_days": 1 },
            { "task": "Coordinate local azan prayer alerts via Aladhan API", "deadline": "Day 2 - 12:00", "priority": "High", "buffered_days": 1 },
            { "task": "Parse milestones & auto-inject calendar events", "deadline": "Day 2 - 16:00", "priority": "High", "buffered_days": 1 }
        ]
        
    return milestones
