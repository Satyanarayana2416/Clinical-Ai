try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False

import json
import logging

logger = logging.getLogger("session_memory")

# Global Fallback Session Store
_IN_MEMORY_SESSIONS = {}
_redis_client = None

def init_redis():
    global _redis_client
    if not REDIS_AVAILABLE:
        logger.warning("redis-py package is not installed, falling back to local in-memory session store.")
        _redis_client = None
        return
    try:
        # Default connection string, low timeout to avoid blocking
        _redis_client = redis.Redis(host='localhost', port=6379, db=0, socket_timeout=1.0, decode_responses=True)
        # Test connection
        _redis_client.ping()
        logger.info("Successfully connected to Redis.")
    except Exception as e:
        logger.warning(f"Redis is not available, falling back to local in-memory session store. Reason: {e}")
        _redis_client = None

# Run initialization
init_redis()

def get_session(session_id):
    """
    Retrieves session data from Redis or in-memory fallback.
    """
    if _redis_client:
        try:
            data = _redis_client.get(f"session:{session_id}")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Error accessing Redis, using in-memory: {e}")
    
    return _IN_MEMORY_SESSIONS.get(session_id, {
        "intent": "idle",
        "pending_slots": {},
        "current_language": "en",
        "history": [],
        "last_interaction": None
    })

def set_session(session_id, session_data):
    """
    Saves entire session data to Redis or in-memory fallback.
    """
    if _redis_client:
        try:
            _redis_client.setex(f"session:{session_id}", 3600, json.dumps(session_data))
            return True
        except Exception as e:
            logger.warning(f"Error writing to Redis, using in-memory: {e}")
            
    _IN_MEMORY_SESSIONS[session_id] = session_data
    return True

def update_session(session_id, key, val):
    """
    Updates a single key in the session dict.
    """
    session_data = get_session(session_id)
    session_data[key] = val
    return set_session(session_id, session_data)

def clear_session(session_id):
    """
    Clears out the short-term session state.
    """
    if _redis_client:
        try:
            _redis_client.delete(f"session:{session_id}")
        except Exception:
            pass
    if session_id in _IN_MEMORY_SESSIONS:
        del _IN_MEMORY_SESSIONS[session_id]
