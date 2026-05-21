// Volatile Session Memory (Short-Term Memory Manager)
// Supports Redis-style cache semantics with a solid local fallback

const sessions = {};

// Optional Redis Integration Fallback (Bonus Requirement)
let redisClient = null;
let redisConnected = false;

// If redis npm package is installed and we want to configure it, we can try to load it
try {
    const redis = require('redis');
    // If a Redis environment variable is present, connect to it
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    redisClient = redis.createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.log('Redis client not available, falling back to secure in-memory map.'));
    redisClient.connect()
        .then(() => {
            redisConnected = true;
            console.log('Connected to Redis Session Store successfully.');
        })
        .catch(() => {
            // Keep redisConnected false
        });
} catch (e) {
    // Redis client package not available, using high-speed in-memory store
}

async function getSession(sessionId) {
    if (redisConnected && redisClient) {
        try {
            const raw = await redisClient.get(sessionId);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            // Fallback to local on error
        }
    }
    
    if (!sessions[sessionId]) {
        sessions[sessionId] = {
            intent: "idle",
            pending_slots: {},
            current_language: "English",
            history: [],
            created_at: Date.now()
        };
    }
    return sessions[sessionId];
}

async function setSession(sessionId, state) {
    if (redisConnected && redisClient) {
        try {
            await redisClient.set(sessionId, JSON.stringify(state), {
                EX: 1800 // 30 minutes TTL
            });
            return true;
        } catch (e) {
            // Fallback to local on error
        }
    }
    
    sessions[sessionId] = { ...sessions[sessionId], ...state, updated_at: Date.now() };
    return true;
}

async function deleteSession(sessionId) {
    if (redisConnected && redisClient) {
        try {
            await redisClient.del(sessionId);
            return true;
        } catch (e) {
            // Fallback to local on error
        }
    }
    
    delete sessions[sessionId];
    return true;
}

module.exports = {
    getSession,
    setSession,
    deleteSession
};
