import json
import logging
from scheduler.appointment_engine.engine import (
    book_appointment,
    reschedule_appointment,
    cancel_appointment,
    get_all_doctors
)

logger = logging.getLogger("clinic_tools")

# Schema definitions of actions for documentation or LLM reference
TOOL_SCHEMAS = [
    {
        "name": "book_appointment",
        "description": "Book a new clinical appointment.",
        "parameters": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "The unique patient ID"},
                "doctor_id": {"type": "string", "description": "The selected doctor ID"},
                "date": {"type": "string", "format": "date", "description": "Date in YYYY-MM-DD"},
                "time": {"type": "string", "description": "Time in HH:MM AM/PM format (e.g. 02:00 PM)"}
            },
            "required": ["patient_id", "doctor_id", "date", "time"]
        }
    },
    {
        "name": "reschedule_appointment",
        "description": "Reschedule an existing active appointment.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "The appointment ID starting with app_"},
                "new_date": {"type": "string", "format": "date", "description": "New date in YYYY-MM-DD"},
                "new_time": {"type": "string", "description": "New time in HH:MM AM/PM (e.g. 10:00 AM)"}
            },
            "required": ["appointment_id", "new_date", "new_time"]
        }
    },
    {
        "name": "cancel_appointment",
        "description": "Cancel an existing active appointment.",
        "parameters": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "The appointment ID starting with app_"}
            },
            "required": ["appointment_id"]
        }
    }
]

def map_doctor_name_to_id(doctor_name_str):
    """
    Utility to map fuzzy doctor name spoken by user to standard doctor_id.
    """
    if not doctor_name_str:
        return None
    name_lower = doctor_name_str.lower()
    
    doctors = get_all_doctors()
    for doc in doctors:
        # Match Aarav, Patel, Aarav Patel, doc_1, etc.
        doc_name_parts = doc["doctor_name"].lower().split()
        if any(part in name_lower for part in doc_name_parts) or doc["doctor_id"] in name_lower:
            return doc["doctor_id"]
            
    # Fuzzy match on specialties
    for doc in doctors:
        if doc["specialty"].lower() in name_lower:
            return doc["doctor_id"]
            
    return None

def execute_clinical_action(action_name, params):
    """
    Executes actual clinical business logic.
    Returns status dict.
    """
    logger.info(f"Executing tool {action_name} with params {params}")
    try:
        if action_name == "book_appointment":
            patient_id = params.get("patient_id", "pat_1") # Default fallback to Rajesh Sharma
            doctor_id = params.get("doctor_id")
            
            # If we got a raw name, resolve to ID
            if doctor_id and not doctor_id.startswith("doc_"):
                doctor_id = map_doctor_name_to_id(doctor_id)
                
            if not doctor_id:
                return {"success": False, "message": "Please specify which doctor you would like to see.", "suggested_slots": []}
                
            date_val = params.get("date")
            time_val = params.get("time")
            
            return book_appointment(patient_id, doctor_id, date_val, time_val)
            
        elif action_name == "reschedule_appointment":
            app_id = params.get("appointment_id")
            new_date = params.get("new_date")
            new_time = params.get("new_time")
            
            return reschedule_appointment(app_id, new_date, new_time)
            
        elif action_name == "cancel_appointment":
            app_id = params.get("appointment_id")
            return cancel_appointment(app_id)
            
        else:
            return {"success": False, "message": f"Unknown clinical operation: {action_name}"}
    except Exception as e:
        logger.error(f"Error executing tool action {action_name}: {e}")
        return {"success": False, "message": f"System error booking appointment: {str(e)}"}
