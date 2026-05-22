// ==============================================================
// 🚀 Decoupled Clinical Voice AI Agent & Scheduler - Node.js Server
// ==============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// 🔌 Zero-dependency environment variable loader
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const index = trimmed.indexOf('=');
                const key = trimmed.substring(0, index).trim();
                let val = trimmed.substring(index + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }
                process.env[key] = val;
            }
        });
        console.log(`[Env] Loaded configuration parameters from local .env file.`);
    }
}
loadEnv();

const apiRoutes = require('./backend/routes/api_routes');
const websocket = require('./backend/api/websocket');
const dbStore = require('./scheduler/appointment_engine/db_store');
const dbMemory = require('./memory/persistent_memory/db_memory');

const PORT = process.env.PORT || 8000;

// Initialize Database & Seeding
dbStore.initDb();
dbMemory.initProfiles();

// Start Core HTTP Web Server
const server = http.createServer((req, res) => {
    // 1. Handle API Routes
    const handled = apiRoutes.handleApiRoutes(req, res);
    
    // 2. Otherwise serve static dashboard front-end files
    if (!handled) {
        apiRoutes.serveStaticFiles(req, res);
    }
});

// Attach Real-Time WebSocket Channel
websocket.initializeWebSocket(server);

// Boot Server on All Interfaces (Required for Render)
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================================`);
    console.log(`🚀 Clinical Voice AI Agent Server successfully launched!`);
    console.log(`🔗 Web Dashboard URL: http://localhost:${PORT}`);
    console.log(`📡 WebSocket Channel: ws://localhost:${PORT}/ws`);
    console.log(`=============================================================`);
});
