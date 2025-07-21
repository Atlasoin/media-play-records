export const DB_NAME = "ci-monitor";
export const DB_VERSION = 3;
export const STORE_NAME = "playbackRecords";

export const LANGUAGE_NAMES: Record<string, string> = {
    cantonese: "Cantonese",
    english: "English",
    japanese: "Japanese",
    spanish: "Spanish",
};

export const DEFAULT_DAILY_GOAL = {
    cantonese: 60,
    english: 60,
    japanese: 60,
    spanish: 60,
};

export const SUPPORTED_LANGUAGES = [
    "cantonese",
    "english",
    "japanese",
    "spanish",
] as const;

export const DATE_FILTERS = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
] as const;

export const LANGUAGE_FILTERS = [
    { value: "all", label: "All Languages" },
    { value: "cantonese", label: "Cantonese" },
    { value: "english", label: "English" },
    { value: "japanese", label: "Japanese" },
    { value: "spanish", label: "Spanish" },
] as const;
