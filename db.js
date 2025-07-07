// 数据库配置
const DB_NAME = "ci-monitor";
const DB_VERSION = 3; // 更新版本号以触发数据库升级
const STORE_NAME = "playbackRecords";
let db = null;

// 初始化数据库
async function initDB() {
  if (db) {
    console.log("[CI] Using existing database connection");
    return db;
  }

  return new Promise((resolve, reject) => {
    console.log("[CI] Opening database connection...");
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("[CI] Database error:", event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      console.log("[CI] Database connection successful");
      db = event.target.result;

      // 监听数据库关闭事件
      db.onclose = () => {
        console.log("[CI] Database connection closed");
        db = null;
      };

      // 监听数据库版本变更事件
      db.onversionchange = (event) => {
        console.log("[CI] Database version changed:", event.newVersion);
        db.close();
        db = null;
      };

      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      console.log("[CI] Database upgrade needed, old version:", event.oldVersion, "new version:", event.newVersion);
      const db = event.target.result;

      // 如果存储对象不存在，创建它
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log("[CI] Creating object store:", STORE_NAME);
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "sessionId",
        });

        // 创建索引
        store.createIndex("date", "date", { unique: false });
        store.createIndex("title", "title", { unique: false });
        store.createIndex("url", "url", { unique: false });
        store.createIndex("language", "language", { unique: false });
        store.createIndex("duration", "duration", { unique: false });
        // 新增
        store.createIndex("channelName", "channelName", { unique: false });
        store.createIndex("channelLogo", "channelLogo", { unique: false });

        console.log("[CI] Object store and indexes created");
      }

      // 创建目标存储对象
      console.log("[CI] Creating goals object store");
      if (!db.objectStoreNames.contains('goals')) {
        console.log('[CI] Creating goals object store');
        const goalsStore = db.createObjectStore('goals', { keyPath: 'language' });
        goalsStore.createIndex('language', 'language', { unique: true });
        console.log('[CI] Goals object store created');
      }

      // 创建每日目标存储对象
      if (!db.objectStoreNames.contains('dailyGoals')) {
        console.log('[CI] Creating daily goals object store');
        const dailyGoalsStore = db.createObjectStore('dailyGoals', { keyPath: 'date' });
        dailyGoalsStore.createIndex('date', 'date', { unique: true });
        console.log('[CI] Daily goals object store created');
      }
    };
  });
}

// 获取数据库连接
async function getDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

// 保存记录（添加或更新）
async function saveRecord(record) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    // 确保记录包含所有必要字段
    const completeRecord = {
      sessionId: record.sessionId,
      title: record.title,
      url: record.url,
      language: record.language,
      duration: record.duration,
      date: record.date,
      // 新增
      channelName: record.channelName || null,
      channelLogo: record.channelLogo || null,
    };

    // 直接使用 put 方法，它会根据 sessionId 自动更新或创建记录
    const request = store.put(completeRecord);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// 获取今日记录
async function getTodayRecords() {
  const db = await getDB();
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

async function getAllRecords() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function getRecordsByDate(date) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("date");
    const request = index.getAll(date);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

async function deleteRecord(sessionId) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(sessionId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 保存目标
async function saveGoal(goal) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['goals'], 'readwrite');
    const store = transaction.objectStore('goals');

    const completeGoal = {
      language: goal.language,
      targetMinutes: goal.targetMinutes,
      updatedAt: new Date().toISOString()
    };

    const request = store.put(completeGoal);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// 获取所有目标
async function getAllGoals() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['goals'], 'readonly');
    const store = transaction.objectStore('goals');
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 获取特定语言的目标
async function getGoal(language) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['goals'], 'readonly');
    const store = transaction.objectStore('goals');
    const request = store.get(language);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 保存每日目标
async function saveDailyGoal(dailyGoal) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['dailyGoals'], 'readwrite');
    const store = transaction.objectStore('dailyGoals');

    const completeDailyGoal = {
      date: dailyGoal.date,
      goals: dailyGoal.goals, // { cantonese: 30, english: 45, japanese: 20, spanish: 15 }
      updatedAt: new Date().toISOString()
    };

    const request = store.put(completeDailyGoal);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// 获取特定日期的目标
async function getDailyGoal(date) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['dailyGoals'], 'readonly');
    const store = transaction.objectStore('dailyGoals');
    const request = store.get(date);

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 获取所有每日目标
async function getAllDailyGoals() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['dailyGoals'], 'readonly');
    const store = transaction.objectStore('dailyGoals');
    const request = store.getAll();

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

// 计算特定日期的达标情况
async function calculateDailyAchievement(date) {
  try {
    console.log('[CI] Calculating achievement for date:', date);
    // 获取该日期的目标
    const dailyGoal = await getDailyGoal(date);
    console.log('[CI] Daily goal for', date, ':', dailyGoal);

    // 计算达标情况
    const achievements = [];
    if (dailyGoal && dailyGoal.goals) {
      Object.keys(dailyGoal.goals).forEach(language => {
        const targetMinutes = dailyGoal.goals[language];

        console.log(`[CI] ${language}: target=${targetMinutes}, actual=${actualMinutes}, percentage=${percentage}%`);

        achievements.push({
          language: language,
          targetMinutes: targetMinutes
        });
      });
    }

    return {
      date: date,
      achievements: achievements
    };
  } catch (error) {
    console.error('[CI] Error calculating daily achievement:', error);
    return {
      date: date,
      achievements: []
    };
  }
}

// 导出数据库操作对象
const DB = {
  initDB,
  saveRecord,
  getTodayRecords,
  getAllRecords,
  getRecordsByDate,
  deleteRecord,

  saveGoal,
  getAllGoals,
  getGoal,
  saveDailyGoal,
  getDailyGoal,
  getAllDailyGoals,
  calculateDailyAchievement

};

// 如果在浏览器环境中，将 DB 对象挂载到 window 上
if (typeof window !== "undefined") {
  window.DB = DB;
}

// 如果在模块环境中，导出 DB 对象
if (typeof module !== "undefined" && module.exports) {
  module.exports = DB;
}
