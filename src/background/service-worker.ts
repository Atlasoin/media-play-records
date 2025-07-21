// Background service worker script
// Handles extension background logic

import { databaseService } from "../services/database";
import { PlaybackRecord } from "../types/database";

console.log("[CI] Background service worker started");

// Current session state
let currentSession: PlaybackRecord | null = null;
let currentPlaying: boolean = false;
let currentLanguage: "cantonese" | "english" | "japanese" | "spanish" =
    "english"; // Default language
let currentDuration: number = 0;
let currentChannelName: string = "";
let currentChannelLogo: string = "";

// Save record to database
async function saveRecord(record: PlaybackRecord) {
    // Skip records less than 3 seconds
    if (record.duration < 3) {
        console.log(
            "[CI] Duration less than 3 seconds, skipping message:",
            record.duration
        );
        return;
    }

    try {
        await databaseService.saveRecord(record);
        console.log("[CI] Record saved:", record);
    } catch (error) {
        console.log("[CI] Record:", record);
        console.error("[CI] Error saving record:", error);
    }
}

// Handle duration update
async function handleDurationUpdate(data: any) {
    console.log("[CI] Duration updated:", data);

    // Check if duration is less than 5 seconds
    if (data.duration < 5) {
        console.log(
            "[CI] Skipping record for duration less than 5 seconds:",
            data.duration
        );
        return;
    }

    currentDuration = data.duration;

    currentLanguage = detectLanguage(data.channelName, data.title);

    if (currentSession && currentSession.sessionId === data.sessionId) {
        currentSession.duration = data.duration;
        currentChannelName = data.channelName || "";
        currentChannelLogo = data.channelLogo || "";

        await saveRecord(currentSession);
    } else {
        currentSession = {
            sessionId: data.sessionId,
            date: new Date(data.date).toISOString(),
            title: data.title,
            url: data.url,
            language: currentLanguage,
            duration: data.duration,
            channelName: data.channelName || null,
            channelLogo: data.channelLogo || null,
        };
        await saveRecord(currentSession);
    }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[CI] Background received message:", message);

    switch (message.type) {
        case "START_MONITORING":
            console.log("[CI] Starting video monitoring");
            currentPlaying = true;
            // Global monitoring logic can be added here
            break;

        case "PAUSE_MONITORING":
            console.log("[CI] Pausing video monitoring");
            currentPlaying = false;
            // Pause monitoring logic can be added here
            break;

        case "STOP_MONITORING":
            console.log("[CI] Stopping video monitoring");
            currentPlaying = false;
            // Stop monitoring logic can be added here
            break;

        case "UPDATE_VIDEO_INFO":
            console.log("[CI] Video info updated:", message.payload);
            // Handle video info updates
            break;

        case "RECORD_SESSION":
            console.log("[CI] Recording session:", message.payload);
            handleDurationUpdate(message);
            break;

        case "GET_CURRENT_STATUS":
            // Return current status to popup
            sendResponse({
                currentSession: currentSession,
                currentPlaying: currentPlaying,
            });
            break;

        case "GET_STATS":
            // Get statistics
            getStats().then((stats) => {
                sendResponse(stats);
            });
            return true; // Keep message channel open

        case "GET_RECORDS":
            // Get all records
            getAllRecords().then((records) => {
                sendResponse(records);
            });
            return true; // Keep message channel open

        case "GET_GOALS":
            // Get learning goals
            getGoals().then((goals) => {
                sendResponse(goals);
            });
            return true; // Keep message channel open

        case "SAVE_GOAL":
            // Save learning goal
            saveGoal(message.payload)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    sendResponse({ error: error.message });
                });
            return true; // Keep message channel open

        default:
            console.log("[CI] Unknown message type:", message.type);
    }
});

// Get statistics
async function getStats() {
    try {
        // Get today's records
        const todayRecords = await databaseService.getTodayRecords();

        // Get today's goal
        const today = new Date().toISOString().split("T")[0];
        const todayGoal = await databaseService.getDailyGoal(today);
        console.log("[CI] Today goal:", todayGoal);

        // Calculate today's learning duration by language
        const stats = {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        };

        todayRecords.forEach((record) => {
            if (record.language in stats) {
                stats[record.language as keyof typeof stats] += record.duration;
            }
        });

        // Get goal data
        const goals = todayGoal?.goals || {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        };

        return {
            todayStats: stats,
            todayGoals: goals,
            totalTodayDuration: Object.values(stats).reduce(
                (sum, duration) => sum + duration,
                0
            ),
        };
    } catch (error) {
        console.error("[CI] Error getting stats:", error);
        return {
            todayStats: { cantonese: 0, english: 0, japanese: 0, spanish: 0 },
            todayGoals: { cantonese: 0, english: 0, japanese: 0, spanish: 0 },
            totalTodayDuration: 0,
        };
    }
}

// Get all records
async function getAllRecords() {
    try {
        const allRecords = await databaseService.getAllRecords();

        return allRecords;
    } catch (error) {
        console.error("[CI] Error getting records:", error);
        return [];
    }
}

// Save learning goal
async function saveGoal(goalData: any) {
    try {
        await databaseService.saveDailyGoal(goalData);
        console.log("[CI] Goal saved:", goalData);
    } catch (error) {
        console.error("[CI] Error saving goal:", error);
        throw error;
    }
}

// Get learning goals
async function getGoals() {
    try {
        return await databaseService.getAllDailyGoals();
    } catch (error) {
        console.error("[CI] Error getting goals:", error);
        return [];
    }
}

// Extension installation initialization
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[CI] Extension installed:", details.reason);

    if (details.reason === "install") {
        // First time installation logic
        console.log("[CI] First time installation");
        // Initialize database
        databaseService.initDB();
    } else if (details.reason === "update") {
        // Update logic
        console.log("[CI] Extension updated");
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        console.log("[CI] Tab updated:", tab.url);

        // Check if it's a supported video site
        const supportedSites = ["youtube.com", "bilibili.com", "netflix.com"];

        const isSupported = supportedSites.some((site) =>
            tab.url?.includes(site)
        );

        if (isSupported) {
            console.log("[CI] Supported video site detected");
            // Content script injection or message sending can be added here
        }
    }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log("[CI] Extension icon clicked");

    // Logic for extension icon click can be added here
    // Such as opening popup or executing specific operations
});

function detectLanguage(channelName: string | null, title: string | null) {
    title = title?.toUpperCase() || "";
    channelName = channelName?.toUpperCase() || "";

    if (title.includes("CANTONESE") || channelName.includes("CANTONESE")) {
        return "cantonese";
    } else if (
        title.includes("ESPAÑOL") ||
        channelName.includes("ESPAÑOL") ||
        title.includes("EPISODIO") ||
        channelName.includes("EPISODIO") ||
        title.includes("SPANISH") ||
        channelName.includes("SPANISH")
    ) {
        return "spanish";
    } else {
        return "english";
    }
}

export {};
