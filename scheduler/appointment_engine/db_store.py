import json
import os
import threading
from datetime import datetime, date

DB_FILE = os.path.join(os.path.dirname(__file__), "clinic_db.json")
db_lock = threading.Lock()

DEFAULT_DOCTORS = [
    {
        "doctor_id": "doc_1",
        "doctor_name": "Dr. Aarav Patel",
        "specialty": "Cardiologist",
        "languages": ["English", "Hindi"]
    },
    {
        "doctor_id": "doc_2",
        "doctor_name": "Dr. Priya Sharma",
        "specialty": "Pediatrician",
        "languages": ["English", "Hindi", "Tamil"]
    },
    {
        "doctor_id": "doc_3",
        "doctor_name": "Dr. Ananya Nair",
        "specialty": "Dermatologist",
        "languages": ["English", "Tamil"]
    },
    {
        "doctor_id": "doc_4",
        "doctor_name": "Dr. Vikram Sen",
        "specialty": "General Physician",
        "languages": ["English", "Hindi"]
    }
]

DEFAULT_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"]

def init_db():
    with db_lock:
        if not os.path.exists(DB_FILE):
            data = {
                "doctors": DEFAULT_DOCTORS,
                "doctor_schedule": [],
                "appointments": []
            }
            # Seed schedule for the next 14 days
            today = datetime.now().date()
            import datetime as dt_mod
            for i in range(14):
                current_date = (today + dt_mod.timedelta(days=i)).isoformat()
                for doc in DEFAULT_DOCTORS:
                    data["doctor_schedule"].append({
                        "doctor_id": doc["doctor_id"],
                        "date": current_date,
                        "available_slots": list(DEFAULT_SLOTS)
                    })
            with open(DB_FILE, "w") as f:
                json.dump(data, f, indent=4)

def load_db():
    init_db()
    with db_lock:
        try:
            with open(DB_FILE, "r") as f:
                return json.load(f)
        except Exception:
            return {"doctors": DEFAULT_DOCTORS, "doctor_schedule": [], "appointments": []}

def save_db(data):
    with db_lock:
        with open(DB_FILE, "w") as f:
            json.dump(data, f, indent=4)
