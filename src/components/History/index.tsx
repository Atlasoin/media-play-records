import React, { useState, useEffect } from "react";
import { databaseService } from "../../services/database";
import { DailyGoal } from "../../types/database";
import { formatDate, formatDuration } from "../../utils/time";
import "./History.css";

interface HistoryProps {
    onBack: () => void;
}

const History: React.FC<HistoryProps> = ({ onBack }) => {
    const [goals, setGoals] = useState<DailyGoal[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(
        new Date().toISOString().slice(0, 7) // YYYY-MM format
    );

    useEffect(() => {
        loadGoals();
    }, [selectedMonth]);

    const loadGoals = async () => {
        try {
            setLoading(true);
            const allGoals = await databaseService.getAllDailyGoals();

            // 过滤选中月份的目标
            const filteredGoals = allGoals.filter((goal) =>
                goal.date.startsWith(selectedMonth)
            );

            setGoals(filteredGoals);
        } catch (error) {
            console.error("Failed to load goals:", error);
        } finally {
            setLoading(false);
        }
    };

    const getMonthOptions = (): Array<{ value: string; label: string }> => {
        const options: Array<{ value: string; label: string }> = [];
        const currentDate = new Date();

        // 生成过去12个月的选项
        for (let i = 0; i < 12; i++) {
            const date = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() - i,
                1
            );
            const value = date.toISOString().slice(0, 7);
            const label = date.toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
            });
            options.push({ value, label });
        }

        return options;
    };

    const calculateTotalTime = (goal: DailyGoal) => {
        return Object.values(goal.goals).reduce(
            (total, time) => total + time,
            0
        );
    };

    const isGoalAchieved = (goal: DailyGoal) => {
        const totalTime = calculateTotalTime(goal);
        return totalTime >= 30; // 假设目标是30分钟
    };

    const getLanguageStats = () => {
        const stats = {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        };

        goals.forEach((goal) => {
            Object.entries(goal.goals).forEach(([lang, time]) => {
                if (lang in stats) {
                    stats[lang as keyof typeof stats] += time;
                }
            });
        });

        return stats;
    };

    const languageStats = getLanguageStats();

    if (loading) {
        return (
            <div className="history-container">
                <div className="history-header">
                    <button className="back-button" onClick={onBack}>
                        ← 返回
                    </button>
                    <h2>历史记录</h2>
                </div>
                <div className="loading">加载中...</div>
            </div>
        );
    }

    return (
        <div className="history-container">
            <div className="history-header">
                <button className="back-button" onClick={onBack}>
                    ← 返回
                </button>
                <h2>历史记录</h2>
            </div>

            <div className="month-selector">
                <label htmlFor="month-select">选择月份：</label>
                <select
                    id="month-select"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    {getMonthOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="stats-summary">
                <h3>本月统计</h3>
                <div className="stats-grid">
                    <div className="stat-item">
                        <span className="stat-label">粤语</span>
                        <span className="stat-value">
                            {formatDuration(languageStats.cantonese)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">英语</span>
                        <span className="stat-value">
                            {formatDuration(languageStats.english)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">日语</span>
                        <span className="stat-value">
                            {formatDuration(languageStats.japanese)}
                        </span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-label">西班牙语</span>
                        <span className="stat-value">
                            {formatDuration(languageStats.spanish)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="goals-list">
                <h3>每日记录</h3>
                {goals.length === 0 ? (
                    <div className="no-goals">本月暂无记录</div>
                ) : (
                    <div className="goals-grid">
                        {goals.map((goal) => (
                            <div
                                key={goal.date}
                                className={`goal-item ${
                                    isGoalAchieved(goal) ? "achieved" : ""
                                }`}
                            >
                                <div className="goal-date">
                                    {formatDate(goal.date)}
                                </div>
                                <div className="goal-languages">
                                    {Object.entries(goal.goals).map(
                                        ([lang, time]) =>
                                            time > 0 && (
                                                <div
                                                    key={lang}
                                                    className="language-item"
                                                >
                                                    <span className="language-name">
                                                        {lang}
                                                    </span>
                                                    <span className="language-time">
                                                        {formatDuration(time)}
                                                    </span>
                                                </div>
                                            )
                                    )}
                                </div>
                                <div className="goal-total">
                                    总计:{" "}
                                    {formatDuration(calculateTotalTime(goal))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default History;
