// Video monitoring content script
// Runs in web pages, monitors video playback status

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

        // Listen for page changes
        this.observePageChanges();

        // Start monitoring
        this.startMonitoring();

        // Listen for messages from background
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                this.handleMessage(message, sendResponse);
                return true; // Keep message channel open
            }
        );
    }

    private observePageChanges() {
        // Use MutationObserver to listen for page changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "childList") {
                    // Page content changed, re-detect video
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
        // Detect video elements in the page
        const videoElements = document.querySelectorAll("video");

        if (videoElements.length > 0) {
            const video = videoElements[0]; // Use the first video element
            this.setupVideoListeners(video);
        }
    }

    private setupVideoListeners(video: HTMLVideoElement) {
        console.log("[CI] Setting up video listeners");

        // Play start
        video.addEventListener("play", () => {
            console.log("[CI] Video started playing");
            this.handleVideoPlay(video);
        });

        // Play pause
        video.addEventListener("pause", () => {
            // console.log("[CI] Video paused");
            this.handleVideoPause(video);
        });

        // Play end
        video.addEventListener("ended", () => {
            console.log("[CI] Video ended");
            this.handleVideoEnded(video);
        });

        // Time update
        video.addEventListener("timeupdate", () => {
            this.handleTimeUpdate(video);
        });

        // Load metadata
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

        // Check if domain should be skipped
        if (this.shouldSkipDomain()) {
            console.log(
                "[CI] Skipping monitoring for domain:",
                window.location.hostname
            );
            return;
        }

        if (this.currentStatus !== "playing") {
            this.currentStatus = "playing";
            this.sessionStartTime = Date.now();
            this.lastUpdateTime = Date.now();
            this.currentDuration = 0; // Reset current session duration
            this.currentSessionId = this.generateSessionId(); // Generate new session ID

            this.currentVideo = {
                title: this.getVideoTitle(),
                url: window.location.href,
                duration: video.duration,
                currentTime: video.currentTime,
                isPlaying: true,
                channelName: this.getYouTubeChannelInfo().channelName || "",
                channelLogo: this.getYouTubeChannelInfo().channelLogo || "",
            };

            // Send message to background
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
            // Force update the last playback duration
            this.updatePlaybackDuration(video, true);

            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.currentTime;
            }

            // Send message to background
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

            // console.log("[CI] Session paused:", {
            //     sessionId: this.currentSessionId,
            //     currentDuration: this.currentDuration,
            //     channelName: this.currentVideo?.channelName,
            //     channelLogo: this.currentVideo?.channelLogo,
            // });

            // Reset session ID, generate new one on next play
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
            // Force update the last playback duration
            this.updatePlaybackDuration(video, true);

            if (this.currentVideo) {
                this.currentVideo.isPlaying = false;
                this.currentVideo.currentTime = video.duration;
            }

            // Send message to background
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

            // Reset session ID
            this.currentSessionId = null;
        }
    }

    private handleTimeUpdate(video: HTMLVideoElement) {
        // Check if video is actually playing
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

        // Only update if more than 1 second has passed since last update
        if (timeSinceLastUpdate >= 1000 || forceUpdate) {
            // Calculate actual playback time (milliseconds)
            const playbackTime = timeSinceLastUpdate;
            this.currentDuration += Math.floor(playbackTime / 1000); // Convert to seconds
            this.lastUpdateTime = now;

            // Send message to background
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
        // Try to get video title from different locations
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
        // Channel name
        const channelName = document
            .querySelector("#text-container.ytd-channel-name, #channel-name")
            ?.textContent?.trim();
        console.log("[CI] Channel name:", channelName);
        // Channel logo
        const channelLogo = document
            .querySelector("#avatar.ytd-channel-name img, #owner #img")
            ?.getAttribute("src");
        return { channelName, channelLogo };
    }

    private updateVideoInfo() {
        if (!this.currentVideo) return;

        const now = Date.now();

        // Limit update frequency to avoid too frequent updates
        if (now - this.lastUpdateTime < 1000) return;

        this.lastUpdateTime = now;

        // Send video info to background
        chrome.runtime.sendMessage({
            type: "UPDATE_VIDEO_INFO",
            payload: this.currentVideo,
        });

        // If video is playing, record session
        if (this.currentVideo.isPlaying) {
            this.recordSession();
        }
    }

    // Generate random session ID
    private generateSessionId() {
        return (
            "session_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9)
        );
    }

    private shouldSkipDomain(): boolean {
        const hostname = window.location.hostname.toLowerCase();
        const skipDomains = ["x.com", "twitter.com"];
        return skipDomains.includes(hostname);
    }

    private recordSession() {
        if (!this.currentVideo) return;

        // Record playback session
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

        // Detect video immediately
        this.detectVideo();

        // Periodically detect video (in case of dynamic loading)
        this.updateInterval = window.setInterval(() => {
            this.detectVideo();
        }, 5000); // Detect every 5 seconds

        // Notify background to start monitoring
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

        // Notify background to stop monitoring
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

// Initialize video monitoring
new VideoMonitor();

export {};
