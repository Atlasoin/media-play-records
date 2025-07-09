import {
    DatabaseService,
    PlaybackRecord,
    Goal,
    DailyGoal,
    DailyAchievement,
    Language,
} from "../types/database";
import { DB_NAME, DB_VERSION, STORE_NAME } from "../utils/constants";

export class IndexedDBService implements DatabaseService {
    private db: IDBDatabase | null = null;

    async initDB(): Promise<IDBDatabase> {
        if (this.db) {
            console.log("[CI] Using existing database connection");
            return this.db;
        }

        return new Promise((resolve, reject) => {
            console.log("[CI] Opening database connection...");
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error("[CI] Database error:", request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                console.log("[CI] Database connection successful");
                this.db = request.result;

                this.db.onclose = () => {
                    console.log("[CI] Database connection closed");
                    this.db = null;
                };

                this.db.onversionchange = (event) => {
                    console.log(
                        "[CI] Database version changed:",
                        event.newVersion
                    );
                    this.db?.close();
                    this.db = null;
                };

                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log(
                    "[CI] Database upgrade needed, old version:",
                    event.oldVersion,
                    "new version:",
                    event.newVersion
                );
                const db = request.result;

                // 创建播放记录存储
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    console.log("[CI] Creating object store:", STORE_NAME);
                    const store = db.createObjectStore(STORE_NAME, {
                        keyPath: "sessionId",
                    });

                    store.createIndex("date", "date", { unique: false });
                    store.createIndex("title", "title", { unique: false });
                    store.createIndex("url", "url", { unique: false });
                    store.createIndex("language", "language", {
                        unique: false,
                    });
                    store.createIndex("duration", "duration", {
                        unique: false,
                    });
                    store.createIndex("channelName", "channelName", {
                        unique: false,
                    });
                    store.createIndex("channelLogo", "channelLogo", {
                        unique: false,
                    });

                    console.log("[CI] Object store and indexes created");
                }

                // 创建目标存储
                if (!db.objectStoreNames.contains("goals")) {
                    console.log("[CI] Creating goals object store");
                    const goalsStore = db.createObjectStore("goals", {
                        keyPath: "language",
                    });
                    goalsStore.createIndex("language", "language", {
                        unique: true,
                    });
                    console.log("[CI] Goals object store created");
                }

                // 创建每日目标存储
                if (!db.objectStoreNames.contains("dailyGoals")) {
                    console.log("[CI] Creating daily goals object store");
                    const dailyGoalsStore = db.createObjectStore("dailyGoals", {
                        keyPath: "date",
                    });
                    dailyGoalsStore.createIndex("date", "date", {
                        unique: true,
                    });
                    console.log("[CI] Daily goals object store created");
                }
            };
        });
    }

    private async getDB(): Promise<IDBDatabase> {
        if (!this.db) {
            await this.initDB();
        }
        return this.db!;
    }

    async saveRecord(record: PlaybackRecord): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);

            const completeRecord = {
                sessionId: record.sessionId,
                title: record.title,
                url: record.url,
                language: record.language,
                duration: record.duration,
                date: record.date,
                channelName: record.channelName || null,
                channelLogo: record.channelLogo || null,
            };

            const request = store.put(completeRecord);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getTodayRecords(): Promise<PlaybackRecord[]> {
        const db = await this.getDB();
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            console.log("[CI] Fetching records between:", {
                today: today.toISOString(),
                tomorrow: tomorrow.toISOString(),
            });

            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("date");
            const range = IDBKeyRange.bound(
                today.toISOString(),
                tomorrow.toISOString()
            );
            const request = index.getAll(range);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    console.log("[CI] Found records:", request.result.length);
                    resolve(request.result);
                };
                request.onerror = () => {
                    console.error("[CI] Error getting records:", request.error);
                    reject(request.error);
                };
            });
        } catch (error) {
            console.error("[CI] Error in getTodayRecords:", error);
            return [];
        }
    }

    async getAllRecords(): Promise<PlaybackRecord[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async getRecordsByDate(date: string): Promise<PlaybackRecord[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("date");
            const request = index.getAll(date);

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async deleteRecord(sessionId: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(sessionId);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveGoal(goal: Goal): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["goals"], "readwrite");
            const store = transaction.objectStore("goals");

            const completeGoal = {
                language: goal.language,
                targetMinutes: goal.targetMinutes,
                updatedAt: new Date().toISOString(),
            };

            const request = store.put(completeGoal);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAllGoals(): Promise<Goal[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["goals"], "readonly");
            const store = transaction.objectStore("goals");
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async getGoal(language: Language): Promise<Goal | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["goals"], "readonly");
            const store = transaction.objectStore("goals");
            const request = store.get(language);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async saveDailyGoal(dailyGoal: DailyGoal): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["dailyGoals"], "readwrite");
            const store = transaction.objectStore("dailyGoals");

            const completeDailyGoal = {
                date: dailyGoal.date,
                goals: dailyGoal.goals,
                updatedAt: new Date().toISOString(),
            };

            const request = store.put(completeDailyGoal);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getDailyGoal(date: string): Promise<DailyGoal | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["dailyGoals"], "readonly");
            const store = transaction.objectStore("dailyGoals");
            const request = store.get(date);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async getAllDailyGoals(): Promise<DailyGoal[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(["dailyGoals"], "readonly");
            const store = transaction.objectStore("dailyGoals");
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async calculateDailyAchievement(date: string): Promise<DailyAchievement> {
        try {
            console.log("[CI] Calculating achievement for date:", date);
            const dailyGoal = await this.getDailyGoal(date);
            console.log("[CI] Daily goal for", date, ":", dailyGoal);
            const records = await this.getRecordsByDate(date);
            console.log("[CI] Records for", date, ":", records);

            const actualDurations = {
                cantonese: 0,
                english: 0,
                japanese: 0,
                spanish: 0,
            };

            records.forEach((record) => {
                if (actualDurations.hasOwnProperty(record.language)) {
                    actualDurations[record.language] += record.duration;
                }
            });

            const achievements: Array<{
                language: Language;
                targetMinutes: number;
                actualMinutes: number;
                percentage: number;
            }> = [];

            if (dailyGoal && dailyGoal.goals) {
                Object.keys(dailyGoal.goals).forEach((language) => {
                    const targetMinutes = dailyGoal.goals[language as Language];
                    const actualMinutes = Math.floor(
                        actualDurations[language as Language] / 60
                    );
                    const percentage =
                        targetMinutes > 0
                            ? (actualMinutes / targetMinutes) * 100
                            : 0;

                    console.log(
                        `[CI] ${language}: target=${targetMinutes}, actual=${actualMinutes}, percentage=${percentage}%`
                    );

                    achievements.push({
                        language: language as Language,
                        targetMinutes: targetMinutes,
                        actualMinutes: actualMinutes,
                        percentage: Math.round(percentage),
                    });
                });
            }

            return {
                date: date,
                achievements: achievements,
                hasAchieved: achievements.some(
                    (achievement) => achievement.percentage >= 100
                ),
            };
        } catch (error) {
            console.error("[CI] Error calculating daily achievement:", error);
            return {
                date: date,
                achievements: [],
                hasAchieved: false,
            };
        }
    }
}

// 创建单例实例
export const databaseService = new IndexedDBService();
