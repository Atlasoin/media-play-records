import React, { useState, useEffect } from "react";
import { databaseService } from "../../services/database";
import { PlaybackRecord } from "../../types/database";
import { formatDuration, formatMinutes } from "../../utils/time";
import "./Popup.css";

interface PopupProps {
    onOpenHistory: () => void;
}

interface CurrentStatus {
    currentSession: PlaybackRecord | null;
    currentPlaying: boolean;
}

interface Stats {
    todayStats: {
        cantonese: number;
        english: number;
        japanese: number;
        spanish: number;
    };
    todayGoals: {
        cantonese: number;
        english: number;
        japanese: number;
        spanish: number;
    };
    totalTodayDuration: number;
    totalTodayGoal: number;
}

export const Popup: React.FC<PopupProps> = ({ onOpenHistory }) => {
    const [currentStatus, setCurrentStatus] = useState<CurrentStatus | null>(
        null
    );
    const [stats, setStats] = useState<Stats>({
        todayStats: {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        },
        todayGoals: {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        },
        totalTodayDuration: 0,
        totalTodayGoal: 0,
    });
    const [todayRecords, setTodayRecords] = useState<PlaybackRecord[]>([]);
    const [totalDuration, setTotalDuration] = useState<number>(0);

    useEffect(() => {
        initializePopup();
        setupMessageListener();
        // 定期更新数据
        const interval = setInterval(loadData, 1000);
        return () => clearInterval(interval);
    }, []);

    const initializePopup = async () => {
        try {
            await databaseService.initDB();
            await loadData();
        } catch (error) {
            console.error("[CI] Error initializing popup:", error);
        }
    };

    const loadData = async () => {
        try {
            // 获取当前状态
            const status = await getCurrentStatus();
            setCurrentStatus(status);

            // 获取统计数据
            const statsData = await getStats();
            setStats(statsData);

            // 获取今日记录
            const records = await databaseService.getTodayRecords();
            setTodayRecords(records);

            const total = records.reduce(
                (sum, record) => sum + record.duration,
                0
            );
            setTotalDuration(total);
        } catch (error) {
            console.error("[CI] Error loading data:", error);
        }
    };

    const getCurrentStatus = (): Promise<CurrentStatus> => {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                { type: "GET_CURRENT_STATUS" },
                (response) => {
                    resolve(
                        response || {
                            currentSession: null,
                            currentPlaying: false,
                        }
                    );
                }
            );
        });
    };

    const getStats = (): Promise<Stats> => {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "GET_STATS" }, (response) => {
                resolve(
                    response || {
                        todayStats: {
                            cantonese: 0,
                            english: 0,
                            japanese: 0,
                            spanish: 0,
                        },
                        todayGoals: {
                            cantonese: 0,
                            english: 0,
                            japanese: 0,
                            spanish: 0,
                        },
                        totalTodayDuration: 0,
                    }
                );
            });
        });
    };

    const setupMessageListener = () => {
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                console.log("[CI] Popup received message:", message);

                switch (message.type) {
                    case "updateStatus":
                        loadData(); // 重新加载数据
                        break;
                    case "updateDuration":
                        loadData(); // 重新加载数据
                        break;
                    case "recordHistory":
                        loadData(); // 重新加载数据
                        break;
                    case "getData":
                        sendResponse({
                            status: currentStatus,
                            history: todayRecords,
                        });
                        break;
                }
            }
        );
    };

    const handleOpenHistory = () => {
        onOpenHistory();
    };

    const getLanguageLabel = (language: string): string => {
        const labels = {
            cantonese: "粤语",
            english: "英语",
            japanese: "日语",
            spanish: "西班牙语",
        };
        return labels[language as keyof typeof labels] || language;
    };

    return (
        <div className="popup-container">
            <h2>CI Monitor</h2>

            <div className="status-section">
                <div className="status-item">
                    <span className="label">当前视频：</span>
                    <span className="value">
                        {currentStatus?.currentPlaying
                            ? currentStatus?.currentSession?.title
                            : "未播放"}
                    </span>
                </div>

                <div className="status-item">
                    <span className="label">当前时长：</span>
                    <span className="value">
                        {formatDuration(
                            currentStatus?.currentSession?.duration || 0
                        )}
                    </span>
                </div>
            </div>

            <div className="summary-section">
                <h3>今日统计</h3>
                <div className="total-duration">
                    总时长：{formatDuration(totalDuration)}
                </div>
                <div className="record-count">
                    记录数：{todayRecords.length}
                </div>
                <div className="stats-grid">
                    {[
                        { key: "cantonese", label: "粤语" },
                        { key: "english", label: "英语" },
                        { key: "japanese", label: "日语" },
                        { key: "spanish", label: "西班牙语" },
                    ].map(({ key, label }) => {
                        const actualMinutes = formatMinutes(
                            stats.todayStats[
                                key as keyof typeof stats.todayStats
                            ]
                        );
                        const goalMinutes =
                            stats.todayGoals[
                                key as keyof typeof stats.todayGoals
                            ];
                        const isAchieved =
                            goalMinutes > 0 &&
                            stats.todayStats[
                                key as keyof typeof stats.todayStats
                            ] >=
                                goalMinutes * 60;
                        const isPartial =
                            goalMinutes > 0 &&
                            stats.todayStats[
                                key as keyof typeof stats.todayStats
                            ] > 0 &&
                            !isAchieved;

                        return (
                            <div
                                key={key}
                                className={`stat-item ${
                                    isAchieved
                                        ? "achieved"
                                        : isPartial
                                        ? "partial"
                                        : ""
                                }`}
                            >
                                <span className="stat-label">{label}</span>
                                <span className="stat-value">
                                    <span className="actual-time">
                                        {actualMinutes}
                                    </span>
                                    <span>/</span>
                                    <span className="goal-time">
                                        {goalMinutes} 分钟
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="actions-section">
                <button className="history-btn" onClick={handleOpenHistory}>
                    查看历史记录
                </button>
            </div>
        </div>
    );
};
