// Rest routing router for Apollo Clinical Scheduler
const fs = require('fs');
const path = require('path');
const controllers = require('../controllers/appointments');

const STATIC_DIR = path.join(__dirname, '../../static');

function handleApiRoutes(req, res) {
    const url = req.url;
    const method = req.method;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return true;
    }

    // ===== Clinical Data APIs =====
    if (url === '/api/doctors' && method === 'GET') {
        controllers.handleGetDoctors(req, res);
        return true;
    }
    else if (url === '/api/schedules' && method === 'GET') {
        controllers.handleGetSchedules(req, res);
        return true;
    }
    else if (url === '/api/appointments' && method === 'GET') {
        controllers.handleGetAppointments(req, res);
        return true;
    }
    else if (url.startsWith('/api/patient/') && method === 'GET') {
        const patientId = url.split('/').pop();
        controllers.handleGetPatientProfile(req, res, patientId);
        return true;
    }
    else if (url.startsWith('/api/cancel/') && method === 'POST') {
        const appointmentId = url.split('/').pop();
        controllers.handleCancelAppointment(req, res, appointmentId);
        return true;
    }
    else if (url === '/api/config/api_key' && method === 'POST') {
        controllers.handleSaveApiKey(req, res);
        return true;
    }

    // ===== User Registration APIs =====
    else if (url === '/api/register' && method === 'POST') {
        controllers.handleRegisterUser(req, res);
        return true;
    }
    else if (url.startsWith('/api/user/') && method === 'GET') {
        const userId = url.split('/').pop();
        controllers.handleCheckUser(req, res, userId);
        return true;
    }
    else if (url === '/api/users' && method === 'GET') {
        controllers.handleGetAllUsers(req, res);
        return true;
    }

    return false; // Not handled, fall back to static file server
}

function serveStaticFiles(req, res) {
    let filePath = path.join(STATIC_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Safety check: Avoid directory traversal attacks
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("File Not Found");
        } else {
            let contentType = 'text/html';
            if (filePath.endsWith('.css')) contentType = 'text/css';
            else if (filePath.endsWith('.js')) contentType = 'text/javascript';
            else if (filePath.endsWith('.png')) contentType = 'image/png';
            else if (filePath.endsWith('.svg')) contentType = 'image/svg+xml';
            else if (filePath.endsWith('.ico')) contentType = 'image/x-icon';
            
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
}

module.exports = {
    handleApiRoutes,
    serveStaticFiles
};
