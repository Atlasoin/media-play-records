export const DB_NAME = "ci-monitor";
export const DB_VERSION = 3;
export const STORE_NAME = "playbackRecords";

export const LANGUAGE_NAMES: Record<string, string> = {
    cantonese: "粤语",
    english: "英语",
    japanese: "日语",
    spanish: "西班牙语",
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
    { value: "all", label: "所有时间" },
    { value: "today", label: "今天" },
    { value: "week", label: "本周" },
    { value: "month", label: "本月" },
] as const;

export const LANGUAGE_FILTERS = [
    { value: "all", label: "所有语言" },
    { value: "cantonese", label: "粤语" },
    { value: "english", label: "英语" },
    { value: "japanese", label: "日语" },
    { value: "spanish", label: "西班牙语" },
] as const;
