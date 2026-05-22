// REST Controllers for Apollo Clinical Scheduler
const engine = require('../../scheduler/appointment_engine/engine');
const dbMemory = require('../../memory/persistent_memory/db_memory');
const csvHelper = require('../../scheduler/appointment_engine/csv_helper');
const path = require('path');
const fs = require('fs');

const USERS_CSV = path.join(__dirname, '..', '..', 'dataset', 'registered_users.csv');
const USER_HEADERS = ["user_id", "name", "place", "age", "registered_at"];

// In-session configurations (e.g. Gemini API Key)
const globalConfig = {
    gemini_api_key: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ""
};

// Ensure users CSV exists
function initUsersDb() {
    if (!fs.existsSync(USERS_CSV)) {
        csvHelper.writeCsvFile(USERS_CSV, USER_HEADERS, []);
    }
}

function handleGetDoctors(req, res) {
    const doctors = engine.getAllDoctors();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(doctors));
}

function handleGetSchedules(req, res) {
    const schedules = engine.getAllSchedules();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(schedules));
}

function handleGetAppointments(req, res) {
    const appointments = engine.getAllAppointments();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(appointments));
}

function handleGetPatientProfile(req, res, patientId) {
    const profile = dbMemory.getPatientProfile(patientId);
    if (profile) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(profile));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "Patient profile not found" }));
    }
}

function handleCancelAppointment(req, res, appointmentId) {
    const result = engine.cancelAppointment(appointmentId);
    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
}

function handleSaveApiKey(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.api_key) {
                globalConfig.gemini_api_key = data.api_key;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "success", message: "Google Gemini API key securely configured in Node session." }));
            } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: "error", message: "No key provided" }));
            }
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: "error", message: "Invalid JSON body" }));
        }
    });
}

// ========== User Registration Endpoints ==========

function handleRegisterUser(req, res) {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const { name, place, age } = data;

            if (!name || !place || !age) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: "Name, place, and age are required." }));
                return;
            }

            initUsersDb();
            const rows = csvHelper.readCsvFile(USERS_CSV);

            // Generate user ID
            const userId = `user_${Date.now()}`;
            const newUser = {
                user_id: userId,
                name: name.trim(),
                place: place.trim(),
                age: String(age).trim(),
                registered_at: new Date().toISOString()
            };

            rows.push(newUser);
            csvHelper.writeCsvFile(USERS_CSV, USER_HEADERS, rows);

            console.log(`[Registration] New user registered: ${name} (${place}, age ${age}) -> ${userId}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: "User registered successfully!",
                user: newUser
            }));
        } catch (e) {
            console.error("Registration error:", e);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: "Invalid request body." }));
        }
    });
}

function handleCheckUser(req, res, userId) {
    initUsersDb();
    const rows = csvHelper.readCsvFile(USERS_CSV);
    const user = rows.find(r => r.user_id === userId);

    if (user) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ registered: true, user }));
    } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ registered: false }));
    }
}

function handleGetAllUsers(req, res) {
    initUsersDb();
    const rows = csvHelper.readCsvFile(USERS_CSV);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(rows));
}

module.exports = {
    handleGetDoctors,
    handleGetSchedules,
    handleGetAppointments,
    handleGetPatientProfile,
    handleCancelAppointment,
    handleSaveApiKey,
    handleRegisterUser,
    handleCheckUser,
    handleGetAllUsers,
    globalConfig
};
