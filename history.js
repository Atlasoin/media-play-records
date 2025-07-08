// 全局变量
let currentStatus = "stopped";
let currentDuration = 0;
let playbackHistory = [];
let isInitialized = false;
let currentDate = new Date();
let dailyDurations = new Map();
const languageNames = ["cantonese", "english", "japanese", "spanish"];
const defaultDailyGoal = {
  cantonese: 60,
  english: 60,
  japanese: 60,
  spanish: 60
}

// 初始化函数
async function initialize() {
  if (isInitialized) {
    console.log("[CI] Already initialized");
    return;
  }

  try {
    console.log("[CI] Initializing history page...");
    await window.DB.initDB();
    console.log("[CI] Database initialized successfully");

    // 获取并显示记录
    await updateUI();
    await updateDailyDurations();

    // 加载目标和达标情况
    await loadGoals();
    await updateAchievements();

    // 更新日历视图以显示历史达标数据
    await updateCalendar();

    isInitialized = true;
    console.log("[CI] History page initialized successfully");

    // 设置日期选择器的默认值为今天
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("entryDate").value = today;


    // 添加事件监听器
    setupEventListeners();
  } catch (error) {
    console.error("[CI] Error initializing history page:", error);
  }
}

// 设置事件监听器
function setupEventListeners() {
  // 监听筛选器变化
  document.getElementById("dateFilter").addEventListener("change", (e) => {
    updateUI(e.target.value, document.getElementById("languageFilter").value);
  });

  document.getElementById("languageFilter").addEventListener("change", (e) => {
    updateUI(document.getElementById("dateFilter").value, e.target.value);
    updateCalendar();
  });

  // 监听手动录入表单提交
  document
    .getElementById("manualEntryForm")
    .addEventListener("submit", handleManualEntry);

  // 添加记录按钮事件监听
  document.getElementById('addRecordBtn').addEventListener('click', showManualEntryModal);

  // 关闭弹窗按钮事件监听
  document.getElementById('closeModalBtn').addEventListener('click', hideManualEntryModal);

  // 取消按钮事件监听
  document.querySelector('#manualEntryModal .cancel-btn').addEventListener('click', hideManualEntryModal);

  // 点击弹窗外部关闭弹窗
  document.getElementById('manualEntryModal').addEventListener('click', (e) => {
    if (e.target.id === 'manualEntryModal') {
      hideManualEntryModal();
    }
  });

  // 添加导出按钮事件监听
  document.getElementById("exportBtn").addEventListener("click", exportData);

  // 添加导入按钮事件监听
  document
    .getElementById("importBtn")
    .addEventListener("change", handleFileSelect);

  // 添加日历导航按钮事件监听
  document.getElementById("prevMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateCalendar();
  });

  document.getElementById("nextMonth").addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateCalendar();
  });

  // 添加目标保存按钮事件监听
  document.querySelectorAll('.save-goal-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const language = e.target.getAttribute('data-language');
      if (language) {
        saveGoal(language);
      }
    });
  });
}

// 获取记录
async function getRecords(filter = "all", languageFilter = "all") {
  try {
    console.log("[CI] Fetching records with filters:", {
      filter,
      languageFilter,
    });
    const records = await window.DB.getAllRecords();
    console.log("[CI] Found records:", records.length);

    // const todayRecords = await window.DB.getTodayRecords();
    // console.log('[CI] Today records:', todayRecords);

    // 过滤记录
    let filteredRecords = records.filter((record) => {
      if (!record.duration || !record.date) {
        console.warn("[CI] Invalid record found:", record);
        return false;
      }

      // 语言过滤
      if (languageFilter !== "all" && record.language !== languageFilter) {
        return false;
      }

      // 时间过滤
      const recordDate = new Date(record.date);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      switch (filter) {
        case "today":
          return recordDate >= today;
        case "week":
          return recordDate >= weekStart;
        case "month":
          return recordDate >= monthStart;
        default:
          return true;
      }
    });

    // 按日期排序
    filteredRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    console.log("[CI] Filtered records:", filteredRecords.length);
    return filteredRecords;
  } catch (error) {
    console.error("[CI] Error getting records:", error);
    return [];
  }
}

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

// 格式化分钟显示
function formatMinutes(seconds) {
  return Math.floor(seconds / 60);
}

// 更新UI
async function updateUI(filter = "all", languageFilter = "all") {
  try {
    const records = await getRecords(filter, languageFilter);

    const historyList = document.getElementById('historyList');
    const totalDuration = document.getElementById('totalDuration');
    const batchDeleteBtn = document.getElementById('batchDeleteBtn');


    // 计算总时长
    const total = records.reduce((sum, record) => sum + record.duration, 0);
    totalDuration.textContent = formatDuration(total);

    // 更新列表
    historyList.innerHTML = "";
    records.forEach((record) => {
      const li = document.createElement("li");
      const date = new Date(record.date).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      // 格式化显示内容
      const languageDisplay =
        {
          cantonese: "粤语",
          english: "英语",
          japanese: "日语",
          spanish: "西班牙语",
        }[record.language] || "未知";

      // 创建记录内容容器

      const contentDiv = document.createElement("div");
      contentDiv.className = "record-content";
      contentDiv.textContent = `${date} - ${record.title} - ${formatDuration(
        record.duration
      )} - ${languageDisplay}`;

      // 新增：YouTube 频道信息展示
      let channelInfoHtml = "";
      if (record.channelName) {
        channelInfoHtml = `<div class="yt-channel" style="margin:4px 0;">
          ${record.channelLogo
            ? `<img src="${record.channelLogo}" alt="logo" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:4px;">`
            : ""
          }
          <span style="vertical-align:middle;">${record.channelName}</span>
        </div>`;
      }

      contentDiv.innerHTML = `
        ${date} - ${record.title} - ${formatDuration(
        record.duration
      )} - ${languageDisplay}
        ${channelInfoHtml}
      `;


      // 添加复选框
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'record-checkbox';
      checkbox.dataset.sessionId = record.sessionId;
      checkbox.onchange = () => {
        const checkedBoxes = document.querySelectorAll('.record-checkbox:checked');
        batchDeleteBtn.style.display = checkedBoxes.length > 0 ? 'inline-block' : 'none';

        // 只禁用单个记录的修改和删除按钮
        const allEditBtns = document.querySelectorAll('.edit-btn:not(#batchDeleteBtn)');
        const allDeleteBtns = document.querySelectorAll('.delete-btn:not(#batchDeleteBtn)');
        const isAnyChecked = checkedBoxes.length > 0;

        allEditBtns.forEach(btn => btn.disabled = isAnyChecked);
        allDeleteBtns.forEach(btn => btn.disabled = isAnyChecked);
      };
      contentDiv.appendChild(checkbox);

      // 添加记录内容
      //       const recordText = document.createElement('span');
      //       recordText.textContent = `${date} - ${record.title} - ${formatDuration(record.duration)} - ${languageDisplay}`;
      //       contentDiv.appendChild(recordText);


      // 创建按钮容器
      const buttonContainer = document.createElement("div");
      buttonContainer.className = "button-container";

      // 创建修改按钮
      const editBtn = document.createElement("button");
      editBtn.className = "edit-btn";
      editBtn.textContent = "修改";
      editBtn.onclick = () => showEditForm(record);

      // 创建删除按钮
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "删除";
      deleteBtn.onclick = async () => {
        if (confirm("确定要删除这条记录吗？")) {
          try {
            await window.DB.deleteRecord(record.sessionId);
            await updateUI(
              document.getElementById("dateFilter").value,
              document.getElementById("languageFilter").value
            );
            await updateDailyDurations();
            await updateAchievements();
          } catch (error) {
            console.error("[CI] Error deleting record:", error);
            alert("删除失败，请重试");
          }
        }
      };

      // 将按钮添加到按钮容器
      buttonContainer.appendChild(editBtn);
      buttonContainer.appendChild(deleteBtn);

      // 将内容和按钮添加到列表项
      li.appendChild(contentDiv);
      li.appendChild(buttonContainer);
      historyList.appendChild(li);
    });

    // 设置批量删除按钮事件
    batchDeleteBtn.onclick = async () => {
      const checkedBoxes = document.querySelectorAll('.record-checkbox:checked');
      if (checkedBoxes.length === 0) return;

      if (confirm(`确定要删除选中的 ${checkedBoxes.length} 条记录吗？`)) {
        try {
          for (const checkbox of checkedBoxes) {
            await window.DB.deleteRecord(checkbox.dataset.sessionId);
          }
          await updateUI(
            document.getElementById('dateFilter').value,
            document.getElementById('languageFilter').value
          );
          await updateDailyDurations();
          await updateAchievements();
          batchDeleteBtn.style.display = 'none';
          alert('批量删除成功');
        } catch (error) {
          console.error('[CI] Error batch deleting records:', error);
          alert('批量删除失败，请重试');
        }
      }
    };
  } catch (error) {
    console.error("[CI] Error updating UI:", error);
  }
}

// 显示修改表单
function showEditForm(record) {
  // 创建模态框
  const modal = document.createElement("div");
  modal.className = "modal";

  // 创建模态框内容
  const modalContent = document.createElement("div");
  modalContent.className = "modal-content";

  // 创建表单
  const form = document.createElement("form");
  form.innerHTML = `
    <h3>修改记录</h3>
    <div class="form-group">
      <label for="editDate">日期：</label>
      <input type="datetime-local" id="editDate" required>
    </div>
    <div class="form-group">
      <label for="editTitle">标题：</label>
      <input type="text" id="editTitle" required>
    </div>
    <div class="form-group">
      <label for="editUrl">URL（可选）：</label>
      <input type="url" id="editUrl">
    </div>
    <div class="form-group">
      <label for="editDuration">时长（分钟）：</label>
      <input type="number" id="editDuration" min="1" step="1" required>
    </div>
    <div class="form-group">
      <label for="editLanguage">语言：</label>
      <select id="editLanguage" required>
        <option value="cantonese">粤语</option>
        <option value="english">英语</option>
        <option value="japanese">日语</option>
        <option value="spanish">西班牙语</option>
      </select>
    </div>
    <div class="button-group">
      <button type="submit" class="submit-btn">保存</button>
      <button type="button" class="cancel-btn">取消</button>
    </div>
  `;

  // 设置表单初始值
  const date = new Date(record.date);
  const dateStr = date.toISOString().slice(0, 16);
  form.querySelector("#editDate").value = dateStr;
  form.querySelector("#editTitle").value = record.title;
  form.querySelector("#editUrl").value =
    record.url === "manual-entry" ? "" : record.url;
  form.querySelector("#editDuration").value = Math.floor(record.duration / 60);
  form.querySelector("#editLanguage").value = record.language;

  // 处理表单提交
  form.onsubmit = async (e) => {
    e.preventDefault();

    const updatedRecord = {
      sessionId: record.sessionId,
      date: new Date(form.querySelector("#editDate").value).toISOString(),
      title: form.querySelector("#editTitle").value,
      url: form.querySelector("#editUrl").value || "manual-entry",
      duration: parseInt(form.querySelector("#editDuration").value) * 60,
      language: form.querySelector("#editLanguage").value,
    };

    try {
      await window.DB.saveRecord(updatedRecord);
      modal.remove();
      await updateUI(
        document.getElementById("dateFilter").value,
        document.getElementById("languageFilter").value
      );
      await updateDailyDurations();

      await updateAchievements();

    } catch (error) {
      console.error("[CI] Error updating record:", error);
      alert("更新失败，请重试");
    }
  };

  // 处理取消按钮
  form.querySelector(".cancel-btn").onclick = () => {
    modal.remove();
  };

  // 将表单添加到模态框
  modalContent.appendChild(form);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// 更新每日时长数据
async function updateDailyDurations() {
  try {
    const records = await getRecords("all", "all");
    dailyDurations.clear();

    records.forEach((record) => {
      const date = new Date(record.date);
      const dateStr = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

      let dayRecord = dailyDurations.get(dateStr) || {
        cantonese: 0,
        english: 0,
        japanese: 0,
        spanish: 0,
      };

      dayRecord[record.language] =
        (dayRecord[record.language] || 0) + record.duration;
      dailyDurations.set(dateStr, dayRecord);
    });

    await updateCalendar();
  } catch (error) {
    console.error("[CI] Error updating daily durations:", error);
  }
}

// 更新日历视图
async function updateCalendar() {
  const calendarDays = document.getElementById("calendarDays");
  const currentMonth = document.getElementById("currentMonth");
  const languageFilter = document.getElementById("languageFilter").value;

  // 更新月份标题
  currentMonth.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1
    }月`;

  // 获取当月第一天是星期几
  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const lastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // 清空日历
  calendarDays.innerHTML = "";

  // 添加上个月的日期
  const firstDayWeekday = firstDay.getDay();
  const prevMonthLastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    0
  );
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const day = document.createElement("div");
    day.className = "calendar-day other-month";
    day.textContent = prevMonthLastDay.getDate() - i;
    calendarDays.appendChild(day);
  }

  // 添加当月的日期
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const day = document.createElement("div");
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), i);
    const dateStr = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    day.className = "calendar-day";
    if (
      dateStr ===
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(new Date().getDate()).padStart(2, "0")}`
    ) {
      day.classList.add("today");
    }

    // 检查是否有数据
    const dayRecord = dailyDurations.get(dateStr);
    if (dayRecord) {
      let totalDuration = 0;

      if (languageFilter === "all") {
        totalDuration = Object.values(dayRecord).reduce(
          (sum, duration) => sum + duration,
          0
        );
      } else {
        totalDuration = dayRecord[languageFilter] || 0;
      }

      if (totalDuration > 0) {
        day.classList.add("has-data");
        const durationDiv = document.createElement("div");
        durationDiv.className = "duration";
        durationDiv.textContent = `${formatMinutes(totalDuration)}分钟`;
        day.appendChild(document.createTextNode(i));
        day.appendChild(durationDiv);
      } else {
        day.textContent = i;
      }
    } else {
      day.textContent = i;
    }

    // 检查是否达标
    try {
      let dailyGoal = await window.DB.getDailyGoal(dateStr);

      // 如果该日期没有目标，尝试获取最近的目标
      if (!dailyGoal || !dailyGoal.goals) {
        const allDailyGoals = await window.DB.getAllDailyGoals();
        if (allDailyGoals && allDailyGoals.length > 0) {
          // 按日期排序，获取最近的目标
          allDailyGoals.sort((a, b) => new Date(b.date) - new Date(a.date));
          dailyGoal = allDailyGoals[0];
        }
      }

      // Any language is achieved then the day is achieved
      if (languageFilter === "all") {
        languageNames.forEach(language => {
          const goal = dailyGoal ? dailyGoal.goals[language] : defaultDailyGoal[language];
          const dailyDuration = formatMinutes(dailyDurations.get(dateStr) ? dailyDurations.get(dateStr)[language] : 0);
          console.log(dateStr, language, goal, dailyDuration)
          if (goal != 0 && goal <= dailyDuration) {
            console.log(`[CI] Adding achieved class for ${dateStr}`);
            day.classList.add("achieved");
          }
        });
      } else {
        const goal = dailyGoal ? dailyGoal.goals[languageFilter] : defaultDailyGoal[languageFilter];
        const dailyDuration = formatMinutes(dailyDurations.get(dateStr) ? dailyDurations.get(dateStr)[languageFilter] : 0);
        if (goal != 0 && goal <= dailyDuration) {
          console.log(`[CI] Adding achieved class for ${dateStr}`);
          day.classList.add("achieved");
        }
      }
    } catch (error) {
      console.error("[CI] Error checking achievement for date:", dateStr, error);
    }

    calendarDays.appendChild(day);
  }

  // 添加下个月的日期
  const remainingDays = 42 - (firstDayWeekday + lastDay.getDate());
  for (let i = 1; i <= remainingDays; i++) {
    const day = document.createElement("div");
    day.className = "calendar-day other-month";
    day.textContent = i;
    calendarDays.appendChild(day);
  }
}

// 生成随机 session ID
function generateManualSessionId() {
  return (
    "manual_session_" +
    Date.now() +
    "_" +
    Math.random().toString(36).substr(2, 9)
  );
}

// 显示手动录入弹窗
function showManualEntryModal() {
  const modal = document.getElementById('manualEntryModal');
  modal.style.display = 'block';

  // 清空其他字段
  document.getElementById('entryTitle').value = '';
  document.getElementById('entryUrl').value = '';
  document.getElementById('entryDuration').value = '';
  document.getElementById('entryLanguage').value = 'cantonese';
}

// 隐藏手动录入弹窗
function hideManualEntryModal() {
  const modal = document.getElementById('manualEntryModal');
  modal.style.display = 'none';
}

// 处理手动录入
async function handleManualEntry(event) {
  event.preventDefault();

  const date = document.getElementById("entryDate").value;
  const title = document.getElementById("entryTitle").value;
  const url = document.getElementById("entryUrl").value;
  const durationMinutes = parseInt(
    document.getElementById("entryDuration").value
  );
  const language = document.getElementById("entryLanguage").value;

  // 验证输入
  if (!date || !title || !durationMinutes || !language) {
    alert("请填写所有必填字段");
    return;
  }

  // 将分钟转换为秒
  const durationSeconds = durationMinutes * 60;

  // 创建记录
  const record = {
    sessionId: generateManualSessionId(),
    duration: durationSeconds,
    title: title,
    language: language,
    date: new Date(date).toISOString(),
    url: url || "manual-entry",
  };

  try {
    // 保存到数据库
    await window.DB.saveRecord(record);

    // 重置表单
    event.target.reset();

    // 设置日期选择器的默认值为今天
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("entryDate").value = today;

    hideManualEntryModal();


    // 更新显示
    await updateUI(
      document.getElementById("dateFilter").value,
      document.getElementById("languageFilter").value
    );

    // 更新日历
    await updateDailyDurations();

    // 更新达标情况
    await updateAchievements();

    // 显示成功消息
    alert("记录已添加");
  } catch (error) {
    console.error("[CI] Error adding manual entry:", error);
    alert("添加记录失败，请重试");
  }
}

// 导出数据
async function exportData() {
  try {
    const records = await getRecords("all", "all");
    const data = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      records: records,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-history-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("[CI] Error exporting data:", error);
    alert("导出数据失败，请重试");
  }
}

// 导入数据
async function importData(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // 验证数据格式
    if (!data.version || !data.records || !Array.isArray(data.records)) {
      throw new Error("Invalid data format");
    }

    // 开始导入
    for (const record of data.records) {
      await window.DB.saveRecord(record);
    }

    // 更新显示
    await updateUI(
      document.getElementById("dateFilter").value,
      document.getElementById("languageFilter").value
    );

    alert("数据导入成功");
  } catch (error) {
    console.error("[CI] Error importing data:", error);
    alert("导入数据失败，请确保文件格式正确");
  }
}

// 处理文件选择
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    importData(file);
  }
}

// 监听来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[CI] Received message:", message);

  switch (message.type) {
    case "updateStatus":
      currentStatus = message.status;
      break;
    case "updateDuration":
      currentDuration = message.duration;
      break;
    case "recordHistory":
      playbackHistory.push({
        title: message.title,
        duration: message.duration,
        date: new Date().toISOString(),
      });
      // 只保留最近的50条记录
      if (playbackHistory.length > 50) {
        playbackHistory = playbackHistory.slice(-50);
      }
      break;
    case "getData":
      sendResponse({
        status: currentStatus,
        duration: currentDuration,
        history: playbackHistory,
      });
      break;
  }
});

// 保存目标
async function saveGoal(language) {
  const input = document.getElementById(`${language}Goal`);
  const targetMinutes = parseInt(input.value) || 0;

  try {

    // 保存今日的每日目标（用户主动设置）
    const today = new Date().toISOString().split('T')[0];
    const existingDailyGoal = await window.DB.getDailyGoal(today);
    const goals = existingDailyGoal ? existingDailyGoal.goals : {};

    goals[language] = targetMinutes;

    console.log('[CI] Saving daily goal for', today, ':', goals);

    await window.DB.saveDailyGoal({
      date: today,
      goals: goals
    });

    alert('目标已保存');
    await updateAchievements();
  } catch (error) {
    console.error('[CI] Error saving goal:', error);
    alert('保存目标失败，请重试');
  }
}

// 加载目标
async function loadGoals() {
  try {
    // 加载今日的每日目标
    const today = new Date().toISOString().split('T')[0];
    let dailyGoal = await window.DB.getDailyGoal(today);

    // 如果今天没有目标，尝试获取最近的目标
    if (!dailyGoal || !dailyGoal.goals) {
      const allDailyGoals = await window.DB.getAllDailyGoals();
      if (allDailyGoals && allDailyGoals.length > 0) {
        // 按日期排序，获取最近的目标
        allDailyGoals.sort((a, b) => new Date(b.date) - new Date(a.date));
        dailyGoal = allDailyGoals[0];
        console.log('[CI] Using recent goal from', dailyGoal.date);
      }
    }

    if (dailyGoal && dailyGoal.goals) {
      Object.keys(dailyGoal.goals).forEach(language => {
        const input = document.getElementById(`${language}Goal`);
        if (input) {
          input.value = dailyGoal.goals[language];
        }
      });
    }
  } catch (error) {
    console.error('[CI] Error loading goals:', error);
  }
}

// 更新达标情况
async function updateAchievements() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = await window.DB.getTodayRecords();
    let dailyGoal = await window.DB.getDailyGoal(today);

    // 如果今天没有目标，尝试获取最近的目标
    if (!dailyGoal || !dailyGoal.goals) {
      const allDailyGoals = await window.DB.getAllDailyGoals();
      if (allDailyGoals && allDailyGoals.length > 0) {
        // 按日期排序，获取最近的目标
        allDailyGoals.sort((a, b) => new Date(b.date) - new Date(a.date));
        dailyGoal = allDailyGoals[0];
      }
    }

    // 计算今日各语言的学习时长
    const todayDurations = {
      cantonese: 0,
      english: 0,
      japanese: 0,
      spanish: 0
    };

    todayRecords.forEach(record => {
      if (todayDurations.hasOwnProperty(record.language)) {
        todayDurations[record.language] += record.duration;
      }
    });

    // 更新达标显示
    const achievementsList = document.getElementById('achievementsList');
    achievementsList.innerHTML = '';

    const languageNames = {
      cantonese: '粤语',
      english: '英语',
      japanese: '日语',
      spanish: '西班牙语'
    };

    // 使用每日目标计算达标情况
    if (dailyGoal && dailyGoal.goals) {
      Object.keys(dailyGoal.goals).forEach(language => {
        const actualMinutes = Math.floor(todayDurations[language] / 60);
        const targetMinutes = dailyGoal.goals[language];
        const percentage = targetMinutes > 0 ? (actualMinutes / targetMinutes) * 100 : 0;

        const achievementItem = document.createElement('div');
        achievementItem.className = 'achievement-item';

        let statusClass = 'not-achieved';
        let statusText = '未达标';

        if (percentage >= 100) {
          statusClass = 'achieved';
          statusText = '已达标';
        } else if (percentage > 0) {
          statusClass = 'partial';
          statusText = '部分达标';
        }

        achievementItem.classList.add(statusClass);
        achievementItem.innerHTML = `
          <span>${languageNames[language]}</span>
          <span>${actualMinutes}/${targetMinutes}分钟 (${Math.round(percentage)}%)</span>
          <span>${statusText}</span>
        `;

        achievementsList.appendChild(achievementItem);
      });
    } else {
      // 如果没有每日目标，显示默认信息
      const achievementItem = document.createElement('div');
      achievementItem.className = 'achievement-item not-achieved';
      achievementItem.innerHTML = '<span>请先设置学习目标</span>';
      achievementsList.appendChild(achievementItem);
    }

    // 更新日历视图以显示新的达标状态
    await updateCalendar();

  } catch (error) {
    console.error('[CI] Error updating achievements:', error);
  }
}

// 初始化
initialize();
