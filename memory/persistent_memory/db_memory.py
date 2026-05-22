import json
import os
import threading
import csv

MEM_FILE = os.path.join(os.path.dirname(__file__), "patient_profiles.json")
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dataset"))
USERS_CSV = os.path.join(DATA_DIR, "registered_users.csv")
mem_lock = threading.Lock()

DEFAULT_PROFILES = {
    "pat_1": {
        "patient_id": "pat_1",
        "name": "Rajesh Sharma",
        "preferred_language": "Hindi",
        "preferred_doctor": "doc_1", # Dr. Aarav Patel
        "preferred_hospital": "City Cardiology Center",
        "past_appointments": [
            {"date": "2026-04-10", "doctor_name": "Dr. Aarav Patel", "status": "completed"}
        ],
        "notes": "Patient has mild hypertension. Prefers Hindi conversations."
    },
    "pat_2": {
        "patient_id": "pat_2",
        "name": "Meena Krishnan",
        "preferred_language": "Tamil",
        "preferred_doctor": "doc_2", # Dr. Priya Sharma
        "preferred_hospital": "Apollo Children Clinic",
        "past_appointments": [],
        "notes": "Prefers Tamil. Standard monthly checkup for child."
    },
    "pat_3": {
        "patient_id": "pat_3",
        "name": "John Doe",
        "preferred_language": "English",
        "preferred_doctor": "doc_4", # Dr. Vikram Sen
        "preferred_hospital": "General Wellness Clinic",
        "past_appointments": [
            {"date": "2026-03-05", "doctor_name": "Dr. Vikram Sen", "status": "completed"}
        ],
        "notes": "Prefers English. Routine physicals."
    }
}

def init_profiles():
    with mem_lock:
        if not os.path.exists(MEM_FILE):
            with open(MEM_FILE, "w") as f:
                json.dump(DEFAULT_PROFILES, f, indent=4)

def get_patient_profile(patient_id):
    init_profiles()
    with mem_lock:
        try:
            with open(MEM_FILE, "r") as f:
                data = json.load(f)
            
            # If profile not found, try to auto-create from registered_users.csv
            if patient_id not in data and os.path.exists(USERS_CSV):
                user = None
                try:
                    with open(USERS_CSV, "r", newline="", encoding="utf-8") as f_csv:
                        reader = csv.DictReader(f_csv)
                        for row in reader:
                            if row.get("user_id") == patient_id:
                                user = dict(row)
                                break
                except Exception as e:
                    print(f"Error reading registered users in db_memory: {e}")
                
                if user:
                    new_profile = {
                        "patient_id": user["user_id"],
                        "name": user["name"],
                        "preferred_language": "English",
                        "preferred_doctor": "doc_1",
                        "preferred_hospital": "City Cardiology Center",
                        "past_appointments": [],
                        "notes": f"Registered User from {user.get('place', 'unknown')}, Age: {user.get('age', 'unknown')}"
                    }
                    data[patient_id] = new_profile
                    with open(MEM_FILE, "w") as f_out:
                        json.dump(data, f_out, indent=4)
                    print(f"[Database] Auto-created patient profile for registered user in Python: {user['name']} ({user['user_id']})")
                    return new_profile

            return data.get(patient_id)
        except Exception as e:
            print(f"Error in get_patient_profile: {e}")
            return DEFAULT_PROFILES.get(patient_id)


def update_patient_profile(patient_id, updates):
    init_profiles()
    with mem_lock:
        try:
            with open(MEM_FILE, "r") as f:
                data = json.load(f)
            if patient_id not in data:
                data[patient_id] = {
                    "patient_id": patient_id,
                    "name": "New Patient",
                    "preferred_language": "English",
                    "preferred_doctor": "",
                    "preferred_hospital": "",
                    "past_appointments": [],
                    "notes": ""
                }
            data[patient_id].update(updates)
            with open(MEM_FILE, "w") as f:
                json.dump(data, f, indent=4)
            return data[patient_id]
        except Exception as e:
            print(f"Error saving profile updates: {e}")
            return None
