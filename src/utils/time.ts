export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
    )}:${String(secs).padStart(2, "0")}`;
}

export function formatMinutes(seconds: number): number {
    return Math.floor(seconds / 60);
}

export function getTodayString(): string {
    return new Date().toISOString().split("T")[0];
}

export function getDateString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function isToday(dateStr: string): boolean {
    return dateStr === getTodayString();
}

export function getDateRange(filter: string): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
        case "today":
            return {
                start: today,
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            };
        case "week":
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            return {
                start: weekStart,
                end: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
            };
        case "month":
            const monthStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );
            return {
                start: monthStart,
                end: new Date(
                    monthStart.getFullYear(),
                    monthStart.getMonth() + 1,
                    1
                ),
            };
        default:
            return { start: new Date(0), end: new Date() };
    }
}
