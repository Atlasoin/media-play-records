import React, { useState, useEffect } from "react";
import { databaseService } from "../../services/database";
import { PlaybackRecord } from "../../types/database";
import "./Calendar.css";

interface CalendarProps {
    languageFilter: string;
    goalInputs: Record<string, number>;
}

interface CalendarDay {
    date: Date;
    dateStr?: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    duration?: Record<string, number>;
    isAchieved?: boolean;
}

const Calendar: React.FC<CalendarProps> = ({ languageFilter, goalInputs }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [dailyDurations, setDailyDurations] = useState<
        Map<string, Record<string, number>>
    >(new Map());

    useEffect(() => {
        updateDailyDurations();
    }, []);

    // Update daily duration data
    const updateDailyDurations = async () => {
        try {
            const allRecords = await databaseService.getAllRecords();
            const durations = new Map<string, Record<string, number>>();

            allRecords.forEach((record) => {
                const date = new Date(record.date);
                const dateStr = `${date.getFullYear()}-${String(
                    date.getMonth() + 1
                ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

                let dayRecord = durations.get(dateStr) || {
                    cantonese: 0,
                    english: 0,
                    japanese: 0,
                    spanish: 0,
                };

                dayRecord[record.language] =
                    (dayRecord[record.language] || 0) + record.duration;
                durations.set(dateStr, dayRecord);
            });

            setDailyDurations(durations);
        } catch (error) {
            console.error("Error updating daily durations:", error);
        }
    };

    // Check if a day meets the goal
    const isDayAchieved = (dateStr: string, languageFilter: string) => {
        const dayRecord = dailyDurations.get(dateStr);
        if (!dayRecord) return false;

        if (languageFilter === "all") {
            return Object.entries(dayRecord).some(([lang, duration]) => {
                const goal = goalInputs[lang] || 0;
                return goal > 0 && Math.floor(duration / 60) >= goal;
            });
        } else {
            const goal = goalInputs[languageFilter] || 0;
            return (
                goal > 0 && Math.floor(dayRecord[languageFilter] / 60) >= goal
            );
        }
    };

    // Generate calendar data
    const generateCalendarDays = (): CalendarDay[] => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstDayWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days: CalendarDay[] = [];

        // Add previous month's dates
        const prevMonthLastDay = new Date(year, month, 0);
        for (let i = firstDayWeekday - 1; i >= 0; i--) {
            const day = prevMonthLastDay.getDate() - i;
            days.push({
                date: new Date(year, month - 1, day),
                isCurrentMonth: false,
                isToday: false,
            });
        }

        // Add current month's dates
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
            )}-${String(i).padStart(2, "0")}`;
            const today = new Date();
            const isToday = date.toDateString() === today.toDateString();

            days.push({
                date,
                dateStr,
                isCurrentMonth: true,
                isToday,
                duration: dailyDurations.get(dateStr),
                isAchieved: isDayAchieved(dateStr, languageFilter),
            });
        }

        // Add next month's dates
        const remainingDays = 42 - days.length;
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false,
                isToday: false,
            });
        }

        return days;
    };

    // Change month
    const changeMonth = (direction: "prev" | "next") => {
        setCurrentMonth((prev) => {
            const newMonth = new Date(prev);
            if (direction === "prev") {
                newMonth.setMonth(newMonth.getMonth() - 1);
            } else {
                newMonth.setMonth(newMonth.getMonth() + 1);
            }
            return newMonth;
        });
    };

    return (
        <div className="calendar-view">
            <h3>Calendar View</h3>
            <div className="calendar-header">
                <button
                    onClick={() => changeMonth("prev")}
                    className="calendar-nav-btn"
                >
                    &lt;
                </button>
                <h4>
                    {currentMonth.getFullYear()}/{currentMonth.getMonth() + 1}
                </h4>
                <button
                    onClick={() => changeMonth("next")}
                    className="calendar-nav-btn"
                >
                    &gt;
                </button>
            </div>
            <div className="calendar-grid">
                <div className="calendar-weekdays">
                    <div>Sun</div>
                    <div>Mon</div>
                    <div>Tue</div>
                    <div>Wed</div>
                    <div>Thu</div>
                    <div>Fri</div>
                    <div>Sat</div>
                </div>
                <div className="calendar-days">
                    {generateCalendarDays().map((day, index) => (
                        <div
                            key={index}
                            className={`calendar-day ${
                                !day.isCurrentMonth ? "other-month" : ""
                            } ${day.isToday ? "today" : ""} ${
                                day.isAchieved ? "achieved" : ""
                            }`}
                        >
                            <span className="day-number">
                                {day.date.getDate()}
                            </span>
                            {day.isCurrentMonth && day.duration && (
                                <div className="day-duration">
                                    {languageFilter === "all" ? (
                                        Object.entries(day.duration).map(
                                            ([lang, duration]) => {
                                                const goal =
                                                    goalInputs[lang] || 0;
                                                if (goal > 0 && duration > 0) {
                                                    return (
                                                        <div
                                                            key={lang}
                                                            className="lang-duration"
                                                        >
                                                            {Math.floor(
                                                                duration / 60
                                                            )}
                                                            /{goal}min
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }
                                        )
                                    ) : (
                                        <div className="lang-duration">
                                            {Math.floor(
                                                day.duration[languageFilter] /
                                                    60
                                            )}
                                            min
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Calendar;
