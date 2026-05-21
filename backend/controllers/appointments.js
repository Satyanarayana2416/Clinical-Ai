// REST Controllers for Apollo Clinical Scheduler
const engine = require('../../scheduler/appointment_engine/engine');
const dbMemory = require('../../memory/persistent_memory/db_memory');

// In-session configurations (e.g. Gemini API Key)
const globalConfig = {
    gemini_api_key: ""
};

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

module.exports = {
    handleGetDoctors,
    handleGetSchedules,
    handleGetAppointments,
    handleGetPatientProfile,
    handleCancelAppointment,
    handleSaveApiKey,
    globalConfig
};
