// 视频监控内容脚本
// 在网页中运行，监控视频播放状态

import { VideoInfo } from "../types/video";

console.log("[CI] Video monitor content script loaded");

class VideoMonitor {
    private currentVideo: VideoInfo | null = null;
    private isMonitoring = false;
    private lastUpdateTime = 0;
    private updateInterval: number | null = null;
    private currentSessionId: string | null = null;
    private sessionStartTime = 0;
    private currentDuration = 0;
    private currentStatus = "stopped";

    constructor() {
        this.init();
    }

    private init() {
        console.log("[CI] Initializing video monitor");

        // 监听页面变化
        this.observePageChanges();

        // 开始监控
        this.startMonitoring();

        // 监听来自后台的消息
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                this.handleMessage(message, sendResponse);
                return true; // 保持消息通道开放
            }
        );
    }

    private observePageChanges() {
        // 使用 MutationObserver 监听页面变化
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "childList") {
                    // 页面内容变化，重新检测视频
                    this.detectVideo();
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private detectVideo() {
        // 检测页面中的视频元素
        const videoElements = document.querySelectorAll("video");

        if (videoElements.length > 0) {
            const video = videoElements[0]; // 使用第一个视频元素
            this.setupVideoListeners(video);
        }
    }

    private setupVideoListeners(video: HTMLVideoElement) {
        console.log("[CI] Setting up video listeners");

        // 播放开始
        video.addEventListener("play", () => {
            console.log("[CI] Video started playing");
            this.handleVideoPlay(video);
        });

        // 播放暂停
        video.addEventListener("pause", () => {
            console.log("[CI] Video paused");
            this.handleVideoPause(video);
        });

        // 播放结束
        video.addEventListener("ended", () => {
            console.log("[CI] Video ended");
            this.handleVideoEnded(video);
        });

        // 时间更新
        video.addEventListener("timeupdate", () => {
            this.handleTimeUpdate(video);
        });

        // 加载元数据
        video.addEventListener("loadedmetadata", () => {
            console.log("[CI] Video metadata loaded");
            if (this.currentVideo) {
                this.currentVideo.duration = video.duration;
                this.updateVideoInfo();
            }
        });
    }

    private handleVideoPlay(video: HTMLVideoElement) {
        console.log("[CI] Video play event:", {
            src: video.src,
            currentTime: video.currentTime,
            duration: video.duration,
            playbackRate: video.playbackRate,
        });

        if (this.currentStatus !== "playing") {
            this.currentStatus = "playing";
            this.sessionStartTime = Date.now();
            this.lastUpdateTime = Date.now();
            this.currentDuration = 0; // 重置当前会话的时长
            this.currentSessionId = this.generateSessionId(); // 生成新的 session ID

            this.currentVideo = {
                title: this.getVideoTitle(),
                url: window.location.href,
                duration: video.duration,
                currentTime: video.currentTime,
                isPlaying: true,
                channelName: this.getYouTubeChannelInfo().channelName || "",
                channelLogo: this.getYouTubeChannelInfo().channelLogo || "",
            };

            // 发送消息到 background
            chrome.runtime.sendMessage({
                type: "START_MONITORING",
                status: this.currentStatus,
                url: window.location.href,
                title: this.currentVideo.title,
                sessionId: this.currentSessionId,
                date: this.sessionStartTime,
                channelName: this.currentVideo.channelName,
                channelLogo: this.currentVideo.channelLogo,
            });

            console.log("[CI] Session started:", {
                sessionId: this.currentSessionId,
                startTime: new Date(this.sessionStartTime).toISOString(),
                date: this.sessionStartTime,
                currentDuration: this.currentDuration,
                channelName: this.currentVideo.channelName,
                channelLogo: this.currentVideo.channelLogo,
            });
        }
    }

    private handleVideoPause(video: HTMLVideoElement) {
        console.log("[CI] Video pause event:", {
            src: video.src,
            currentTime: video.currentTime,
            duration: video.duration,
            playbackRate: video.playbackRate,
        });

        if (this.currentStatus === "playing") {
            this.currentStatus = "paused";
            // 强制更新最后一次的播放时长
            this.updatePlaybackDuration(video, true);

            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.currentTime;
            }

            // 发送消息到 background
            chrome.runtime.sendMessage({
                type: "PAUSE_MONITORING",
                status: this.currentStatus,
                duration: this.currentDuration,
                url: window.location.href,
                title: this.currentVideo?.title || document.title,
                sessionId: this.currentSessionId,
                date: this.sessionStartTime,
                channelName: this.currentVideo?.channelName || "",
                channelLogo: this.currentVideo?.channelLogo || "",
            });

            console.log("[CI] Session paused:", {
                sessionId: this.currentSessionId,
                currentDuration: this.currentDuration,
                channelName: this.currentVideo?.channelName,
                channelLogo: this.currentVideo?.channelLogo,
            });

            // 重置 session ID，下次播放时生成新的
            this.currentSessionId = null;
        }
    }

    private handleVideoEnded(video: HTMLVideoElement) {
        console.log("[CI] Video ended event:", {
            src: video.src,
            currentTime: video.currentTime,
            duration: video.duration,
            playbackRate: video.playbackRate,
        });

        if (this.currentStatus === "playing") {
            this.currentStatus = "ended";
            // 强制更新最后一次的播放时长
            this.updatePlaybackDuration(video, true);

            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.duration;
            }

            // 发送消息到 background
            chrome.runtime.sendMessage({
                type: "STOP_MONITORING",
                status: this.currentStatus,
                duration: this.currentDuration,
                url: window.location.href,
                title: this.currentVideo?.title || document.title,
                sessionId: this.currentSessionId,
                date: this.sessionStartTime,
                channelName: this.currentVideo?.channelName || "",
                channelLogo: this.currentVideo?.channelLogo || "",
            });

            console.log("[CI] Session ended:", {
                sessionId: this.currentSessionId,
                totalDuration: this.currentDuration,
                channelName: this.currentVideo?.channelName,
                channelLogo: this.currentVideo?.channelLogo,
            });

            // 重置 session ID
            this.currentSessionId = null;
        }
    }

    private handleTimeUpdate(video: HTMLVideoElement) {
        // 检查视频是否真的在播放
        if (this.currentStatus === "playing" && !video.paused) {
            this.updatePlaybackDuration(video);
        }
    }

    private updatePlaybackDuration(
        video: HTMLVideoElement,
        forceUpdate = false
    ) {
        if (!video) return;

        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;

        // 只有当距离上次更新超过1秒时才更新
        if (timeSinceLastUpdate >= 1000 || forceUpdate) {
            // 计算实际播放时间（毫秒）
            const playbackTime = timeSinceLastUpdate;
            this.currentDuration += Math.floor(playbackTime / 1000); // 转换为秒
            this.lastUpdateTime = now;

            // 发送消息到 background
            chrome.runtime.sendMessage({
                type: "RECORD_SESSION",
                duration: this.currentDuration,
                url: window.location.href,
                title: this.currentVideo?.title || document.title,
                sessionId: this.currentSessionId,
                date: this.sessionStartTime,
                channelName: this.currentVideo?.channelName || "",
                channelLogo: this.currentVideo?.channelLogo || "",
            });

            console.log("[CI] Duration updated:", {
                sessionId: this.currentSessionId,
                currentDuration: this.currentDuration,
                playbackTime,
                lastUpdateTime: new Date(this.lastUpdateTime).toISOString(),
                channelName: this.currentVideo?.channelName,
                channelLogo: this.currentVideo?.channelLogo,
            });
        }
    }

    private getVideoTitle(): string {
        // 尝试从不同位置获取视频标题
        const selectors = [
            "h1",
            ".title",
            ".video-title",
            '[data-testid="video-title"]',
            "title",
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent) {
                return element.textContent.trim();
            }
        }

        return document.title || "Unknown Video";
    }

    private getYouTubeChannelInfo() {
        // 频道名称
        const channelName = document
            .querySelector("#text-container.ytd-channel-name, #channel-name")
            ?.textContent?.trim();
        console.log("[CI] Channel name:", channelName);
        // 频道 logo
        const channelLogo = document
            .querySelector("#avatar.ytd-channel-name img, #owner #img")
            ?.getAttribute("src");
        return { channelName, channelLogo };
    }

    private updateVideoInfo() {
        if (!this.currentVideo) return;

        const now = Date.now();

        // 限制更新频率，避免过于频繁的更新
        if (now - this.lastUpdateTime < 1000) return;

        this.lastUpdateTime = now;

        // 发送视频信息到后台
        chrome.runtime.sendMessage({
            type: "UPDATE_VIDEO_INFO",
            payload: this.currentVideo,
        });

        // 如果视频正在播放，记录会话
        if (this.currentVideo.isPlaying) {
            this.recordSession();
        }
    }

    // 生成随机 session ID
    private generateSessionId() {
        return (
            "session_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9)
        );
    }

    private recordSession() {
        if (!this.currentVideo) return;

        // 记录播放会话
        chrome.runtime.sendMessage({
            type: "RECORD_SESSION",
            payload: {
                sessionId: this.currentSessionId,
                title: this.currentVideo.title,
                url: this.currentVideo.url,
                channelName: this.currentVideo.channelName,
                channelLogo: this.currentVideo.channelLogo,
                duration: this.currentVideo.duration,
                currentTime: this.currentVideo.currentTime,
                timestamp: Date.now(),
                date: this.sessionStartTime,
            },
        });
    }

    private startMonitoring() {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        console.log("[CI] Started video monitoring");

        // 立即检测一次视频
        this.detectVideo();

        // 定期检测视频（以防动态加载）
        this.updateInterval = window.setInterval(() => {
            this.detectVideo();
        }, 5000); // 每5秒检测一次

        // 通知后台开始监控
        chrome.runtime.sendMessage({
            type: "START_MONITORING",
        });
    }

    private stopMonitoring() {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        console.log("[CI] Stopped video monitoring");

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // 通知后台停止监控
        chrome.runtime.sendMessage({
            type: "STOP_MONITORING",
        });
    }

    private handleMessage(
        message: any,
        sendResponse: (response?: any) => void
    ) {
        console.log("[CI] Content script received message:", message);

        switch (message.type) {
            case "GET_VIDEO_INFO":
                sendResponse(this.currentVideo);
                break;

            case "START_MONITORING":
                this.startMonitoring();
                sendResponse({ success: true });
                break;

            case "STOP_MONITORING":
                this.stopMonitoring();
                sendResponse({ success: true });
                break;

            default:
                console.log("[CI] Unknown message type:", message.type);
                sendResponse({ error: "Unknown message type" });
        }
    }
}

// 初始化视频监控
new VideoMonitor();

export {};
