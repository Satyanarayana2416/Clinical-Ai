from fastapi import HTTPException
from scheduler.appointment_engine.engine import (
    get_all_doctors,
    get_all_schedules,
    get_all_appointments,
    book_appointment,
    reschedule_appointment,
    cancel_appointment
)
from memory.persistent_memory.db_memory import get_patient_profile
import os
import csv
import time
from datetime import datetime

def get_doctors_controller():
    return get_all_doctors()

def get_schedules_controller():
    return get_all_schedules()

def get_appointments_controller():
    return get_all_appointments()

def book_appointment_controller(data: dict):
    patient_id = data.get("patient_id", "pat_1")
    doctor_id = data.get("doctor_id")
    date_str = data.get("date")
    time_str = data.get("time")
    
    if not doctor_id or not date_str or not time_str:
        raise HTTPException(status_code=400, detail="Missing required booking details.")
        
    result = book_appointment(patient_id, doctor_id, date_str, time_str)
    return result

def reschedule_appointment_controller(data: dict):
    app_id = data.get("appointment_id")
    new_date = data.get("new_date")
    new_time = data.get("new_time")
    
    if not app_id or not new_date or not new_time:
        raise HTTPException(status_code=400, detail="Missing required reschedule details.")
        
    result = reschedule_appointment(app_id, new_date, new_time)
    return result

def cancel_appointment_controller(appointment_id: str):
    if not appointment_id:
        raise HTTPException(status_code=400, detail="Appointment ID is required.")
    result = cancel_appointment(appointment_id)
    return result

def get_patient_profile_controller(patient_id: str):
    profile = get_patient_profile(patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
    return profile

# CSV User Registration Helpers
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dataset"))
USERS_CSV = os.path.join(DATA_DIR, "registered_users.csv")
USER_HEADERS = ["user_id", "name", "place", "age", "registered_at"]

def init_users_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(USERS_CSV):
        with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=USER_HEADERS)
            writer.writeheader()

def read_users_csv():
    init_users_db()
    users = []
    try:
        with open(USERS_CSV, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                users.append(dict(row))
    except Exception as e:
        print(f"Error reading registered users CSV: {e}")
    return users

def write_users_csv(users):
    init_users_db()
    try:
        with open(USERS_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=USER_HEADERS)
            writer.writeheader()
            for user in users:
                writer.writerow(user)
        return True
    except Exception as e:
        print(f"Error writing registered users CSV: {e}")
        return False

# User Registration Controllers
def register_user_controller(data: dict):
    name = data.get("name")
    place = data.get("place")
    age = data.get("age")
    
    if not name or not place or not age:
        raise HTTPException(status_code=400, detail="Name, place, and age are required.")
        
    users = read_users_csv()
    
    user_id = f"user_{int(time.time() * 1000)}"
    new_user = {
        "user_id": user_id,
        "name": str(name).strip(),
        "place": str(place).strip(),
        "age": str(age).strip(),
        "registered_at": datetime.utcnow().isoformat() + "Z"
    }
    
    users.append(new_user)
    write_users_csv(users)
    
    print(f"[Registration] New user registered: {name} ({place}, age {age}) -> {user_id}")
    
    return {
        "success": True,
        "message": "User registered successfully!",
        "user": new_user
    }

def check_user_controller(user_id: str):
    users = read_users_csv()
    user = next((u for u in users if u["user_id"] == user_id), None)
    if user:
        return {"registered": True, "user": user}
    else:
        return {"registered": False}

def get_all_users_controller():
    return read_users_csv()

