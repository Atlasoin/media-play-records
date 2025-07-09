// 后台服务工作者脚本
// 处理扩展的后台逻辑

console.log("[CI] Background service worker started");

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[CI] Background received message:", message);

    switch (message.type) {
        case "START_MONITORING":
            console.log("[CI] Starting video monitoring");
            // 可以在这里添加全局监控逻辑
            break;

        case "STOP_MONITORING":
            console.log("[CI] Stopping video monitoring");
            // 可以在这里添加停止监控逻辑
            break;

        case "UPDATE_VIDEO_INFO":
            console.log("[CI] Video info updated:", message.payload);
            // 处理视频信息更新
            break;

        case "RECORD_SESSION":
            console.log("[CI] Recording session:", message.payload);
            // 处理会话记录
            break;

        default:
            console.log("[CI] Unknown message type:", message.type);
    }
});

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
    console.log("[CI] Extension installed:", details.reason);

    if (details.reason === "install") {
        // 首次安装时的初始化逻辑
        console.log("[CI] First time installation");
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

export {};
