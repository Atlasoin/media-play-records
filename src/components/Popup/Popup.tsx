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
        // Update data periodically
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
            // Get current status
            const status = await getCurrentStatus();
            setCurrentStatus(status);

            // Get statistics
            const statsData = await getStats();
            setStats(statsData);

            // Get today's records
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
                    console.log("[CI] Popup received response:", response);
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
                        loadData(); // Reload data
                        break;
                    case "updateDuration":
                        loadData(); // Reload data
                        break;
                    case "recordHistory":
                        loadData(); // Reload data
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
            cantonese: "Cantonese",
            english: "English",
            japanese: "Japanese",
            spanish: "Spanish",
        };
        return labels[language as keyof typeof labels] || language;
    };

    return (
        <div className="popup-container">
            <h2>CI Monitor</h2>

            <div className="status-section">
                <div className="status-item">
                    <span className="label">Current Video:</span>
                    <span className="value">
                        {currentStatus?.currentPlaying
                            ? currentStatus?.currentSession?.title
                            : "Not Playing"}
                    </span>
                </div>

                <div className="status-item">
                    <span className="label">Current Duration:</span>
                    <span className="value">
                        {formatDuration(
                            currentStatus?.currentSession?.duration || 0
                        )}
                    </span>
                </div>
            </div>

            <div className="summary-section">
                <h3>Today's Statistics</h3>
                <div className="total-duration">
                    Total Duration: {formatDuration(totalDuration)}
                </div>
                <div className="record-count">
                    Record Count: {todayRecords.length}
                </div>
                <div className="stats-grid">
                    {[
                        { key: "cantonese", label: "Cantonese" },
                        { key: "english", label: "English" },
                        { key: "japanese", label: "Japanese" },
                        { key: "spanish", label: "Spanish" },
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
                                        {goalMinutes} min
                                    </span>
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="actions-section">
                <button className="history-btn" onClick={handleOpenHistory}>
                    View History
                </button>
            </div>
        </div>
    );
};
