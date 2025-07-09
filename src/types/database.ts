export interface PlaybackRecord {
    sessionId: string;
    title: string;
    url: string;
    language: Language;
    duration: number; // in seconds
    date: string; // ISO string
    channelName?: string;
    channelLogo?: string;
}

export interface Goal {
    language: Language;
    targetMinutes: number;
    updatedAt: string;
}

export interface DailyGoal {
    date: string; // YYYY-MM-DD format
    goals: Record<Language, number>;
    updatedAt: string;
}

export interface Achievement {
    language: Language;
    targetMinutes: number;
    actualMinutes: number;
    percentage: number;
}

export interface DailyAchievement {
    date: string;
    achievements: Achievement[];
    hasAchieved: boolean;
}

export type Language = "cantonese" | "english" | "japanese" | "spanish";

export interface DatabaseService {
    initDB(): Promise<IDBDatabase>;
    saveRecord(record: PlaybackRecord): Promise<void>;
    getTodayRecords(): Promise<PlaybackRecord[]>;
    getAllRecords(): Promise<PlaybackRecord[]>;
    getRecordsByDate(date: string): Promise<PlaybackRecord[]>;
    deleteRecord(sessionId: string): Promise<void>;
    saveGoal(goal: Goal): Promise<void>;
    getAllGoals(): Promise<Goal[]>;
    getGoal(language: Language): Promise<Goal | null>;
    saveDailyGoal(dailyGoal: DailyGoal): Promise<void>;
    getDailyGoal(date: string): Promise<DailyGoal | null>;
    getAllDailyGoals(): Promise<DailyGoal[]>;
    calculateDailyAchievement(date: string): Promise<DailyAchievement>;
}
