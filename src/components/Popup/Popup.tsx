import React, { useState, useEffect } from "react";
import { databaseService } from "../../services/database";
import { PlaybackRecord } from "../../types/database";
import { formatDuration } from "../../utils/time";
import "./Popup.css";

interface PopupProps {
    onOpenHistory: () => void;
}

export const Popup: React.FC<PopupProps> = ({ onOpenHistory }) => {
    const [currentStatus, setCurrentStatus] = useState<string>("stopped");
    const [currentDuration, setCurrentDuration] = useState<number>(0);
    const [todayRecords, setTodayRecords] = useState<PlaybackRecord[]>([]);
    const [totalDuration, setTotalDuration] = useState<number>(0);

    useEffect(() => {
        initializePopup();
        setupMessageListener();
    }, []);

    const initializePopup = async () => {
        try {
            await databaseService.initDB();
            await loadTodayData();
        } catch (error) {
            console.error("[CI] Error initializing popup:", error);
        }
    };

    const loadTodayData = async () => {
        try {
            const records = await databaseService.getTodayRecords();
            setTodayRecords(records);

            const total = records.reduce(
                (sum, record) => sum + record.duration,
                0
            );
            setTotalDuration(total);
        } catch (error) {
            console.error("[CI] Error loading today data:", error);
        }
    };

    const setupMessageListener = () => {
        chrome.runtime.onMessage.addListener(
            (message, sender, sendResponse) => {
                console.log("[CI] Received message:", message);

                switch (message.type) {
                    case "updateStatus":
                        setCurrentStatus(message.status);
                        break;
                    case "updateDuration":
                        setCurrentDuration(message.duration);
                        break;
                    case "recordHistory":
                        loadTodayData(); // 重新加载数据
                        break;
                    case "getData":
                        sendResponse({
                            status: currentStatus,
                            duration: currentDuration,
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

    return (
        <div className="popup-container">
            <h2>CI Monitor</h2>

            <div className="status-section">
                <div className="status-item">
                    <span className="label">状态：</span>
                    <span className="value" id="playbackStatus">
                        {currentStatus === "playing" ? "播放中" : "已停止"}
                    </span>
                </div>

                <div className="status-item">
                    <span className="label">当前时长：</span>
                    <span className="value" id="playbackDuration">
                        {formatDuration(currentDuration)}
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
            </div>

            <div className="actions-section">
                <button className="history-btn" onClick={handleOpenHistory}>
                    查看历史记录
                </button>
            </div>
        </div>
    );
};
