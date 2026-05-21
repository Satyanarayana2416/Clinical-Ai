// Tool schemas and execution handlers for Google Gemini API or local state-machine

const engine = require('../../scheduler/appointment_engine/engine');

// Schema definitions for Google Gemini API Tool declarations
const TOOL_SCHEMAS = [
    {
        name: "book_appointment",
        description: "Book a new clinical appointment with a doctor for a patient.",
        parameters: {
            type: "OBJECT",
            properties: {
                patient_id: { type: "STRING", description: "The unique patient ID (e.g. pat_1 for Rajesh Sharma, pat_2 for Meena Krishnan, pat_3 for John Doe)." },
                doctor_id: { type: "STRING", description: "The selected doctor ID or specialty (e.g. doc_1 for Dr. Aarav Patel, doc_2 for Dr. Priya Sharma, doc_3 for Dr. Ananya Nair, doc_4 for Dr. Vikram Sen)." },
                date: { type: "STRING", description: "The date of appointment in YYYY-MM-DD format (e.g. 2026-05-22)." },
                time: { type: "STRING", description: "The selected slot in HH:MM AM/PM format (e.g. 10:00 AM, 02:00 PM)." }
            },
            required: ["patient_id", "doctor_id", "date", "time"]
        }
    },
    {
        name: "reschedule_appointment",
        description: "Reschedule an existing active appointment to a new date and time.",
        parameters: {
            type: "OBJECT",
            properties: {
                appointment_id: { type: "STRING", description: "The appointment ID starting with app_ to reschedule." },
                new_date: { type: "STRING", description: "The new date of appointment in YYYY-MM-DD format (e.g. 2026-05-23)." },
                new_time: { type: "STRING", description: "The new time slot in HH:MM AM/PM format (e.g. 11:00 AM, 03:00 PM)." }
            },
            required: ["appointment_id", "new_date", "new_time"]
        }
    },
    {
        name: "cancel_appointment",
        description: "Cancel an existing active clinical appointment.",
        parameters: {
            type: "OBJECT",
            properties: {
                appointment_id: { type: "STRING", description: "The appointment ID starting with app_ to cancel." }
            },
            required: ["appointment_id"]
        }
    }
];

function mapDoctorNameToId(doctorNameOrSpecialty) {
    if (!doctorNameOrSpecialty) return null;
    const clean = doctorNameOrSpecialty.toLowerCase();

    const doctors = engine.getAllDoctors();
    
    // Direct doctor ID match
    for (let doc of doctors) {
        if (clean.includes(doc.doctor_id)) return doc.doctor_id;
    }

    // Name match
    for (let doc of doctors) {
        const parts = doc.doctor_name.toLowerCase().split(/\s+/);
        if (parts.some(p => p !== 'dr.' && clean.includes(p))) {
            return doc.doctor_id;
        }
    }

    // Specialty match
    for (let doc of doctors) {
        if (clean.includes(doc.specialty.toLowerCase())) {
            return doc.doctor_id;
        }
        // Hindi specialty synonyms
        if (clean.includes("दिल") && doc.specialty === "Cardiologist") return "doc_1";
        if (clean.includes("बच्चो") && doc.specialty === "Pediatrician") return "doc_2";
        if (clean.includes("त्वचा") && doc.specialty === "Dermatologist") return "doc_3";
        if (clean.includes("सामान्य") && doc.specialty === "General Physician") return "doc_4";
    }

    return null;
}

function executeClinicalAction(actionName, params) {
    console.log(`Executing tool-call action: ${actionName}`, params);
    try {
        if (actionName === "book_appointment") {
            const patientId = params.patient_id || "pat_1";
            let doctorId = params.doctor_id;

            // Map name/specialty to doc_id if not a direct ID
            if (doctorId && !doctorId.startsWith("doc_")) {
                doctorId = mapDoctorNameToId(doctorId);
            }

            if (!doctorId) {
                return {
                    success: false,
                    message: "Please specify which doctor or specialty you would like to book.",
                    suggested_slots: []
                };
            }

            const date = params.date;
            const time = params.time;

            return engine.bookAppointment(patientId, doctorId, date, time);

        } else if (actionName === "reschedule_appointment") {
            const appointmentId = params.appointment_id;
            const newDate = params.new_date;
            const newTime = params.new_time;

            return engine.rescheduleAppointment(appointmentId, newDate, newTime);

        } else if (actionName === "cancel_appointment") {
            const appointmentId = params.appointment_id;
            return engine.cancelAppointment(appointmentId);

        } else {
            return { success: false, message: `Unknown clinical tool action: ${actionName}` };
        }
    } catch (e) {
        console.error(`Error executing action ${actionName}:`, e);
        return { success: false, message: `Internal scheduler error: ${e.message}` };
    }
}

module.exports = {
    TOOL_SCHEMAS,
    mapDoctorNameToId,
    executeClinicalAction
};
