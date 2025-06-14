// 全局变量
let currentStatus = 'stopped';
let currentDuration = 0;
let todayTotalDuration = 0;
let currentTitle = '';

// 初始化函数
async function initialize() {
  try {
    console.log('[CI] Starting popup initialization...');

    // 等待 DB 对象准备好
    if (!window.DB) {
      console.log('[CI] Waiting for DB object...');
      await new Promise(resolve => {
        const checkDB = setInterval(() => {
          if (window.DB) {
            clearInterval(checkDB);
            resolve();
          }
        }, 100);
      });
    }

    console.log('[CI] DB object found, initializing...');
    await window.DB.initDB();
    console.log('[CI] Database initialized successfully');

    // 获取当前状态
    chrome.runtime.sendMessage({ type: 'getData' }, (response) => {
      if (response) {
        currentStatus = response.status;
        currentDuration = response.duration;
        currentTitle = response.title;
        updateUI();
      }
    });

    // 获取今日记录
    await updateTodayRecords();

    // 添加事件监听器
    document.getElementById('viewHistoryBtn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'history.html' });
    });

    console.log('[CI] Popup initialized successfully');
  } catch (error) {
    console.error('[CI] Error initializing popup:', error);
  }
}

// 更新今日记录
async function updateTodayRecords() {
  try {
    // 获取所有记录
    const todayRecords = await window.DB.getTodayRecords();
    console.log('[CI] Today records:', todayRecords);

    // 计算今日总时长
    todayTotalDuration = todayRecords.reduce((total, record) => total + record.duration, 0);

    // 更新今日总时长显示
    document.getElementById('todayTotalDuration').textContent = formatDuration(todayTotalDuration);

    // 更新播放记录列表
    const historyList = document.getElementById('playbackHistory');
    historyList.innerHTML = '';

    if (todayRecords.length === 0) {
      historyList.innerHTML = '<li class="no-records">暂无播放记录</li>';
      return;
    }

    // 按时间倒序排序
    todayRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 显示记录
    todayRecords.forEach(record => {
      const li = document.createElement('li');
      const date = new Date(record.date);
      const timeStr = date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // 格式化显示内容
      const languageDisplay = {
        'cantonese': '粤语',
        'english': '英语',
        'japanese': '日语',
        'spanish': '西班牙语'
      }[record.language] || '未知';

      li.textContent = `${timeStr} - ${record.title} - ${formatDuration(record.duration)} - ${languageDisplay}`;
      historyList.appendChild(li);
    });
  } catch (error) {
    console.error('[CI] Error updating today records:', error);
  }
}

// 格式化时间
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// 更新UI
function updateUI() {
  // 更新状态
  document.getElementById('playbackTilte').textContent = currentTitle || '未检测到视频';
}

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[CI] Received message:', message);

  switch (message.type) {
    case 'updateStatus':
      currentStatus = message.status;
      updateUI();
      updateTodayRecords();
      break;
    case 'updateDuration':
      currentDuration = message.duration;
      updateUI();
      updateTodayRecords();
      break;
  }
});

// 初始化
initialize();