// ==============================================================
// 🚀 Decoupled Clinical Voice AI Agent & Scheduler - Node.js Server
// ==============================================================

const http = require('http');
const apiRoutes = require('./backend/routes/api_routes');
const websocket = require('./backend/api/websocket');
const dbStore = require('./scheduler/appointment_engine/db_store');
const dbMemory = require('./memory/persistent_memory/db_memory');

const PORT = 8000;

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

// Boot Server on Localhost
server.listen(PORT, '127.0.0.1', () => {
    console.log(`=============================================================`);
    console.log(`🚀 Clinical Voice AI Agent Server successfully launched!`);
    console.log(`🔗 Web Dashboard URL: http://127.0.0.1:${PORT}`);
    console.log(`📡 WebSocket Channel: ws://127.0.0.1:${PORT}/ws`);
    console.log(`=============================================================`);
});
