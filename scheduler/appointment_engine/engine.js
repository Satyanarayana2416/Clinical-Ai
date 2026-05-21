const crypto = require('crypto');
const dbStore = require('./db_store');

function validateDateTime(dateStr, timeStr) {
    try {
        const appDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(appDate.getTime())) {
            return { valid: false, message: "Invalid date format. Expected YYYY-MM-DD." };
        }

        if (appDate < today) {
            return { valid: false, message: "Appointment date cannot be in the past." };
        }

        // Check if combined time is past
        // Expected timeStr like "10:00 AM" or "02:00 PM"
        const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
        const match = timeStr.trim().match(timeRegex);
        if (!match) {
            return { valid: false, message: "Invalid time format. Expected HH:MM AM/PM (e.g. 10:00 AM)." };
        }

        let [_, hoursStr, minutesStr, ampm] = match;
        let hours = parseInt(hoursStr, 10);
        let minutes = parseInt(minutesStr, 10);

        if (ampm.toUpperCase() === "PM" && hours < 12) hours += 12;
        if (ampm.toUpperCase() === "AM" && hours === 12) hours = 0;

        const appDateTime = new Date(dateStr);
        appDateTime.setHours(hours, minutes, 0, 0);

        if (isNaN(appDateTime.getTime())) {
            return { valid: false, message: "Invalid time parameters." };
        }

        if (appDateTime < new Date()) {
            return { valid: false, message: "Appointment time cannot be in the past." };
        }

        return { valid: true, message: "" };
    } catch (e) {
        return { valid: false, message: "Error validating date and time: " + e.message };
    }
}

function checkConflictAndGetAlternatives(doctorId, dateStr, timeStr) {
    const db = dbStore.loadDb();
    const cleanTime = timeStr.trim().toUpperCase();

    let daySched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === dateStr);

    if (!daySched) {
        // Create schedule if within 14 days
        const appDate = new Date(dateStr);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 14);

        if (appDate <= maxDate) {
            daySched = {
                doctor_id: doctorId,
                date: dateStr,
                available_slots: [...dbStore.DEFAULT_SLOTS]
            };
            db.doctor_schedule.push(daySched);
            dbStore.saveDb(db);
        } else {
            return { available: false, alternatives: [] };
        }
    }

    if (daySched.available_slots.includes(cleanTime)) {
        return { available: true, alternatives: [] };
    }

    // Slot is taken. Propose alternatives on the same day
    let alternatives = [...daySched.available_slots.slice(0, 3)];

    // If less than 3, look at the next day
    if (alternatives.length < 3) {
        const nextDay = new Date(dateStr);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = nextDay.toISOString().split('T')[0];

        const nextSched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === nextDayStr);
        if (nextSched) {
            nextSched.available_slots.slice(0, 3 - alternatives.length).forEach(slot => {
                alternatives.push(`${slot} on ${nextDayStr}`);
            });
        }
    }

    return { available: false, alternatives };
}

function bookAppointment(patientId, doctorId, dateStr, timeStr) {
    const validation = validateDateTime(dateStr, timeStr);
    if (!validation.valid) {
        return { success: false, message: validation.message, suggested_slots: [] };
    }

    const cleanTime = timeStr.trim().toUpperCase();
    const conflict = checkConflictAndGetAlternatives(doctorId, dateStr, cleanTime);
    if (!conflict.available) {
        return {
            success: false,
            message: `The requested slot ${timeStr} is already taken.`,
            suggested_slots: conflict.alternatives
        };
    }

    const db = dbStore.loadDb();
    
    // Remove slot from doctor schedule
    const daySched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === dateStr);
    if (daySched) {
        daySched.available_slots = daySched.available_slots.filter(s => s !== cleanTime);
    }

    const doctor = db.doctors.find(d => d.doctor_id === doctorId);

    const app = {
        id: `app_${crypto.randomBytes(4).toString('hex')}`,
        patient_id: patientId,
        doctor_id: doctorId,
        doctor_name: doctor ? doctor.doctor_name : "Unknown Doctor",
        date: dateStr,
        time: cleanTime,
        status: "booked",
        created_at: new Date().toISOString()
    };

    db.appointments.push(app);
    dbStore.saveDb(db);

    return { success: true, message: "Appointment successfully booked!", appointment: app };
}

function rescheduleAppointment(appointmentId, newDateStr, newTimeStr) {
    const validation = validateDateTime(newDateStr, newTimeStr);
    if (!validation.valid) {
        return { success: false, message: validation.message, suggested_slots: [] };
    }

    const db = dbStore.loadDb();
    const app = db.appointments.find(a => a.id === appointmentId && a.status === "booked");
    if (!app) {
        return { success: false, message: "Active appointment not found.", suggested_slots: [] };
    }

    const doctorId = app.doctor_id;
    const oldDate = app.date;
    const oldTime = app.time;
    const newTime = newTimeStr.trim().toUpperCase();

    const conflict = checkConflictAndGetAlternatives(doctorId, newDateStr, newTime);
    if (!conflict.available) {
        return {
            success: false,
            message: `New slot ${newTimeStr} is already taken.`,
            suggested_slots: conflict.alternatives
        };
    }

    // Free old slot
    const oldSched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === oldDate);
    if (oldSched) {
        if (!oldSched.available_slots.includes(oldTime)) {
            oldSched.available_slots.push(oldTime);
            // Sort slots back to order
            oldSched.available_slots.sort((a, b) => dbStore.DEFAULT_SLOTS.indexOf(a) - dbStore.DEFAULT_SLOTS.indexOf(b));
        }
    }

    // Reserve new slot in loaded DB
    const newSched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === newDateStr);
    if (newSched) {
        newSched.available_slots = newSched.available_slots.filter(s => s !== newTime);
    }

    // Find the appointment in db and update it
    const dbApp = db.appointments.find(a => a.id === appointmentId);
    dbApp.date = newDateStr;
    dbApp.time = newTime;
    dbApp.updated_at = new Date().toISOString();

    dbStore.saveDb(db);

    return { success: true, message: "Appointment successfully rescheduled!", appointment: dbApp };
}

function cancelAppointment(appointmentId) {
    const db = dbStore.loadDb();
    const app = db.appointments.find(a => a.id === appointmentId && a.status === "booked");
    if (!app) {
        return { success: false, message: "Active appointment not found." };
    }

    const doctorId = app.doctor_id;
    const oldDate = app.date;
    const oldTime = app.time;

    // Free the slot
    const oldSched = db.doctor_schedule.find(s => s.doctor_id === doctorId && s.date === oldDate);
    if (oldSched) {
        if (!oldSched.available_slots.includes(oldTime)) {
            oldSched.available_slots.push(oldTime);
            oldSched.available_slots.sort((a, b) => dbStore.DEFAULT_SLOTS.indexOf(a) - dbStore.DEFAULT_SLOTS.indexOf(b));
        }
    }

    // Cancel appointment
    app.status = "cancelled";
    app.updated_at = new Date().toISOString();

    dbStore.saveDb(db);

    return { success: true, message: "Appointment successfully cancelled!", appointment: app };
}

function getAllDoctors() {
    return dbStore.loadDb().doctors;
}

function getAllSchedules() {
    return dbStore.loadDb().doctor_schedule;
}

function getAllAppointments() {
    return dbStore.loadDb().appointments;
}

module.exports = {
    validateDateTime,
    checkConflictAndGetAlternatives,
    bookAppointment,
    rescheduleAppointment,
    cancelAppointment,
    getAllDoctors,
    getAllSchedules,
    getAllAppointments
};
