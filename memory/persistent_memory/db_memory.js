const fs = require('fs');
const path = require('path');
const csvHelper = require('../../scheduler/appointment_engine/csv_helper');

const DATA_DIR = path.join(__dirname, '..', '..', 'dataset');
const MEM_CSV = path.join(DATA_DIR, 'patient_profiles.csv');
const USERS_CSV = path.join(DATA_DIR, 'registered_users.csv');

const DEFAULT_PROFILES = {
    "pat_1": {
        patient_id: "pat_1",
        name: "Rajesh Sharma",
        preferred_language: "Hindi",
        preferred_doctor: "doc_1", // Dr. Aarav Patel
        preferred_hospital: "City Cardiology Center",
        past_appointments: [
            { date: "2026-04-10", doctor_name: "Dr. Aarav Patel", status: "completed" }
        ],
        notes: "Patient has mild hypertension. Prefers Hindi conversations."
    },
    "pat_2": {
        patient_id: "pat_2",
        name: "Meena Krishnan",
        preferred_language: "Tamil",
        preferred_doctor: "doc_2", // Dr. Priya Sharma
        preferred_hospital: "Apollo Children Clinic",
        past_appointments: [],
        notes: "Prefers Tamil. Standard monthly checkup for child."
    },
    "pat_3": {
        patient_id: "pat_3",
        name: "John Doe",
        preferred_language: "English",
        preferred_doctor: "doc_4", // Dr. Vikram Sen
        preferred_hospital: "General Wellness Clinic",
        past_appointments: [
            { date: "2026-03-05", doctor_name: "Dr. Vikram Sen", status: "completed" }
        ],
        notes: "Prefers English. Routine physicals."
    }
};

const HEADERS = ["patient_id", "name", "preferred_language", "preferred_doctor", "preferred_hospital", "notes", "past_appointments"];

function initProfiles() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    if (!fs.existsSync(MEM_CSV)) {
        const rows = Object.values(DEFAULT_PROFILES).map(prof => ({
            ...prof,
            past_appointments: JSON.stringify(prof.past_appointments)
        }));
        csvHelper.writeCsvFile(MEM_CSV, HEADERS, rows);
    }
}

function getPatientProfile(patientId) {
    initProfiles();
    try {
        const rows = csvHelper.readCsvFile(MEM_CSV);
        let row = rows.find(r => r.patient_id === patientId);
        
        // Auto-create profile from registered_users.csv if found
        if (!row && fs.existsSync(USERS_CSV)) {
            const users = csvHelper.readCsvFile(USERS_CSV);
            const user = users.find(u => u.user_id === patientId);
            if (user) {
                const newProfile = {
                    patient_id: user.user_id,
                    name: user.name,
                    preferred_language: "English",
                    preferred_doctor: "doc_1",
                    preferred_hospital: "City Cardiology Center",
                    notes: `Registered User from ${user.place}, Age: ${user.age}`,
                    past_appointments: "[]"
                };
                rows.push(newProfile);
                csvHelper.writeCsvFile(MEM_CSV, HEADERS, rows);
                row = newProfile;
                console.log(`[Database] Auto-created patient profile for registered user: ${user.name} (${user.user_id})`);
            }
        }

        if (!row) return null;

        let pastAppts = [];
        try {
            pastAppts = row.past_appointments ? JSON.parse(row.past_appointments) : [];
        } catch (err) {
            console.error("Failed to parse past appointments for patient:", patientId, err);
        }

        return {
            patient_id: row.patient_id,
            name: row.name,
            preferred_language: row.preferred_language,
            preferred_doctor: row.preferred_doctor,
            preferred_hospital: row.preferred_hospital,
            notes: row.notes,
            past_appointments: pastAppts
        };
    } catch (e) {
        console.error("Failed to load patient profiles from CSV:", e);
        return DEFAULT_PROFILES[patientId] || null;
    }
}

function updatePatientProfile(patientId, updates) {
    initProfiles();
    try {
        const rows = csvHelper.readCsvFile(MEM_CSV);
        let profileIdx = rows.findIndex(r => r.patient_id === patientId);
        
        let targetProfile = {
            patient_id: patientId,
            name: "New Patient",
            preferred_language: "English",
            preferred_doctor: "",
            preferred_hospital: "",
            notes: "",
            past_appointments: "[]"
        };

        if (profileIdx !== -1) {
            targetProfile = { ...rows[profileIdx] };
        }

        // Apply updates
        const merged = { ...targetProfile, ...updates };
        
        // If the updates contain raw objects in past_appointments, stringify them
        if (updates.past_appointments && typeof updates.past_appointments !== 'string') {
            merged.past_appointments = JSON.stringify(updates.past_appointments);
        }

        if (profileIdx !== -1) {
            rows[profileIdx] = merged;
        } else {
            rows.push(merged);
        }
        
        csvHelper.writeCsvFile(MEM_CSV, HEADERS, rows);
        
        // Return parsed object
        return {
            ...merged,
            past_appointments: typeof merged.past_appointments === 'string' ? JSON.parse(merged.past_appointments) : merged.past_appointments
        };
    } catch (e) {
        console.error("Failed to update patient profile in CSV:", e);
        return null;
    }
}

module.exports = {
    getPatientProfile,
    updatePatientProfile,
    initProfiles
};
