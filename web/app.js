let currentStatus = null;
let speedHistory = [];
const MAX_CHART_POINTS = 30;

// Format bytes to human readable
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

// Format speed
function formatSpeed(kbs) {
  if (!kbs || kbs === 0) return { val: '0.0', unit: 'KB/s' };
  if (kbs >= 1024) {
    return { val: (kbs / 1024).toFixed(1), unit: 'MB/s' };
  }
  return { val: kbs.toString(), unit: 'KB/s' };
}

// Fetch status from backend
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    currentStatus = data;
    renderUI(data);
  } catch (err) {
    console.warn('Backend polling error:', err);
  }
}

// Render entire UI
function renderUI(data) {
  const { combiner, tun } = data;

  // 1. Admin Badge & Restart Button
  const adminBadge = document.getElementById('admin-badge');
  const adminText = document.getElementById('admin-text');
  const btnRestartAdmin = document.getElementById('btn-restart-admin');

  if (tun.isAdmin) {
    adminBadge.className = 'badge badge-success';
    adminText.textContent = '🛡️ مدیر سیستم (Admin)';
    btnRestartAdmin.style.display = 'none';
    document.getElementById('tun-note').textContent = 'آماده برای اتصال کل ویندوز';
    document.getElementById('tun-note').style.color = '#34d399';
  } else {
    adminBadge.className = 'badge badge-warning';
    adminText.textContent = '⚠️ نیاز به دسترسی ادمین برای TUN';
    btnRestartAdmin.style.display = 'inline-block';
    document.getElementById('tun-note').textContent = 'برای فعال‌سازی TUN برنامه را با ادمین باز کنید';
    document.getElementById('tun-note').style.color = '#fbbf24';
  }

  // 2. Master Switches
  const toggleProxy = document.getElementById('toggle-proxy');
  const toggleTun = document.getElementById('toggle-tun');

  if (document.activeElement !== toggleProxy) {
    toggleProxy.checked = combiner.running;
  }
  if (document.activeElement !== toggleTun) {
    toggleTun.checked = tun.running;
  }

  // 3. Status Pill
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  if (tun.running) {
    statusPill.className = 'status-pill status-active';
    statusText.textContent = 'تونل کل سیستم فعال است';
  } else if (combiner.running) {
    statusPill.className = 'status-pill status-active';
    statusText.textContent = 'پروکسی آماده (حالت IDM)';
  } else {
    statusPill.className = 'status-pill';
    statusText.textContent = 'موتور متوقف است';
  }

  // 4. Combined Speed & Bandwidth
  const spd = formatSpeed(combiner.totalSpeedDownKBs);
  document.getElementById('total-speed-down').textContent = spd.val;
  document.getElementById('total-speed-unit').textContent = spd.unit;
  document.getElementById('total-speed-up').textContent = combiner.totalSpeedUpKBs + ' KB/s';
  document.getElementById('active-conns').textContent = combiner.activeConnections;
  document.getElementById('total-bytes-down').textContent = formatBytes(combiner.totalBytesDown);
  document.getElementById('total-conns-count').textContent = combiner.totalConnections;

  // Chart update
  speedHistory.push(combiner.totalSpeedDownKBs);
  if (speedHistory.length > MAX_CHART_POINTS) speedHistory.shift();
  drawSpeedChart();

  // 5. Render Adapters Cards
  renderAdapters(combiner.interfaces, combiner.mode);

  // 6. Mode selector radio update
  const radio = document.querySelector(`input[name="bal-mode"][value="${combiner.mode}"]`);
  if (radio && document.activeElement !== radio) {
    radio.checked = true;
  }
  const manualControls = document.getElementById('manual-controls');
  if (combiner.mode === 'manual') {
    manualControls.style.display = 'block';
  } else {
    manualControls.style.display = 'none';
  }

  // 7. Render Logs
  renderLogs(combiner.recentLogs);
}

// Render Adapters
function renderAdapters(interfaces, mode) {
  const container = document.getElementById('adapters-list');
  if (!interfaces || interfaces.length === 0) {
    container.innerHTML = '<div class="empty-state">هیچ کارت شبکه فعالی یافت نشد! مودم و وای‌فای را چک کنید.</div>';
    return;
  }

  let html = '';
  for (const iface of interfaces) {
    const isWifi = iface.type === 'wifi';
    const icon = isWifi ? '📶' : '🔌';
    const label = isWifi ? 'اینترنت وای‌فای (Wi-Fi)' : 'مودم کابل شبکه (LAN)';
    const spd = formatSpeed(iface.speedDownKBs);

    html += `
      <div class="adapter-card">
        <div class="adapter-header">
          <div class="adapter-info">
            <div class="adapter-icon">${icon}</div>
            <div>
              <div class="adapter-name">${label} <small style="color:var(--text-muted);font-weight:normal">(${iface.name})</small></div>
              <div class="adapter-ip">${iface.address}</div>
            </div>
          </div>
          <div class="adapter-speed-badge">
            ${spd.val} ${spd.unit}
          </div>
        </div>
        <div class="adapter-stats">
          <div class="astat-item">
            <span class="astat-label">حجم دانلود</span>
            <span class="astat-val">${formatBytes(iface.bytesDown)}</span>
          </div>
          <div class="astat-item">
            <span class="astat-label">اتصالات فعال</span>
            <span class="astat-val">${iface.activeConns} / ${iface.conns}</span>
          </div>
          <div class="astat-item">
            <span class="astat-label">سهم ترافیک (وزن)</span>
            <span class="astat-val" style="color:var(--cyan-primary)">ضریب ${iface.weight}</span>
          </div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;

  // Also build manual sliders if in manual mode
  const sliderContainer = document.getElementById('weight-sliders');
  if (sliderContainer.children.length !== interfaces.length) {
    let sHtml = '';
    for (const iface of interfaces) {
      const isWifi = iface.type === 'wifi';
      const label = isWifi ? 'وای‌فای' : 'مودم لن';
      sHtml += `
        <div class="slider-row">
          <label>${label}:</label>
          <input type="range" min="1" max="10" value="${iface.weight}" data-addr="${iface.address}" oninput="this.nextElementSibling.textContent = this.value">
          <span>${iface.weight}</span>
        </div>
      `;
    }
    sliderContainer.innerHTML = sHtml;
  }
}

// Render Logs
function renderLogs(logs) {
  const tbody = document.getElementById('logs-tbody');
  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">هنوز ترافیکی ثبت نشده است...</td></tr>';
    return;
  }

  const reversed = [...logs].reverse().slice(0, 25);
  let html = '';
  for (const log of reversed) {
    const isSuccess = log.success;
    const tagClass = isSuccess ? 'status-success' : 'status-fail';
    const tagText = isSuccess ? 'موفق' : 'خطا';

    html += `
      <tr>
        <td style="color:var(--text-muted); direction:ltr;">${log.time}</td>
        <td><strong style="color:var(--cyan-primary);">${log.iface}</strong></td>
        <td style="direction:ltr; font-family:Consolas, monospace;">${log.host}</td>
        <td>${log.port}</td>
        <td><span class="status-tag ${tagClass}">${tagText}</span></td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

// Draw live canvas chart
function drawSpeedChart() {
  const canvas = document.getElementById('speed-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  if (speedHistory.length < 2) return;

  const maxVal = Math.max(1024, ...speedHistory) * 1.15;
  const step = w / (MAX_CHART_POINTS - 1);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
  grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

  ctx.beginPath();
  ctx.moveTo(0, h);

  for (let i = 0; i < speedHistory.length; i++) {
    const x = i * step;
    const y = h - (speedHistory[i] / maxVal) * (h - 10);
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.lineTo((speedHistory.length - 1) * step, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Stroke line
  ctx.beginPath();
  for (let i = 0; i < speedHistory.length; i++) {
    const x = i * step;
    const y = h - (speedHistory[i] / maxVal) * (h - 10);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// User Actions
async function toggleProxy() {
  await fetch('/api/proxy/toggle', { method: 'POST' });
  fetchStatus();
}

async function toggleTun() {
  const res = await fetch('/api/tun/toggle', { method: 'POST' });
  const data = await res.json();
  if (!data.ok) {
    alert(data.message || 'خطا در فعال‌سازی حالت TUN');
  }
  fetchStatus();
}

async function changeMode(mode) {
  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode })
  });
  fetchStatus();
}

async function saveManualWeights() {
  const sliders = document.querySelectorAll('#weight-sliders input[type="range"]');
  const weights = {};
  sliders.forEach(s => {
    weights[s.getAttribute('data-addr')] = Number(s.value);
  });

  await fetch('/api/mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'manual', weights })
  });
  alert('ضرایب با موفقیت ذخیره شد.');
  fetchStatus();
}

async function runSpeedtest() {
  const btn = document.getElementById('btn-speedtest');
  btn.disabled = true;
  btn.textContent = 'در حال تست سرعت...';
  try {
    await fetch('/api/speedtest', { method: 'POST' });
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<span class="btn-icon">⚡</span><span>تست خودکار سرعت</span>';
      fetchStatus();
    }, 4000);
  }
}

async function restartAdmin() {
  if (confirm('برنامه ری‌استارت خواهد شد و پنجره دسترسی Administrator (UAC) ویندوز باز می‌شود. مایل به ادامه هستید؟')) {
    await fetch('/api/restart-admin', { method: 'POST' });
  }
}

function toggleIdmHelp() {
  const body = document.getElementById('idm-body');
  const arrow = document.getElementById('idm-toggle-arrow');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    arrow.textContent = '▲';
  } else {
    body.style.display = 'none';
    arrow.textContent = '▼';
  }
}

// Start polling
setInterval(fetchStatus, 1000);
fetchStatus();

