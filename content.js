// 全局变量
let currentVideo = null;
let currentStatus = 'stopped';
let currentDuration = 0;
let lastUpdateTime = 0;
let sessionStartTime = 0;
let isInitialized = false;
let currentSessionId = null;

// 生成随机 session ID
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 初始化函数
async function initialize() {
  if (isInitialized) {
    console.log('[CI] Already initialized');
    return;
  }

  // 检查是否在 x.com 域名下
  if (window.location.hostname === 'x.com' || window.location.hostname === 'twitter.com') {
    console.log('[CI] Skipping video detection on x.com/twitter.com domain');
    return;
  }

  try {
    console.log('[CI] Initializing content script...');
    // 开始检测视频
    startVideoDetection();
    isInitialized = true;
    console.log('[CI] Content script initialized successfully');

  } catch (error) {
    console.error('[CI] Error initializing content script:', error);
  }
}

// 查找视频元素
function findVideoElement() {

  const videos = document.getElementsByTagName('video');


  for (const video of videos) {
    if (!video.paused && video.readyState >= 2) {
      return video;
    }
  }


  const videoContainers = document.querySelectorAll('[class*="video"], [id*="video"], [class*="player"], [id*="player"]');

  for (const container of videoContainers) {
    const video = container.querySelector('video');
    if (video) {
      return video;
    }
  }

  console.log('[CI] No suitable video element found');
  return null;
}

// 设置视频监听器
function setupVideoListeners(video) {
  if (!video) {
    console.log('[CI] No video element provided for listeners');
    return;
  }

  console.log('[CI] Setting up listeners for video:', {
    src: video.src,
    currentTime: video.currentTime,
    duration: video.duration
  });

  // 移除可能存在的旧监听器
  video.removeEventListener('play', handleVideoPlay);
  video.removeEventListener('pause', handleVideoPause);
  video.removeEventListener('ended', handleVideoEnded);
  video.removeEventListener('timeupdate', handleTimeUpdate);

  // 添加新监听器
  video.addEventListener('play', handleVideoPlay);
  video.addEventListener('pause', handleVideoPause);
  video.addEventListener('ended', handleVideoEnded);
  video.addEventListener('timeupdate', handleTimeUpdate);

  // 如果视频已经在播放，立即触发播放事件
  if (!video.paused && video.readyState >= 2) {
    console.log('[CI] Video is already playing, triggering play event');
    handleVideoPlay({ target: video });
  }
}

function updatePlaybackDuration(video, forceUpdate = false) {
  if (!video) return;

  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;

  // 只有当距离上次更新超过1秒时才更新
  if (timeSinceLastUpdate >= 1000 || forceUpdate) {
    // 计算实际播放时间（毫秒）
    const playbackTime = timeSinceLastUpdate;
    currentDuration += Math.floor(playbackTime / 1000); // 转换为秒
    lastUpdateTime = now;

    // 发送消息到 background.js
    chrome.runtime.sendMessage({
      type: 'updateDuration',
      duration: currentDuration,
      url: window.location.href,
      title: document.title,
      sessionId: currentSessionId,
      date: sessionStartTime
    });

    console.log('[CI] Duration updated:', {
      sessionId: currentSessionId,
      currentDuration,
      playbackTime,
      lastUpdateTime: new Date(lastUpdateTime).toISOString()
    });
  }
}

// 处理视频播放
function handleVideoPlay(event) {
  const video = event.target;
  console.log('[CI] Video play event:', {
    src: video.src,
    currentTime: video.currentTime,
    duration: video.duration,
    playbackRate: video.playbackRate
  });

  if (currentStatus !== 'playing') {
    currentStatus = 'playing';
    sessionStartTime = Date.now();
    lastUpdateTime = Date.now();
    currentDuration = 0; // 重置当前会话的时长
    currentSessionId = generateSessionId(); // 生成新的 session ID

    // 发送消息到 background.js
    chrome.runtime.sendMessage({
      type: 'videoStarted',
      status: currentStatus,
      url: window.location.href,
      title: document.title,
      sessionId: currentSessionId,
      date: sessionStartTime
    });

    console.log('[CI] Session started:', {
      sessionId: currentSessionId,
      startTime: new Date(sessionStartTime).toISOString(),
      date: sessionStartTime,
      currentDuration: currentDuration
    });
  }
}

// 处理视频暂停
function handleVideoPause(event) {
  const video = event.target;
  console.log('[CI] Video pause event:', {
    src: video.src,
    currentTime: video.currentTime,
    duration: video.duration,
    playbackRate: video.playbackRate
  });

  if (currentStatus === 'playing') {
    currentStatus = 'paused';
    // 强制更新最后一次的播放时长
    updatePlaybackDuration(video, true);

    // 发送消息到 background.js
    chrome.runtime.sendMessage({
      type: 'videoPaused',
      status: currentStatus,
      duration: currentDuration,
      url: window.location.href,
      title: document.title,
      sessionId: currentSessionId,
      date: sessionStartTime
    });

    console.log('[CI] Session paused:', {
      sessionId: currentSessionId,
      currentDuration
    });
  }
}

// 处理视频结束
function handleVideoEnded(event) {
  const video = event.target;
  console.log('[CI] Video ended event:', {
    src: video.src,
    currentTime: video.currentTime,
    duration: video.duration,
    playbackRate: video.playbackRate
  });

  if (currentStatus === 'playing') {
    currentStatus = 'ended';
    // 强制更新最后一次的播放时长
    updatePlaybackDuration(video, true);

    // 发送消息到 background.js
    chrome.runtime.sendMessage({
      type: 'videoEnded',
      status: currentStatus,
      duration: currentDuration,
      url: window.location.href,
      title: document.title,
      sessionId: currentSessionId,
      date: sessionStartTime
    });

    console.log('[CI] Session ended:', {
      sessionId: currentSessionId,
      totalDuration: currentDuration
    });
  }
}

// 处理时间更新
function handleTimeUpdate(event) {
  const video = event.target;

  // 检查视频是否真的在播放
  if (currentStatus === 'playing' && !video.paused) {
    updatePlaybackDuration(video);
  }
}

// 检查视频状态
function checkVideoStatus() {
  const video = findVideoElement();

  if (video) {
    if (video !== currentVideo) {
      currentVideo = video;
      setupVideoListeners(video);
    }
  } else {
    console.log('[CI] No video element found');
    if (currentVideo) {
      console.log('[CI] Previous video element lost');
      currentVideo = null;
      currentStatus = 'stopped';
      currentDuration = 0;
    }
  }
}

// 开始视频检测
function startVideoDetection() {
  console.log('[CI] Starting video detection...');

  // 立即检查一次
  checkVideoStatus();

  // 设置定时器定期检查
  setInterval(checkVideoStatus, 1000);

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        checkVideoStatus();
        break;
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

}


// 初始化
initialize(); 