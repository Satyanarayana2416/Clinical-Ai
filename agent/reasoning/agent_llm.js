// Google Gemini API Tool-Calling Broker & Calibrated Dialogue Reasoning Layer
const systemPrompts = require('../prompt/system_prompts');
const bookingTools = require('../tools/booking_tools');
const engine = require('../../scheduler/appointment_engine/engine');

/**
 * Main Reasoning Entry Point
 * Handles both Live Gemini Tool-calling and Local State-machine Fallback.
 * Returns { reply, reasoningTrace, latency, actionResult }
 */
async function runAgentReasoning(text, sessionState, patientProfile, apiKey) {
    const startTime = Date.now();
    const reasoningTrace = [];
    let actionResult = null;
    let reply = "";
    
    // Sync language state
    const language = sessionState.current_language || "English";
    const systemPrompt = systemPrompts.CLINICAL_SYSTEM_PROMPTS[language] || systemPrompts.CLINICAL_SYSTEM_PROMPTS["English"];
    const patientId = patientProfile ? patientProfile.patient_id : "pat_1";

    reasoningTrace.push({
        step: "Language & Context Anchor",
        detail: `Detected Language: ${language}. Loaded System Prompt for Apollo Clinic Receptionist.`
    });

    if (apiKey) {
        reasoningTrace.push({
            step: "Initiating Live Gemini API Call",
            detail: `Executing genuine tool-calling pipeline with gemini-1.5-flash.`
        });
        
        try {
            const result = await executeGeminiToolCalling(text, sessionState, systemPrompt, bookingTools.TOOL_SCHEMAS, patientProfile, apiKey, reasoningTrace);
            reply = result.reply;
            actionResult = result.actionResult;
        } catch (e) {
            reasoningTrace.push({
                step: "Gemini API Failure",
                detail: `Error connecting to Gemini API: ${e.message}. Falling back to high-fidelity local engine.`
            });
            const local = runLocalReasoning(text, sessionState, patientProfile, reasoningTrace);
            reply = local.reply;
            actionResult = local.actionResult;
        }
    } else {
        reasoningTrace.push({
            step: "Local Pipeline Mode",
            detail: "No GEMINI_API_KEY provided. Operating under ultra-low-latency local state-machine."
        });
        const local = runLocalReasoning(text, sessionState, patientProfile, reasoningTrace);
        reply = local.reply;
        actionResult = local.actionResult;
    }

    const llmLatency = Date.now() - startTime;
    return {
        reply,
        reasoningTrace,
        actionResult,
        llmLatency
    };
}

/**
 * Genuine Gemini API REST Multi-turn Tool-calling Loop
 */
async function executeGeminiToolCalling(text, sessionState, systemPrompt, toolSchemas, patientProfile, apiKey, reasoningTrace) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const patientId = patientProfile ? patientProfile.patient_id : "pat_1";
    const patientName = patientProfile ? patientProfile.name : "Patient";
    const patientDetails = `Patient Name: ${patientName}, Patient ID: ${patientId}`;

    // Build Gemini history
    if (!sessionState.history) sessionState.history = [];
    
    // Add current user turn with patient details for personalization
    sessionState.history.push({
        role: "user",
        parts: [{ text: `Patient Statement: "${text}" (Context: ${patientDetails}). Make a tool call if they request scheduling actions. Greet them by their name: ${patientName}.` }]
    });

    // We keep history length under control
    if (sessionState.history.length > 20) {
        sessionState.history = sessionState.history.slice(-10);
    }

    const requestPayload = {
        contents: sessionState.history,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        tools: [{
            functionDeclarations: toolSchemas
        }],
        generationConfig: {
            temperature: 0.1
        }
    };

    reasoningTrace.push({
        step: "Gemini Outbox payload",
        detail: `Payload structure includes ${toolSchemas.length} tools. History length: ${sessionState.history.length} turns.`
    });

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error ${response.status}: ${errorText}`);
    }

    const resData = await response.json();
    const candidate = resData.candidates && resData.candidates[0];
    const parts = candidate && candidate.content && candidate.content.parts;
    
    if (!parts) {
        return { reply: "I'm having trouble formulating a response. Could you please repeat that?", actionResult: null };
    }

    let finalReply = "";
    let actionResult = null;
    let callPart = parts.find(p => p.functionCall);

    if (callPart) {
        const funcName = callPart.functionCall.name;
        const funcArgs = callPart.functionCall.args || {};
        
        reasoningTrace.push({
            step: `Gemini Selected Tool: ${funcName}`,
            detail: `Parameters requested: ${JSON.stringify(funcArgs)}`
        });

        // 1. Force the patient_id to be active session patient if not set
        if (!funcArgs.patient_id) {
            funcArgs.patient_id = patientId;
        }

        // 2. Execute actual backend clinical action
        actionResult = bookingTools.executeClinicalAction(funcName, funcArgs);

        reasoningTrace.push({
            step: "Tool Execution Success",
            detail: `Database result: ${JSON.stringify(actionResult)}`
        });

        // 3. Sync state parameters back into sessionState for dashboard debugger UI
        if (funcName === "book_appointment") {
            sessionState.intent = "booking";
            sessionState.pending_slots = {
                doctor_id: funcArgs.doctor_id,
                date: funcArgs.date,
                time: actionResult.success ? funcArgs.time : null
            };
        } else if (funcName === "reschedule_appointment") {
            sessionState.intent = "reschedule";
            sessionState.pending_slots = {
                date: funcArgs.new_date,
                time: actionResult.success ? funcArgs.new_time : null
            };
        } else if (funcName === "cancel_appointment") {
            sessionState.intent = "cancel";
            sessionState.pending_slots = {};
        }

        if (actionResult.success) {
            sessionState.intent = "idle";
            sessionState.pending_slots = {};
        }

        // 4. Send tool result back to Gemini to get conversational natural summary
        const followUpPayload = {
            contents: [
                ...sessionState.history,
                {
                    role: "model",
                    parts: [callPart]
                },
                {
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: funcName,
                            response: {
                                success: actionResult.success,
                                message: actionResult.message,
                                appointment: actionResult.appointment || null,
                                suggested_slots: actionResult.suggested_slots || []
                            }
                        }
                    }]
                }
            ],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            tools: [{
                functionDeclarations: toolSchemas
            }],
            generationConfig: {
                temperature: 0.2
            }
        };

        reasoningTrace.push({
            step: "Sending tool results back to Gemini",
            detail: `Instructing model to summarize scheduling outcome naturally.`
        });

        const followUpRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(followUpPayload)
        });

        if (followUpRes.ok) {
            const followUpData = await followUpRes.json();
            const summaryParts = followUpData.candidates && followUpData.candidates[0] && followUpData.candidates[0].content && followUpData.candidates[0].content.parts;
            if (summaryParts && summaryParts[0]) {
                finalReply = summaryParts[0].text;
            }
        }

        if (!finalReply) {
            finalReply = actionResult.message;
        }

        // Save conversation turn to state history
        sessionState.history.push({
            role: "model",
            parts: [callPart]
        });
        sessionState.history.push({
            role: "user",
            parts: [{
                functionResponse: {
                    name: funcName,
                    response: actionResult
                }
            }]
        });
    } else {
        // Conversational response with no tool calls
        finalReply = parts[0].text;
        sessionState.history.push({
            role: "model",
            parts: parts
        });
        
        reasoningTrace.push({
            step: "Conversational Response",
            detail: "Model generated direct conversational reply without triggering scheduling tools."
        });
    }

    return { reply: finalReply, actionResult };
}

/**
 * Fast, Calibrated Local Dialogue State-Machine Reasoner (<10ms)
 * Simulates intent classifications & fills slots exactly to ensure low latency
 */
function runLocalReasoning(text, sessionState, patientProfile, reasoningTrace) {
    const textLower = text.toLowerCase();
    let lang = sessionState.current_language || "English";
    let intent = sessionState.intent || "idle";
    let slots = sessionState.pending_slots || {};
    const patientId = patientProfile ? patientProfile.patient_id : "pat_1";

    // 1. Synchronize language switches
    if (textLower.includes("hindi") || textLower.includes("हिंदी") || textLower.includes("namaste")) lang = "Hindi";
    if (textLower.includes("tamil") || textLower.includes("தமிழ்") || textLower.includes("vanakkam")) lang = "Tamil";
    sessionState.current_language = lang;

    // 2. Doctor matching
    let docId = null;
    if (textLower.includes("aarav") || textLower.includes("patel") || textLower.includes("cardiologist") || textLower.includes("दिल")) docId = "doc_1";
    else if (textLower.includes("priya") || textLower.includes("sharma") || textLower.includes("pediatrician") || textLower.includes("बच्चो")) docId = "doc_2";
    else if (textLower.includes("ananya") || textLower.includes("nair") || textLower.includes("dermatologist") || textLower.includes("त्वचा")) docId = "doc_3";
    else if (textLower.includes("vikram") || textLower.includes("sen") || textLower.includes("general physician") || textLower.includes("डॉक्टर")) docId = "doc_4";
    if (docId) {
        slots.doctor_id = docId;
        reasoningTrace.push({ step: "Local Slot Extraction", detail: `Mapped doctor: ${docId}` });
    }

    // 3. Date mapping
    let dateVal = null;
    if (textLower.includes("friday") || textLower.includes("शुक्रवार") || textLower.includes("வெள்ளிக்கிழமை")) dateVal = getNextWeekday("friday");
    else if (textLower.includes("monday") || textLower.includes("सोमवार") || textLower.includes("திங்கட்கிழமை")) dateVal = getNextWeekday("monday");
    else if (textLower.includes("tomorrow") || textLower.includes("कल") || textLower.includes("நாளை")) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        dateVal = tom.toISOString().split('T')[0];
    } else if (textLower.includes("today") || textLower.includes("आज") || textLower.includes("இன்று")) {
        dateVal = new Date().toISOString().split('T')[0];
    }
    if (dateVal) {
        slots.date = dateVal;
        reasoningTrace.push({ step: "Local Slot Extraction", detail: `Mapped date: ${dateVal}` });
    }

    // 4. Time matching
    const timeVal = parseTimeFuzzy(textLower);
    if (timeVal) {
        slots.time = timeVal;
        reasoningTrace.push({ step: "Local Slot Extraction", detail: `Mapped slot: ${timeVal}` });
    }

    // 5. Intent triggers
    if (textLower.includes("book") || textLower.includes("appointment") || textLower.includes("बुक") || textLower.includes("பதிவு")) intent = "booking";
    else if (textLower.includes("reschedule") || textLower.includes("change") || textLower.includes("बदल") || textLower.includes("மாற்ற")) intent = "reschedule";
    else if (textLower.includes("cancel") || textLower.includes("हटा") || textLower.includes("ரத்து")) intent = "cancel";
    
    sessionState.intent = intent;
    sessionState.pending_slots = slots;

    let reply = "";
    let actionResult = null;
    const docNames = { doc_1: "Dr. Aarav Patel", doc_2: "Dr. Priya Sharma", doc_3: "Dr. Ananya Nair", doc_4: "Dr. Vikram Sen" };

    if (intent === "booking") {
        let missing = [];
        if (!slots.doctor_id) missing.push("doctor");
        if (!slots.date) missing.push("date");
        if (!slots.time) missing.push("time");

        if (missing.length === 0) {
            actionResult = engine.bookAppointment(patientId, slots.doctor_id, slots.date, slots.time);
            if (actionResult.success) {
                const app = actionResult.appointment;
                if (lang === "Hindi") {
                    reply = `आपका अपॉइंटमेंट ${docNames[slots.doctor_id]} के साथ ${app.date} को ${app.time} बजे सफलतापूर्वक बुक हो गया है। आपका अपॉइंटमेंट आईडी ${app.id} है।`;
                } else if (lang === "Tamil") {
                    reply = `உங்கள் சந்திப்பு ${docNames[slots.doctor_id]} உடன் ${app.date} அன்று ${app.time} மணிக்கு வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது. உங்கள் முன்பதிவு ஐடி ${app.id} ஆகும்.`;
                } else {
                    reply = `Excellent! Your appointment with ${docNames[slots.doctor_id]} is successfully booked for ${app.date} at ${app.time}. Your appointment ID is ${app.id}.`;
                }
                sessionState.intent = "idle";
                sessionState.pending_slots = {};
                reasoningTrace.push({ step: "Execute bookAppointment tool", detail: `Successfully reserved database slot. ID: ${app.id}` });
            } else {
                if (actionResult.suggested_slots) {
                    const alts = actionResult.suggested_slots.join(", ");
                    slots.time = null;
                    sessionState.pending_slots = slots;
                    if (lang === "Hindi") {
                        reply = `माफ़ कीजियेगा, वह समय पहले से ही बुक है। उपलब्ध समय हैं: ${alts}। आप इनमें से कौन सा स्लॉट चुनना चाहेंगे?`;
                    } else if (lang === "Tamil") {
                        reply = `மன்னிக்கவும், அந்த நேரம் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. கிடைக்கக்கூடிய மாற்று நேரங்கள்: ${alts}. நீங்கள் எதைத் தேர்ந்தெடுக்க விரும்புகிறீர்கள்?`;
                    } else {
                        reply = `I'm sorry, but that slot is taken. Doctor's available slots are: ${alts}. Which one would you prefer?`;
                    }
                    reasoningTrace.push({ step: "Conflict Detected", detail: `Alternative slots recommended: ${alts}` });
                } else {
                    reply = `Booking failed: ${actionResult.message}`;
                }
            }
        } else {
            const nextMissing = missing[0];
            if (nextMissing === "doctor") {
                if (lang === "Hindi") reply = "आप किस डॉक्टर या विशेषता से मिलना चाहते हैं? हमारे पास कार्डियोलॉजिस्ट डॉ आरव, पीडियाट्रिशियन डॉ प्रिया और डर्मेटोलॉजिस्ट डॉ अनन्या उपलब्ध हैं।";
                else if (lang === "Tamil") reply = "நீங்கள் எந்த மருத்துவரை சந்திக்க வேண்டும்? எங்களிடம் கார்டியாலஜிஸ்ட் டாக்டர் ஆரவ், பீடியாட்ரிஷியன் டாக்டர் பிரியா மற்றும் டெர்மடாலஜிஸ்ட் டாக்டர் அனன்யா உள்ளனர்.";
                else reply = "Which doctor or specialty would you like to see? We have Cardiologist Dr. Aarav, Pediatrician Dr. Priya, Dermatologist Dr. Ananya, and General Physician Dr. Vikram.";
            } else if (nextMissing === "date") {
                const docName = docNames[slots.doctor_id] || "the doctor";
                if (lang === "Hindi") reply = `आप ${docName} से किस तारीख को मिलना चाहते हैं? जैसे कि शुक्रवार या सोमवार?`;
                else if (lang === "Tamil") reply = `நீங்கள் ${docName} உடன் எந்த தேதியில் சந்திப்பை விரும்புகிறீர்கள்? திங்கட்கிழமை அல்லது வெள்ளிக்கிழமை?`;
                else reply = `What date would you like to schedule with ${docName}? Monday or Friday work well.`;
            } else if (nextMissing === "time") {
                const docName = docNames[slots.doctor_id] || "the doctor";
                if (lang === "Hindi") reply = `${docName} के साथ समय क्या रहेगा? हमारे पास सुबह 10:00 बजे, 11:00 बजे, या दोपहर 2:00 बजे और 4:00 बजे के स्लॉट हैं।`;
                else if (lang === "Tamil") reply = `${docName} சந்திப்பிற்கான நேரம் என்ன? எங்களிடம் காலை 10:00, 11:00 அல்லது மதியம் 2:00 மற்றும் 4:00 மணிக்கான இடங்கள் உள்ளன.`;
                else reply = `What time would you prefer with ${docName}? Available times are usually 10:00 AM, 11:00 AM, 2:00 PM, or 4:00 PM.`;
            }
            reasoningTrace.push({ step: "Awaiting Missing slots", detail: `Awaiting slot: ${nextMissing}` });
        }
    } else if (intent === "reschedule") {
        const apps = engine.getAllAppointments().filter(a => a.patient_id === patientId && a.status === "booked");
        if (apps.length === 0) {
            if (lang === "Hindi") reply = "मुझे आपके नाम पर कोई सक्रिय अपॉइंटमेंट नहीं मिला जिसे पुनर्निर्धारित किया जा सके।";
            else if (lang === "Tamil") reply = "மறுஅட்டவணைப்படுத்துவதற்கு உங்கள் பெயரில் செயலில் உள்ள சந்திப்புகள் எதுவும் எனக்கு கிடைக்கவில்லை.";
            else reply = "I couldn't find any active appointments booked under your profile to reschedule.";
            sessionState.intent = "idle";
        } else {
            const targetApp = apps[0];
            if (slots.date && slots.time) {
                actionResult = engine.rescheduleAppointment(targetApp.id, slots.date, slots.time);
                if (actionResult.success) {
                    const app = actionResult.appointment;
                    if (lang === "Hindi") reply = `आपका अपॉइंटमेंट ${app.doctor_name} के साथ सफलतापूर्वक ${app.date} को दोपहर ${app.time} बजे के लिए पुनर्निर्धारित कर दिया गया है।`;
                    else if (lang === "Tamil") reply = `உங்கள் சந்திப்பு வெற்றிகரமாக ${app.doctor_name} உடன் ${app.date} அன்று ${app.time} மணிக்கு மறுஅட்டவணைப்படுத்தப்பட்டுள்ளது.`;
                    else reply = `Excellent! Your appointment with ${app.doctor_name} has been rescheduled to ${app.date} at ${app.time}.`;
                    sessionState.intent = "idle";
                    sessionState.pending_slots = {};
                    reasoningTrace.push({ step: "Execute rescheduleAppointment tool", detail: `Rescheduled app: ${targetApp.id} to new slot.` });
                } else {
                    if (actionResult.suggested_slots) {
                        slots.time = null;
                        sessionState.pending_slots = slots;
                        const alts = actionResult.suggested_slots.join(", ");
                        if (lang === "Hindi") reply = `माफ़ कीजियेगा, वह समय उपलब्ध नहीं है। अन्य उपलब्ध स्लॉट हैं: ${alts}।`;
                        else if (lang === "Tamil") reply = `மன்னிக்கவும், அந்த நேரம் கிடைக்கவில்லை. மாற்று நேரங்கள்: ${alts}.`;
                        else reply = `I'm sorry, but that slot is taken. Alternatives are: ${alts}. Which one works?`;
                        reasoningTrace.push({ step: "Reschedule Conflict", detail: `Alternative slots: ${alts}` });
                    } else {
                        reply = `Failed to reschedule: ${actionResult.message}`;
                    }
                }
            } else {
                if (lang === "Hindi") reply = `मैं आपके ${targetApp.doctor_name} के साथ वाले अपॉइंटमेंट को बदल सकता हूँ। कृपया नया दिन और समय बताएँ।`;
                else if (lang === "Tamil") reply = `நான் ${targetApp.doctor_name} சந்திப்பை மாற்ற முடியும். புதிய தேதி மற்றும் நேரத்தை கூறவும்.`;
                else reply = `I can help you reschedule your appointment with ${targetApp.doctor_name}. Please tell me the new date and time you prefer.`;
                reasoningTrace.push({ step: "Gathering reschedule slots", detail: "Awaiting new date and time details from patient." });
            }
        }
    } else if (intent === "cancel") {
        const apps = engine.getAllAppointments().filter(a => a.patient_id === patientId && a.status === "booked");
        if (apps.length === 0) {
            if (lang === "Hindi") reply = "मुझे आपका कोई सक्रिय अपॉइंटमेंट नहीं मिला जिसे रद्द किया जा सके।";
            else if (lang === "Tamil") reply = "ரத்து செய்வதற்கு உங்கள் பெயரில் செயலில் உள்ள சந்திப்புகள் எதுவும் இல்லை.";
            else reply = "I couldn't find any active appointments under your profile to cancel.";
            sessionState.intent = "idle";
        } else {
            const targetApp = apps[0];
            actionResult = engine.cancelAppointment(targetApp.id);
            if (actionResult.success) {
                if (lang === "Hindi") reply = `आपका ${targetApp.doctor_name} के साथ ${targetApp.date} का अपॉइंटमेंट रद्द कर दिया गया है।`;
                else if (lang === "Tamil") reply = `டாக்டர் ${targetApp.doctor_name} உடனான உங்கள் சந்திப்பு வெற்றிகரமாக ரத்து செய்யப்பட்டது.`;
                else reply = `Your appointment with ${targetApp.doctor_name} on ${targetApp.date} has been successfully cancelled.`;
                sessionState.intent = "idle";
                sessionState.pending_slots = {};
                reasoningTrace.push({ step: "Execute cancelAppointment tool", detail: `Cancelled app: ${targetApp.id}` });
            } else {
                reply = `Failed to cancel appointment: ${actionResult.message}`;
            }
        }
    } else {
        if (patientProfile) {
            const prefDoc = docNames[patientProfile.preferred_doctor] || "Dr. Aarav Patel";
            if (lang === "Hindi") reply = `नमस्ते ${patientProfile.name} जी, अपोलो सेंटर में आपका स्वागत है। मुझे याद है कि आपका पिछला अपॉइंटमेंट ${prefDoc} के साथ था। आज मैं आपकी क्या सहायता कर सकता हूँ?`;
            else if (lang === "Tamil") reply = `வணக்கம் ${patientProfile.name}, அப்பல்லோ மையத்திற்கு வரவேற்கிறோம். உங்களது கடைசி சந்திப்பு ${prefDoc} உடன் இருந்தது நினைவிருக்கிறது. இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?`;
            else reply = `Hello ${patientProfile.name}, welcome back to Apollo Medical. I see your preferred doctor is ${prefDoc} at ${patientProfile.preferred_hospital}. How can I assist you with your schedule today?`;
        } else {
            if (lang === "Hindi") reply = "नमस्ते! मैं अपोलो मेडिकल सेंटर की एआई रिसेप्शनिस्ट हूँ। आज मैं अपॉइंटमेंट बुक करने में आपकी क्या मदद कर सकती हूँ?";
            else if (lang === "Tamil") reply = "வணக்கம்! நான் அப்பல்லோ மருத்துவ மையத்தின் AI வரவேற்பாளர். இன்று சந்திப்பை முன்பதிவு செய்ய நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?";
            else reply = "Hello! Welcome to Apollo Medical Center. I am your AI receptionist. How can I help you manage your clinical appointments today?";
        }
        reasoningTrace.push({ step: "Welcome Greeting", detail: "Greeted patient with context from profile memory." });
    }

    return { reply, actionResult };
}

// Helpers
function getNextWeekday(weekdayName) {
    const days = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0 };
    const targetDay = days[weekdayName.toLowerCase()];
    if (targetDay === undefined) return null;
    
    const today = new Date();
    const resultDate = new Date(today);
    resultDate.setDate(today.getDate() + (targetDay + 7 - today.getDay()) % 7);
    if (resultDate.toDateString() === today.toDateString()) {
        resultDate.setDate(today.getDate() + 7);
    }
    return resultDate.toISOString().split('T')[0];
}

function parseTimeFuzzy(timeStr) {
    const str = timeStr.toLowerCase();
    if (str.includes("10")) return "10:00 AM";
    if (str.includes("11")) return "11:00 AM";
    if (str.includes("9")) return "09:00 AM";
    if (str.includes("2")) return "02:00 PM";
    if (str.includes("3")) return "03:00 PM";
    if (str.includes("4")) return "04:00 PM";
    return null;
}

module.exports = {
    runAgentReasoning
};
