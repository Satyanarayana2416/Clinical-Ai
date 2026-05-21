import uuid
from datetime import datetime, date, timedelta
from .db_store import load_db, save_db

def parse_iso_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except Exception:
        return None

def validate_date_time(date_str, time_str):
    """
    Validates that the appointment date and time is in the future.
    date_str is in YYYY-MM-DD format.
    time_str is in 'HH:MM AM/PM' format.
    """
    try:
        # Check date format
        app_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        today = datetime.now().date()
        if app_date < today:
            return False, "Appointment date cannot be in the past."

        # Check datetime
        time_parsed = datetime.strptime(time_str, "%I:%M %p").time()
        app_datetime = datetime.combine(app_date, time_parsed)
        if app_datetime < datetime.now():
            return False, "Appointment time cannot be in the past."
        
        return True, ""
    except ValueError as e:
        return False, f"Invalid date or time format. Expected YYYY-MM-DD and HH:MM AM/PM. Details: {str(e)}"

def check_conflict_and_get_alternatives(doctor_id, date_str, time_str):
    """
    Checks if a slot is available. If not, returns available alternatives.
    """
    db = load_db()
    
    # Clean time format
    time_str = time_str.strip().upper()
    
    # Find schedule for that doctor and date
    day_schedule = None
    for item in db["doctor_schedule"]:
        if item["doctor_id"] == doctor_id and item["date"] == date_str:
            day_schedule = item
            break
            
    if not day_schedule:
        # Doctor has no schedule set up for this date yet. Create one if it's within 14 days
        try:
            app_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            today = datetime.now().date()
            if today <= app_date <= today + timedelta(days=14):
                from .db_store import DEFAULT_SLOTS
                day_schedule = {
                    "doctor_id": doctor_id,
                    "date": date_str,
                    "available_slots": list(DEFAULT_SLOTS)
                }
                db["doctor_schedule"].append(day_schedule)
                save_db(db)
            else:
                return False, []
        except Exception:
            return False, []

    # Check if slot exists in available_slots
    if time_str in day_schedule["available_slots"]:
        return True, []
    
    # Slot is not available. Suggest up to 3 alternative slots on that day or the next day
    alternatives = day_schedule["available_slots"][:3]
    if len(alternatives) < 3:
        # Look at the next day
        try:
            next_date = (datetime.strptime(date_str, "%Y-%m-%d").date() + timedelta(days=1)).isoformat()
            for item in db["doctor_schedule"]:
                if item["doctor_id"] == doctor_id and item["date"] == next_date:
                    alternatives.extend([f"{slot} on {next_date}" for slot in item["available_slots"][:3 - len(alternatives)]])
                    break
        except Exception:
            pass
            
    return False, alternatives

def book_appointment(patient_id, doctor_id, date_str, time_str):
    """
    Books an appointment.
    """
    # 1. Validate time
    is_valid, msg = validate_date_time(date_str, time_str)
    if not is_valid:
        return {"success": False, "message": msg, "suggested_slots": []}
    
    # 2. Check conflicts
    is_available, alternatives = check_conflict_and_get_alternatives(doctor_id, date_str, time_str)
    if not is_available:
        return {
            "success": False, 
            "message": f"The requested slot {time_str} is already taken.", 
            "suggested_slots": alternatives
        }
    
    # 3. Book
    db = load_db()
    
    # Remove slot from availability
    for item in db["doctor_schedule"]:
        if item["doctor_id"] == doctor_id and item["date"] == date_str:
            if time_str in item["available_slots"]:
                item["available_slots"].remove(time_str)
                break
                
    appointment = {
        "id": f"app_{uuid.uuid4().hex[:8]}",
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "doctor_name": next((d["doctor_name"] for d in db["doctors"] if d["doctor_id"] == doctor_id), "Unknown Doctor"),
        "date": date_str,
        "time": time_str,
        "status": "booked",
        "created_at": datetime.now().isoformat()
    }
    
    db["appointments"].append(appointment)
    save_db(db)
    
    return {"success": True, "message": "Appointment successfully booked!", "appointment": appointment}

def reschedule_appointment(appointment_id, new_date_str, new_time_str):
    """
    Reschedules an existing appointment.
    """
    # 1. Validate time
    is_valid, msg = validate_date_time(new_date_str, new_time_str)
    if not is_valid:
        return {"success": False, "message": msg, "suggested_slots": []}
        
    db = load_db()
    
    # Find appointment
    appointment = None
    for app in db["appointments"]:
        if app["id"] == appointment_id and app["status"] == "booked":
            appointment = app
            break
            
    if not appointment:
        return {"success": False, "message": "Active appointment not found.", "suggested_slots": []}
        
    doctor_id = appointment["doctor_id"]
    old_date = appointment["date"]
    old_time = appointment["time"]
    
    # 2. Check conflicts on new slot
    is_available, alternatives = check_conflict_and_get_alternatives(doctor_id, new_date_str, new_time_str)
    if not is_available:
        return {
            "success": False, 
            "message": f"New slot {new_time_str} is already taken.", 
            "suggested_slots": alternatives
        }
        
    # 3. Apply Reschedule
    # Free old slot
    for item in db["doctor_schedule"]:
        if item["doctor_id"] == doctor_id and item["date"] == old_date:
            if old_time not in item["available_slots"]:
                item["available_slots"].append(old_time)
                # Sort slots to keep order
                from .db_store import DEFAULT_SLOTS
                item["available_slots"].sort(key=lambda x: DEFAULT_SLOTS.index(x) if x in DEFAULT_SLOTS else 99)
                break
                
    # Reserve new slot
    for item in db["doctor_schedule"]:
        if item["doctor_id"] == doctor_id and item["date"] == new_date_str:
            if new_time_str in item["available_slots"]:
                item["available_slots"].remove(new_time_str)
                break
                
    # Update appointment
    appointment["date"] = new_date_str
    appointment["time"] = new_time_str
    appointment["updated_at"] = datetime.now().isoformat()
    
    save_db(db)
    
    return {"success": True, "message": "Appointment successfully rescheduled!", "appointment": appointment}

def cancel_appointment(appointment_id):
    """
    Cancels an appointment.
    """
    db = load_db()
    
    # Find appointment
    appointment = None
    for app in db["appointments"]:
        if app["id"] == appointment_id and app["status"] == "booked":
            appointment = app
            break
            
    if not appointment:
        return {"success": False, "message": "Active appointment not found."}
        
    doctor_id = appointment["doctor_id"]
    app_date = appointment["date"]
    app_time = appointment["time"]
    
    # Free the slot
    for item in db["doctor_schedule"]:
        if item["doctor_id"] == doctor_id and item["date"] == app_date:
            if app_time not in item["available_slots"]:
                item["available_slots"].append(app_time)
                # Sort slots
                from .db_store import DEFAULT_SLOTS
                item["available_slots"].sort(key=lambda x: DEFAULT_SLOTS.index(x) if x in DEFAULT_SLOTS else 99)
                break
                
    # Update appointment status
    appointment["status"] = "cancelled"
    appointment["updated_at"] = datetime.now().isoformat()
    
    save_db(db)
    
    return {"success": True, "message": "Appointment successfully cancelled!", "appointment": appointment}

def get_all_doctors():
    db = load_db()
    return db["doctors"]

def get_all_schedules():
    db = load_db()
    return db["doctor_schedule"]

def get_all_appointments():
    db = load_db()
    return db["appointments"]
