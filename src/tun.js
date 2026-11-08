const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class TunManager {
  constructor(binDir) {
    this.binDir = binDir || path.resolve(__dirname, '..', 'bin');
    this.singBoxPath = path.join(this.binDir, 'sing-box.exe');
    this.configPath = path.join(this.binDir, 'tun_config.json');
    this.process = null;
    this.isRunning = false;
    this.mode = 'sysproxy'; // 'sysproxy' (recommended, no VPN conflict) or 'tun'
    this.lastError = null;
    this.logs = [];
  }

  isAdmin() {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  setSystemProxy(enable, port = 1080) {
    try {
      if (enable) {
        execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:${port}" /f`, { stdio: 'ignore' });
        execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`, { stdio: 'ignore' });
      } else {
        execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`, { stdio: 'ignore' });
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  start(socksPort = 1080) {
    if (this.isRunning) {
      return { ok: true, message: 'System Mode is already running' };
    }

    try {
      // Primary: Enable Windows System Proxy (Rock solid, zero driver conflict with VPNs)
      this.setSystemProxy(true, socksPort);
      this.isRunning = true;
      this.lastError = null;
      return { ok: true, message: 'حالت هدایت کل ترافیک سیستم (System Proxy) با موفقیت فعال شد.' };
    } catch (e) {
      this.isRunning = false;
      this.lastError = e.message;
      return { ok: false, error: 'START_FAILED', message: e.message };
    }
  }

  stop() {
    try {
      // 1. Disable Windows System Proxy
      this.setSystemProxy(false);

      // 2. Kill sing-box if running in background
      if (this.process) {
        try {
          execSync(`taskkill /pid ${this.process.pid} /T /F`, { stdio: 'ignore' });
        } catch (e) {}
        this.process = null;
      }
      try {
        execSync('taskkill /f /im sing-box.exe', { stdio: 'ignore' });
      } catch (e) {}

      this.isRunning = false;
      return { ok: true, message: 'حالت کل سیستم غیرفعال و شبکه به حالت عادی بازگشت.' };
    } catch (e) {
      this.isRunning = false;
      return { ok: false, error: 'STOP_FAILED', message: e.message };
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      isAdmin: this.isAdmin(),
      lastError: this.lastError,
      logs: this.logs.slice(-20)
    };
  }
}

module.exports = TunManager;
