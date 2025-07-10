import React, { useState, useEffect } from "react";
import { databaseService } from "../../services/database";
import { DailyGoal, PlaybackRecord } from "../../types/database";
import { formatDuration } from "../../utils/time";
import Calendar from "../Calendar";
import "./History.css";
import { DEFAULT_DAILY_GOAL } from "../../utils/constants";

interface HistoryProps {
    onBack: () => void;
}

const LANGUAGES = [
    { key: "cantonese", label: "粤语" },
    { key: "english", label: "英语" },
    { key: "japanese", label: "日语" },
    { key: "spanish", label: "西班牙语" },
];

const History: React.FC<HistoryProps> = ({ onBack }) => {
    const [goals, setGoals] = useState<DailyGoal[]>([]);
    const [records, setRecords] = useState<PlaybackRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(
        new Date().toISOString().slice(0, 7) // YYYY-MM format
    );
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [dateFilter, setDateFilter] = useState("all");
    const [languageFilter, setLanguageFilter] = useState("all");
    const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
    const [goalInputs, setGoalInputs] =
        useState<Record<string, number>>(DEFAULT_DAILY_GOAL);

    useEffect(() => {
        loadGoals();
        loadRecords();
    }, [selectedMonth, dateFilter, languageFilter]);

    // 加载今日或最近的目标并回显到输入框
    const loadGoals = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split("T")[0];
            let dailyGoal = await databaseService.getDailyGoal(today);
            if (!dailyGoal) {
                dailyGoal = {
                    date: today,
                    goals: DEFAULT_DAILY_GOAL,
                    updatedAt: new Date().toISOString(),
                };
            }
            setGoalInputs(dailyGoal.goals);
            let allGoals = await databaseService.getAllDailyGoals();
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

    const loadRecords = async () => {
        try {
            const allRecords = await databaseService.getAllRecords();

            // 过滤记录
            let filteredRecords = allRecords.filter((record) => {
                // 语言过滤
                if (
                    languageFilter !== "all" &&
                    record.language !== languageFilter
                ) {
                    return false;
                }

                // 时间过滤
                const recordDate = new Date(record.date);
                const now = new Date();
                const today = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                );
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - today.getDay());
                const monthStart = new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    1
                );

                switch (dateFilter) {
                    case "today":
                        return recordDate >= today;
                    case "week":
                        return recordDate >= weekStart;
                    case "month":
                        return recordDate >= monthStart;
                    default:
                        return true;
                }
            });

            // 按日期排序
            filteredRecords.sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setRecords(filteredRecords);
        } catch (error) {
            console.error("Failed to load records:", error);
        }
    };

    const getLanguageStats = () => {
        const stats = {
            cantonese: 0,
            english: 0,
            japanese: 0,
            spanish: 0,
        };
        console.log("records", records);
        // 统计实际学习时间，而不是目标时间
        records.forEach((record) => {
            if (record.language in stats) {
                stats[record.language as keyof typeof stats] += record.duration;
            }
        });

        return stats;
    };

    const languageStats = getLanguageStats();

    // 数据管理功能
    const exportData = async () => {
        try {
            const data = {
                version: "1.0",
                exportDate: new Date().toISOString(),
                records: records,
                goals: goals,
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `video-history-${
                new Date().toISOString().split("T")[0]
            }.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error exporting data:", error);
            alert("导出数据失败，请重试");
        }
    };

    const importData = async (file: File) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (
                !data.version ||
                !data.records ||
                !Array.isArray(data.records)
            ) {
                throw new Error("Invalid data format");
            }

            for (const record of data.records) {
                await databaseService.saveRecord(record);
            }

            await loadRecords();
            alert("数据导入成功");
        } catch (error) {
            console.error("Error importing data:", error);
            alert("导入数据失败，请确保文件格式正确");
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            importData(file);
        }
    };

    const generateSessionId = () => {
        return (
            "manual_session_" +
            Date.now() +
            "_" +
            Math.random().toString(36).substr(2, 9)
        );
    };

    const handleManualEntry = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        const date = formData.get("date") as string;
        const title = formData.get("title") as string;
        const url = formData.get("url") as string;
        const durationMinutes = parseInt(formData.get("duration") as string);
        const language = formData.get("language") as string;

        if (!date || !title || !durationMinutes || !language) {
            alert("请填写所有必填字段");
            return;
        }

        const record: PlaybackRecord = {
            sessionId: generateSessionId(),
            duration: durationMinutes * 60,
            title: title,
            language: language as any,
            date: new Date(date).toISOString(),
            url: url || "manual-entry",
        };

        try {
            await databaseService.saveRecord(record);
            setShowManualEntry(false);
            await loadRecords();
            alert("记录已添加");
        } catch (error) {
            console.error("Error adding manual entry:", error);
            alert("添加记录失败，请重试");
        }
    };

    const deleteRecord = async (sessionId: string) => {
        if (confirm("确定要删除这条记录吗？")) {
            try {
                await databaseService.deleteRecord(sessionId);
                await loadRecords();
            } catch (error) {
                console.error("Error deleting record:", error);
                alert("删除失败，请重试");
            }
        }
    };

    const batchDelete = async () => {
        if (selectedRecords.length === 0) return;

        if (confirm(`确定要删除选中的 ${selectedRecords.length} 条记录吗？`)) {
            try {
                for (const sessionId of selectedRecords) {
                    await databaseService.deleteRecord(sessionId);
                }
                setSelectedRecords([]);
                await loadRecords();
                alert("批量删除成功");
            } catch (error) {
                console.error("Error batch deleting records:", error);
                alert("批量删除失败，请重试");
            }
        }
    };

    const toggleRecordSelection = (sessionId: string) => {
        setSelectedRecords((prev) =>
            prev.includes(sessionId)
                ? prev.filter((id) => id !== sessionId)
                : [...prev, sessionId]
        );
    };

    // 保存目标
    const saveGoal = async (language: string) => {
        try {
            const today = new Date().toISOString().split("T")[0];
            const existingDailyGoal = await databaseService.getDailyGoal(today);
            // 保证goals对象有所有语言
            const goals: Record<string, number> = {
                cantonese: 0,
                english: 0,
                japanese: 0,
                spanish: 0,
                ...(existingDailyGoal ? existingDailyGoal.goals : {}),
            };
            goals[language] = goalInputs[language] || 0;
            await databaseService.saveDailyGoal({
                date: today,
                goals,
                updatedAt: new Date().toISOString(),
            });
            alert("目标已保存");
            await loadGoals();
        } catch (error) {
            console.error("Error saving goal:", error);
            alert("保存目标失败，请重试");
        }
    };

    // 目标输入框变更
    const handleGoalInputChange = (language: string, value: string) => {
        setGoalInputs((prev) => ({ ...prev, [language]: Number(value) }));
    };

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
            {/* 目标设置区域 */}
            <div className="goals-section">
                <h3>学习目标设置</h3>
                <div className="goals-container">
                    {LANGUAGES.map((lang) => (
                        <div className="goal-item" key={lang.key}>
                            <label>{lang.label}目标（分钟/天）：</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={goalInputs[lang.key] || 0}
                                onChange={(e) =>
                                    handleGoalInputChange(
                                        lang.key,
                                        e.target.value
                                    )
                                }
                            />
                            <button
                                onClick={() => saveGoal(lang.key)}
                                className="save-goal-btn"
                            >
                                保存
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 数据管理按钮 */}
            <div className="data-management">
                <button onClick={exportData} className="action-btn">
                    导出数据
                </button>
                <label htmlFor="importBtn" className="action-btn">
                    导入数据
                </label>
                <input
                    type="file"
                    id="importBtn"
                    accept=".json"
                    style={{ display: "none" }}
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => setShowManualEntry(true)}
                    className="action-btn"
                >
                    添加记录
                </button>
                {selectedRecords.length > 0 && (
                    <button
                        onClick={batchDelete}
                        className="action-btn delete-btn"
                    >
                        批量删除 ({selectedRecords.length})
                    </button>
                )}
            </div>

            {/* 筛选器 */}
            <div className="filters">
                <div className="filter-group">
                    <label htmlFor="dateFilter">时间：</label>
                    <select
                        id="dateFilter"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                    >
                        <option value="all">所有时间</option>
                        <option value="today">今天</option>
                        <option value="week">本周</option>
                        <option value="month">本月</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="languageFilter">语言：</label>
                    <select
                        id="languageFilter"
                        value={languageFilter}
                        onChange={(e) => setLanguageFilter(e.target.value)}
                    >
                        <option value="all">所有语言</option>
                        <option value="cantonese">粤语</option>
                        <option value="english">英语</option>
                        <option value="japanese">日语</option>
                        <option value="spanish">西班牙语</option>
                    </select>
                </div>
            </div>

            {/* 手动录入弹窗 */}
            {showManualEntry && (
                <div
                    className="modal-overlay"
                    onClick={() => setShowManualEntry(false)}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>手动添加记录</h3>
                            <button
                                className="close-btn"
                                onClick={() => setShowManualEntry(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <form onSubmit={handleManualEntry}>
                            <div className="form-group">
                                <label htmlFor="entryDate">日期：</label>
                                <input
                                    type="date"
                                    name="date"
                                    id="entryDate"
                                    defaultValue={
                                        new Date().toISOString().split("T")[0]
                                    }
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="entryTitle">标题：</label>
                                <input
                                    type="text"
                                    name="title"
                                    id="entryTitle"
                                    placeholder="输入视频标题"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="entryUrl">URL（可选）：</label>
                                <input
                                    type="url"
                                    name="url"
                                    id="entryUrl"
                                    placeholder="输入视频链接"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="entryDuration">
                                    时长（分钟）：
                                </label>
                                <input
                                    type="number"
                                    name="duration"
                                    id="entryDuration"
                                    min="1"
                                    step="1"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="entryLanguage">语言：</label>
                                <select
                                    name="language"
                                    id="entryLanguage"
                                    required
                                >
                                    <option value="cantonese">粤语</option>
                                    <option value="english">英语</option>
                                    <option value="japanese">日语</option>
                                    <option value="spanish">西班牙语</option>
                                </select>
                            </div>
                            <div className="button-group">
                                <button type="submit" className="submit-btn">
                                    添加记录
                                </button>
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => setShowManualEntry(false)}
                                >
                                    取消
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 统计摘要 */}
            <div className="stats-summary">
                <h3>统计摘要</h3>
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

            {/* 日历视图 */}
            <Calendar languageFilter={languageFilter} goalInputs={goalInputs} />

            {/* 记录列表 */}
            <div className="records-list">
                <h3>详细记录</h3>
                {records.length === 0 ? (
                    <div className="no-records">暂无记录</div>
                ) : (
                    <div className="records-grid">
                        {records.map((record) => (
                            <div key={record.sessionId} className="record-item">
                                <div className="record-header">
                                    <input
                                        type="checkbox"
                                        checked={selectedRecords.includes(
                                            record.sessionId
                                        )}
                                        onChange={() =>
                                            toggleRecordSelection(
                                                record.sessionId
                                            )
                                        }
                                        className="record-checkbox"
                                    />
                                    <span className="record-date">
                                        {new Date(record.date).toLocaleString(
                                            "zh-CN",
                                            {
                                                year: "numeric",
                                                month: "2-digit",
                                                day: "2-digit",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            }
                                        )}
                                    </span>
                                </div>
                                <div className="record-content">
                                    <div className="record-title">
                                        {record.title}
                                    </div>
                                    <div className="record-details">
                                        <span className="record-duration">
                                            {formatDuration(record.duration)}
                                        </span>
                                        <span className="record-language">
                                            {{
                                                cantonese: "粤语",
                                                english: "英语",
                                                japanese: "日语",
                                                spanish: "西班牙语",
                                            }[record.language] || "未知"}
                                        </span>
                                    </div>
                                    {record.channelName && (
                                        <div className="record-channel">
                                            {record.channelLogo && (
                                                <img
                                                    src={record.channelLogo}
                                                    alt="logo"
                                                    className="channel-logo"
                                                />
                                            )}
                                            <span>{record.channelName}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="record-actions">
                                    <button
                                        onClick={() =>
                                            deleteRecord(record.sessionId)
                                        }
                                        className="delete-btn"
                                    >
                                        删除
                                    </button>
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
