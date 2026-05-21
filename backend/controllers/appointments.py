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
