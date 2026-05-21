const fs = require('fs');
const path = require('path');
const csvHelper = require('./csv_helper');

const DATA_DIR = path.join(__dirname, '..', '..', 'dataset');
const DOCTORS_CSV = path.join(DATA_DIR, 'doctors.csv');
const SCHEDULES_CSV = path.join(DATA_DIR, 'doctor_schedules.csv');
const APPOINTMENTS_CSV = path.join(DATA_DIR, 'appointments.csv');

const DEFAULT_DOCTORS = [
    {
        doctor_id: "doc_1",
        doctor_name: "Dr. Aarav Patel",
        specialty: "Cardiologist",
        languages: ["English", "Hindi"]
    },
    {
        doctor_id: "doc_2",
        doctor_name: "Dr. Priya Sharma",
        specialty: "Pediatrician",
        languages: ["English", "Hindi", "Tamil"]
    },
    {
        doctor_id: "doc_3",
        doctor_name: "Dr. Ananya Nair",
        specialty: "Dermatologist",
        languages: ["English", "Tamil"]
    },
    {
        doctor_id: "doc_4",
        doctor_name: "Dr. Vikram Sen",
        specialty: "General Physician",
        languages: ["English", "Hindi"]
    }
];

const DEFAULT_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];

function initDb() {
    // Ensure dataset directory exists
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // 1. Seed doctors.csv if missing
    if (!fs.existsSync(DOCTORS_CSV)) {
        const doctorsData = DEFAULT_DOCTORS.map(doc => ({
            doctor_id: doc.doctor_id,
            doctor_name: doc.doctor_name,
            specialty: doc.specialty,
            languages: doc.languages.join('|')
        }));
        csvHelper.writeCsvFile(DOCTORS_CSV, ["doctor_id", "doctor_name", "specialty", "languages"], doctorsData);
    }

    // 2. Seed schedules if missing
    if (!fs.existsSync(SCHEDULES_CSV)) {
        const schedules = [];
        const today = new Date();
        const slotsStr = DEFAULT_SLOTS.join('|');

        for (let i = 0; i < 14; i++) {
            const current = new Date(today);
            current.setDate(today.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            
            DEFAULT_DOCTORS.forEach(doc => {
                schedules.push({
                    doctor_id: doc.doctor_id,
                    date: dateStr,
                    available_slots: slotsStr
                });
            });
        }
        csvHelper.writeCsvFile(SCHEDULES_CSV, ["doctor_id", "date", "available_slots"], schedules);
    }

    // 3. Seed appointments if missing
    if (!fs.existsSync(APPOINTMENTS_CSV)) {
        csvHelper.writeCsvFile(APPOINTMENTS_CSV, ["id", "patient_id", "patient_name", "doctor_id", "doctor_name", "date", "time", "status"], []);
    }
}

function loadDb() {
    initDb();
    
    // Load Doctors
    const rawDocs = csvHelper.readCsvFile(DOCTORS_CSV);
    const doctors = rawDocs.map(row => ({
        doctor_id: row.doctor_id,
        doctor_name: row.doctor_name,
        specialty: row.specialty,
        languages: row.languages ? row.languages.split('|') : []
    }));

    // Load Schedules
    const rawSched = csvHelper.readCsvFile(SCHEDULES_CSV);
    const doctor_schedule = rawSched.map(row => ({
        doctor_id: row.doctor_id,
        date: row.date,
        available_slots: row.available_slots ? row.available_slots.split('|') : []
    }));

    // Load Appointments
    const appointments = csvHelper.readCsvFile(APPOINTMENTS_CSV);

    return {
        doctors,
        doctor_schedule,
        appointments
    };
}

function saveDb(data) {
    try {
        // Save doctor schedule
        const schedRows = data.doctor_schedule.map(row => ({
            doctor_id: row.doctor_id,
            date: row.date,
            available_slots: Array.isArray(row.available_slots) ? row.available_slots.join('|') : row.available_slots
        }));
        csvHelper.writeCsvFile(SCHEDULES_CSV, ["doctor_id", "date", "available_slots"], schedRows);

        // Save appointments
        csvHelper.writeCsvFile(APPOINTMENTS_CSV, ["id", "patient_id", "patient_name", "doctor_id", "doctor_name", "date", "time", "status"], data.appointments);
        
        return true;
    } catch (e) {
        console.error("Failed to save database state to CSV files:", e);
        return false;
    }
}

module.exports = {
    DEFAULT_DOCTORS,
    DEFAULT_SLOTS,
    loadDb,
    saveDb,
    initDb
};
