// 导入数据库模块
importScripts("db.js");

// 全局变量
let currentStatus = "stopped";
let currentDuration = 0;
let currentTitle = "";
let currentUrl = "";
let currentLanguage = "";
let currentSession = null; // 当前会话
let currentChannelName = "";
let currentChannelLogo = "";

// 格式化时间
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

// 获取今天的日期字符串
function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

// 计算今日总时长
function calculateTodayTotalDuration() {
  const today = getTodayString();
  return playbackHistory
    .filter((record) => record.date === today)
    .reduce((total, record) => total + record.duration, 0);
}

// 初始化函数
async function initialize() {
  try {
    console.log("[CI] Initializing background script...");
    await getDB();
    console.log("[CI] Database initialized successfully");
  } catch (error) {
    console.error("[CI] Error initializing background script:", error);
  }
}

initialize();

// 处理视频开始
async function handleVideoStarted(data) {
  console.log("[CI] Video started:", data);
  currentStatus = data.status;
  currentTitle = data.title;
  currentUrl = data.url;


  currentChannelName = data.channelName || "";
  currentChannelLogo = data.channelLogo || "";

  currentLanguage = detectLanguage(data.title);


  // 通知 popup
  // chrome.runtime.sendMessage({
  //   type: 'updateStatus',
  //   status: currentStatus,
  //   title: currentTitle
  // });
}

// 处理视频暂停
function handleVideoPaused(data) {
  console.log("[CI] Video paused:", data);
  currentStatus = data.status;
  currentDuration = data.duration;
  // 新增
  currentChannelName = data.channelName || "";
  currentChannelLogo = data.channelLogo || "";

  // 通知 popup
  // chrome.runtime.sendMessage({
  //   type: 'updateStatus',
  //   status: currentStatus,
  //   title: currentTitle
  // });
}

// 处理视频结束
function handleVideoEnded(data) {
  console.log("[CI] Video ended:", data);
  currentStatus = data.status;
  currentDuration = data.duration;
  currentSession = null; // 清除当前会话
  // 新增
  currentChannelName = data.channelName || "";
  currentChannelLogo = data.channelLogo || "";

  // 通知 popup
  // chrome.runtime.sendMessage({
  //   type: 'updateStatus',
  //   status: currentStatus,
  //   title: currentTitle
  // });
}

// 处理时长更新
async function handleDurationUpdate(data) {
  console.log("[CI] Duration updated:", data);
  currentDuration = data.duration;

  if (currentSession && currentSession.sessionId === data.sessionId) {
    currentSession.duration = data.duration;

    currentChannelName = data.channelName || "";
    currentChannelLogo = data.channelLogo || "";


    if (currentSession.duration < 5) {
      // If the duration is less than 5 seconds, skip saving
      return;
    }

    await saveRecord(currentSession);
  } else {
    currentSession = {
      sessionId: data.sessionId,
      date: new Date(data.date).toISOString(),
      title: data.title,
      url: data.url,
      language: currentLanguage,
      duration: data.duration,
      // 新增
      channelName: data.channelName || null,
      channelLogo: data.channelLogo || null,
    };
    await saveRecord(currentSession);
  }

  // 通知 popup
  chrome.runtime.sendMessage({
    type: "updateDuration",
    duration: currentDuration,
    title: currentTitle,
  });
}

// 监听来自 content.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[CI] Received message:", message);

  switch (message.type) {
    case "videoStarted":
      handleVideoStarted(message);
      break;
    case "videoPaused":
      handleVideoPaused(message);
      break;
    case "videoEnded":
      handleVideoEnded(message);
      break;
    case "updateDuration":
      handleDurationUpdate(message);
      break;
    case "getData":
      sendResponse({
        status: currentStatus,
        duration: currentDuration,
        title: currentTitle,
      });
      break;
  }
});

function detectLanguage(title) {
  title = title.toUpperCase();

  if (title.includes('CANTONESE')) {
    return "cantonese";
  } else if (title.includes('ESPAÑOL') || title.includes('EPISODIO')) {
    return "spanish";
  } else {
    return "english";
  }
}

