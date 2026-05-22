from fastapi import APIRouter, Body
from backend.controllers.appointments import (
    get_doctors_controller,
    get_schedules_controller,
    get_appointments_controller,
    book_appointment_controller,
    reschedule_appointment_controller,
    cancel_appointment_controller,
    get_patient_profile_controller,
    register_user_controller,
    check_user_controller,
    get_all_users_controller
)
import os

router = APIRouter()

@router.get("/doctors")
def get_doctors():
    return get_doctors_controller()

@router.get("/schedules")
def get_schedules():
    return get_schedules_controller()

@router.get("/appointments")
def get_appointments():
    return get_appointments_controller()

@router.post("/book")
def book_app(payload: dict = Body(...)):
    return book_appointment_controller(payload)

@router.post("/reschedule")
def reschedule_app(payload: dict = Body(...)):
    return reschedule_appointment_controller(payload)

@router.post("/cancel/{appointment_id}")
def cancel_app(appointment_id: str):
    return cancel_appointment_controller(appointment_id)

@router.get("/patient/{patient_id}")
def get_patient(patient_id: str):
    return get_patient_profile_controller(patient_id)

@router.post("/config/api_key")
def update_api_key(payload: dict = Body(...)):
    key = payload.get("api_key")
    if key:
        os.environ["GEMINI_API_KEY"] = key
        import agent.reasoning.agent_llm as agent_llm
        agent_llm.GEMINI_KEY = key
        try:
            import google.generativeai as genai
            genai.configure(api_key=key)
            agent_llm.logger.info("Successfully reconfigured Gemini API Key.")
            return {"status": "success", "message": "API key successfully configured!"}
        except Exception as e:
            return {"status": "error", "message": f"Failed setting API key: {str(e)}"}
    return {"status": "error", "message": "API key cannot be empty."}

@router.post("/register")
def register_user(payload: dict = Body(...)):
    return register_user_controller(payload)

@router.get("/user/{user_id}")
def check_user(user_id: str):
    return check_user_controller(user_id)

@router.get("/users")
def get_all_users():
    return get_all_users_controller()

