// 后台服务工作者脚本
// 处理扩展的后台逻辑

import { databaseService } from "../services/database";
import { PlaybackRecord } from "../types/database";

console.log("[CI] Background service worker started");

// 当前会话状态
let currentSession: PlaybackRecord | null = null;
let currentPlaying: boolean = false;
let currentLanguage: "cantonese" | "english" | "japanese" | "spanish" =
    "english"; // 默认语言
let currentDuration: number = 0;
let currentChannelName: string = "";
let currentChannelLogo: string = "";

// 保存记录到数据库
async function saveRecord(record: PlaybackRecord) {
    try {
        await databaseService.saveRecord(record);
        console.log("[CI] Record saved:", record);
    } catch (error) {
        console.log("[CI] Record:", record);
        console.error("[CI] Error saving record:", error);
    }
}

// 处理时长更新
async function handleDurationUpdate(data: any) {
    console.log("[CI] Duration updated:", data);
    currentDuration = data.duration;

    currentLanguage = detectLanguage(data.channelName, data.title);

    if (currentSession && currentSession.sessionId === data.sessionId) {
        currentSession.duration = data.duration;
        currentChannelName = data.channelName || "";
        currentChannelLogo = data.channelLogo || "";

        if (currentSession.duration < 5) {
            // 如果时长少于5秒，跳过保存
            return;
        }

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

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[CI] Background received message:", message);

    switch (message.type) {
        case "START_MONITORING":
            console.log("[CI] Starting video monitoring");
            currentPlaying = true;
            // 可以在这里添加全局监控逻辑
            break;

        case "PAUSE_MONITORING":
            console.log("[CI] Pausing video monitoring");
            currentPlaying = false;
            // 可以在这里添加暂停监控逻辑
            break;

        case "STOP_MONITORING":
            console.log("[CI] Stopping video monitoring");
            currentPlaying = false;
            // 可以在这里添加停止监控逻辑
            break;

        case "UPDATE_VIDEO_INFO":
            console.log("[CI] Video info updated:", message.payload);
            // 处理视频信息更新
            break;

        case "RECORD_SESSION":
            console.log("[CI] Recording session:", message.payload);
            handleDurationUpdate(message);
            break;

        case "GET_CURRENT_STATUS":
            // 返回当前状态给 popup
            sendResponse({
                currentSession: currentSession,
                currentPlaying: currentPlaying,
            });
            break;

        case "GET_STATS":
            // 获取统计数据
            getStats().then((stats) => {
                sendResponse(stats);
            });
            return true; // 保持消息通道开放

        default:
            console.log("[CI] Unknown message type:", message.type);
    }
});

// 获取统计数据
async function getStats() {
    try {
        // 获取今日记录
        const todayRecords = await databaseService.getTodayRecords();

        // 获取今日目标
        const today = new Date().toISOString().split("T")[0];
        const todayGoal = await databaseService.getDailyGoal(today);
        console.log("[CI] Today goal:", todayGoal);

        // 计算今日各语言学习时长
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

        // 获取目标数据
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

// 获取所有记录
async function getAllRecords() {
    try {
        return await databaseService.getAllRecords();
    } catch (error) {
        console.error("[CI] Error getting records:", error);
        return [];
    }
}

// 保存学习目标
async function saveGoal(goalData: any) {
    try {
        await databaseService.saveDailyGoal(goalData);
        console.log("[CI] Goal saved:", goalData);
    } catch (error) {
        console.error("[CI] Error saving goal:", error);
        throw error;
    }
}

// 获取学习目标
async function getGoals() {
    try {
        return await databaseService.getAllDailyGoals();
    } catch (error) {
        console.error("[CI] Error getting goals:", error);
        return [];
    }
}

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[CI] Extension installed:", details.reason);

    if (details.reason === "install") {
        // 首次安装时的初始化逻辑
        console.log("[CI] First time installation");
        // 初始化数据库
        databaseService.initDB();
    } else if (details.reason === "update") {
        // 更新时的逻辑
        console.log("[CI] Extension updated");
    }
});

// 处理标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        console.log("[CI] Tab updated:", tab.url);

        // 检查是否是支持的视频网站
        const supportedSites = ["youtube.com", "bilibili.com", "netflix.com"];

        const isSupported = supportedSites.some((site) =>
            tab.url?.includes(site)
        );

        if (isSupported) {
            console.log("[CI] Supported video site detected");
            // 可以在这里注入内容脚本或发送消息
        }
    }
});

// 处理扩展图标点击
chrome.action.onClicked.addListener((tab) => {
    console.log("[CI] Extension icon clicked");

    // 可以在这里添加点击扩展图标时的逻辑
    // 比如打开弹窗或执行特定操作
});

function detectLanguage(channelName: string, title: string) {
    title = title.toUpperCase();
    channelName = channelName.toUpperCase();

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
