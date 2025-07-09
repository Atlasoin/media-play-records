export interface VideoInfo {
    title: string;
    url: string;
    duration: number; // in seconds
    currentTime: number; // in seconds
    isPlaying: boolean;
    channelName?: string;
    channelLogo?: string;
}

export interface VideoMonitorState {
    isMonitoring: boolean;
    currentVideo: VideoInfo | null;
    sessionStartTime: number;
    totalDuration: number;
}

export interface VideoMonitorMessage {
    type:
        | "START_MONITORING"
        | "STOP_MONITORING"
        | "UPDATE_VIDEO_INFO"
        | "RECORD_SESSION";
    payload?: any;
}

export interface VideoSession {
    sessionId: string;
    videoInfo: VideoInfo;
    startTime: string;
    endTime: string;
    duration: number;
}
