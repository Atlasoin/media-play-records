// 视频监控内容脚本
// 在网页中运行，监控视频播放状态

import { VideoInfo } from "../types/video";

console.log("[CI] Video monitor content script loaded");

class VideoMonitor {
    private currentVideo: VideoInfo | null = null;
    private isMonitoring = false;
    private lastUpdateTime = 0;
    private updateInterval: number | null = null;

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
            this.currentVideo = {
                title: this.getVideoTitle(),
                url: window.location.href,
                duration: video.duration,
                currentTime: video.currentTime,
                isPlaying: true,
            };
            this.updateVideoInfo();
        });

        // 播放暂停
        video.addEventListener("pause", () => {
            console.log("[CI] Video paused");
            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.currentTime;
                this.updateVideoInfo();
            }
        });

        // 播放结束
        video.addEventListener("ended", () => {
            console.log("[CI] Video ended");
            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.duration;
                this.updateVideoInfo();
            }
        });

        // 时间更新
        video.addEventListener("timeupdate", () => {
            if (this.currentVideo && this.currentVideo.isPlaying) {
                this.currentVideo.currentTime = video.currentTime;
                this.updateVideoInfo();
            }
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

    private recordSession() {
        if (!this.currentVideo) return;

        // 记录播放会话
        chrome.runtime.sendMessage({
            type: "RECORD_SESSION",
            payload: {
                videoTitle: this.currentVideo.title,
                videoUrl: this.currentVideo.url,
                duration: this.currentVideo.duration,
                currentTime: this.currentVideo.currentTime,
                timestamp: Date.now(),
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
