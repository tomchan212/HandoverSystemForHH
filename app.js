(function () {
  'use strict';

  // Google Apps Script 網頁應用程式網址（留空則使用模擬資料）
  var API_BASE = 'https://script.google.com/macros/s/AKfycbxff7gya1KQislZPU6qrOsBaLuhuP4p_fRYjTrOkgSJdu9zch4o9Hra_027uXuEfGWC/exec';

  var REFRESH_MS = 10000;

  var state = {
    data: null,
    loading: true,
    error: null,
    useMock: false,
    selectedId: null,
    search: '',
    filterSocial: '',
    filterFloor: '',
    filterStatus: ''
  };

  function getMockData() {
    return { residents: {}, handovers: { rows: [] } };
  }

  function fetchData() {
    if (state.useMock || !API_BASE.trim()) {
      return Promise.resolve(getMockData());
    }
    return fetch(API_BASE)
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = JSON.parse(text);
          } catch (parseErr) {
            if (!res.ok) {
              throw new Error('API 錯誤: ' + res.status);
            }
            throw new Error('伺服器回傳的不是 JSON。請確認：1) 網址為 .../macros/s/xxx/exec（中間沒有 /u/7/） 2) 部署存取權為「任何人」。');
          }
          if (data && data.error) {
            throw new Error(data.error);
          }
          if (!res.ok) {
            throw new Error('API 錯誤: ' + res.status + (data && data.message ? ' ' + data.message : ''));
          }
          if (!data.residents) {
            data.residents = {};
          }
          if (!data.handovers || !data.handovers.rows) {
            data.handovers = { rows: [] };
          }
          return data;
        });
      })
      .catch(function (err) {
        var msg = err.message;
        if (msg === 'Failed to fetch' || msg === 'Load failed' || msg === 'NetworkError when attempting to fetch resource') {
          msg = '無法連線至伺服器。請確認：1) 使用「網址」開啟（如 GitHub Pages），不要雙擊本機 HTML 2) 部署存取權為「任何人」。';
        }
        throw new Error(msg);
      });
  }

  function formatToday() {
    var d = new Date();
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  /** 將 API 回傳的日期字串轉成 d/M/yyyy 顯示（支援長格式如 Sun Mar 08 2026...） */
  function normalizeDate(str) {
    if (!str || typeof str !== 'string') return str || '';
    var trimmed = str.trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return trimmed;
    var d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
    }
    return trimmed;
  }

  function load() {
    state.loading = true;
    if (!state.data) state.error = null;
    render();
    fetchData()
      .then(function (data) {
        state.data = data;
        state.error = null;
        state.loading = false;
        if (!state.selectedId && data.residents && Object.keys(data.residents).length > 0) {
          state.selectedId = Object.keys(data.residents)[0];
        }
        render();
      })
      .catch(function (err) {
        state.loading = false;
        if (!state.data) state.error = err.message;
        render();
      });
  }

  function getFilteredIds() {
    if (!state.data || !state.data.residents) return [];
    var residents = state.data.residents;
    var ids = Object.keys(residents);
    var searchLower = state.search.trim().toLowerCase();
    return ids.filter(function (id) {
      var info = residents[id];
      if (searchLower && info.name.toLowerCase().indexOf(searchLower) === -1 && info.room.toLowerCase().indexOf(searchLower) === -1) return false;
      if (state.filterSocial && info.socialWorker !== state.filterSocial) return false;
      if (state.filterFloor && info.floor !== state.filterFloor) return false;
      if (state.filterStatus && info.status !== state.filterStatus) return false;
      return true;
    });
  }

  function render() {
    var loadingEl = document.getElementById('loading');
    var contentEl = document.getElementById('content');
    var listEl = document.getElementById('resident-list');

    if (state.loading && !state.data) {
      loadingEl.style.display = 'flex';
      contentEl.hidden = true;
      return;
    }

    loadingEl.style.display = 'none';
    contentEl.hidden = false;

    var displayData = state.data || { residents: {}, handovers: { rows: [] } };
    var residents = displayData.residents || {};
    var handoverRows = displayData.handovers && displayData.handovers.rows ? displayData.handovers.rows : [];
    var latestRecords = handoverRows[0] ? handoverRows[0].records : {};
    var filteredIds = getFilteredIds();

    var socialWorkers = [];
    var floors = [];
    var statuses = [];
    Object.keys(residents).forEach(function (id) {
      var r = residents[id];
      if (r.socialWorker && socialWorkers.indexOf(r.socialWorker) === -1) socialWorkers.push(r.socialWorker);
      if (r.floor && floors.indexOf(r.floor) === -1) floors.push(r.floor);
      if (r.status && statuses.indexOf(r.status) === -1) statuses.push(r.status);
    });
    socialWorkers.sort();
    floors.sort();
    statuses.sort();

    var filterSocialEl = document.getElementById('filter-social');
    var filterFloorEl = document.getElementById('filter-floor');
    var filterStatusEl = document.getElementById('filter-status');
    filterSocialEl.innerHTML = '<option value="">全部社工</option>' + socialWorkers.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; }).join('');
    filterFloorEl.innerHTML = '<option value="">全部樓層</option>' + floors.map(function (f) { return '<option value="' + escapeHtml(f) + '">' + escapeHtml(f) + '</option>'; }).join('');
    filterStatusEl.innerHTML = '<option value="">全部狀態</option>' + statuses.map(function (s) { return '<option value="' + escapeHtml(s) + '">' + escapeHtml(s) + '</option>'; }).join('');
    filterSocialEl.value = state.filterSocial;
    filterFloorEl.value = state.filterFloor;
    filterStatusEl.value = state.filterStatus;

    listEl.innerHTML = '';
    if (filteredIds.length === 0) {
      listEl.innerHTML = '<p class="timeline-empty">沒有符合的院友</p>';
    } else {
      filteredIds.forEach(function (id) {
        var info = residents[id];
        var latest = latestRecords[id] || null;
        var preview = latest ? latest.split('\n')[0].slice(0, 20) + (latest.length > 20 ? '…' : '') : '';
        var statusClass = info.status === '在院舍' ? 'in' : 'out';
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'resident-card' + (state.selectedId === id ? ' selected' : '');
        card.innerHTML =
          '<div><span class="room">' + escapeHtml(info.room) + '</span> <span class="name">' + escapeHtml(info.name) + '</span> <span class="floor">(' + escapeHtml(info.floor) + ')</span></div>' +
          '<div class="meta">[' + escapeHtml(info.socialWorker) + '] <span class="status ' + statusClass + '">' + (info.status === '在院舍' ? '✅' : '❌') + escapeHtml(info.status) + '</span></div>' +
          (preview ? '<p class="preview" title="' + escapeHtml(latest || '') + '">' + (info.status === '在醫院' ? '⚠️ ' : '') + '最新：' + escapeHtml(preview) + '</p>' : '');
        card.addEventListener('click', function () {
          state.selectedId = id;
          render();
        });
        listEl.appendChild(card);
      });
    }

    var detailEmpty = document.getElementById('detail-empty');
    var detailPanel = document.getElementById('detail-panel');
    if (!state.selectedId || !residents[state.selectedId]) {
      detailEmpty.hidden = false;
      detailPanel.hidden = true;
      return;
    }

    detailEmpty.hidden = true;
    detailPanel.hidden = false;
    var info = residents[state.selectedId];
    var selectedLatest = latestRecords[state.selectedId] || null;

    document.getElementById('detail-title').textContent = info.room + ' ' + info.name;
    document.getElementById('detail-meta').textContent = info.floor + ' · 負責社工：' + info.socialWorker + ' · ' + info.status;

    var latestBox = document.getElementById('latest-handover');
    if (selectedLatest) {
      latestBox.className = 'latest-box';
      var latestDate = handoverRows[0] ? normalizeDate(handoverRows[0].date) : '';
      latestBox.innerHTML = '<p class="text">' + escapeHtml(selectedLatest).replace(/\n/g, '<br>') + '</p><p class="date">' + escapeHtml(latestDate) + '</p>';
    } else {
      latestBox.className = 'latest-box empty';
      latestBox.textContent = '尚無交更記錄';
    }

    var timelineBox = document.getElementById('timeline');
    var items = handoverRows
      .map(function (row) {
        var text = (row.records[state.selectedId] || '').trim();
        return text ? { date: row.date, text: text } : null;
      })
      .filter(Boolean);
    if (items.length === 0) {
      timelineBox.innerHTML = '<p class="timeline-empty">尚無歷史交更記錄</p>';
    } else {
      timelineBox.innerHTML = items.map(function (item) {
        return '<div class="timeline-item">' +
          '<span class="timeline-dot"></span>' +
          '<div class="timeline-body">' +
          '<p class="date">' + escapeHtml(normalizeDate(item.date)) + '</p>' +
          '<p class="text">' + escapeHtml(item.text).replace(/\n/g, '<br>') + '</p>' +
          '</div></div>';
      }).join('');
    }

    document.getElementById('today-date').textContent = '日期：' + formatToday();
    document.getElementById('handover-text').value = '';
    document.getElementById('form-msg').textContent = '';
    document.getElementById('form-msg').className = 'form-msg';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function onSubmit() {
    var textarea = document.getElementById('handover-text');
    var msgEl = document.getElementById('form-msg');
    var btn = document.getElementById('submit-btn');
    var content = textarea.value.trim();
    if (!content) {
      msgEl.className = 'form-msg err';
      msgEl.textContent = '請輸入交更內容';
      return;
    }
    btn.disabled = true;
    msgEl.textContent = '';
    msgEl.className = 'form-msg';
    var records = {};
    records[state.selectedId] = content;
    var submitUrl = API_BASE;
    var payload = { date: formatToday(), records: records };
    if (!submitUrl.trim()) {
      msgEl.className = 'form-msg ok';
      msgEl.textContent = '已儲存（模擬），畫面將自動更新';
      textarea.value = '';
      btn.disabled = false;
      load();
      return;
    }
    var saveUrl = API_BASE + '?action=save&date=' + encodeURIComponent(payload.date) + '&records=' + encodeURIComponent(JSON.stringify(payload.records));
    fetch(saveUrl)
      .then(function (res) { return res.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return {}; } }); })
      .then(function (data) {
        if (data && data.success !== false) {
          msgEl.className = 'form-msg ok';
          msgEl.textContent = '已儲存，畫面將自動更新';
          textarea.value = '';
          load();
        } else {
          msgEl.className = 'form-msg err';
          msgEl.textContent = (data && data.message) || '儲存失敗';
        }
      })
      .catch(function (err) {
        msgEl.className = 'form-msg err';
        msgEl.textContent = err.message || '儲存失敗（請確認以網址開啟並已部署 Code.gs 新版本）';
      })
      .then(function () {
        btn.disabled = false;
      });
  }

  function bind() {
    document.getElementById('search').addEventListener('input', function () {
      state.search = this.value;
      render();
    });
    document.getElementById('filter-social').addEventListener('change', function () {
      state.filterSocial = this.value;
      render();
    });
    document.getElementById('filter-floor').addEventListener('change', function () {
      state.filterFloor = this.value;
      render();
    });
    document.getElementById('filter-status').addEventListener('change', function () {
      state.filterStatus = this.value;
      render();
    });
    document.getElementById('submit-btn').addEventListener('click', onSubmit);
  }

  bind();
  load();
  setInterval(load, REFRESH_MS);
})();
