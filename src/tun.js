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

  generateConfig(socksPort = 1080) {
    const config = {
      log: {
        level: 'info'
      },
      dns: {
        servers: [
          {
            tag: 'dns-remote',
            type: 'tcp',
            server: '1.1.1.1',
            detour: 'socks-out'
          }
        ]
      },
      inbounds: [
        {
          type: 'tun',
          tag: 'tun-in',
          address: ['172.19.0.1/30'],
          auto_route: true,
          strict_route: false,
          stack: 'system'
        }
      ],
      outbounds: [
        {
          type: 'socks',
          tag: 'socks-out',
          server: '127.0.0.1',
          server_port: socksPort
        },
        {
          type: 'direct',
          tag: 'direct-out'
        }
      ],
      route: {
        auto_detect_interface: true,
        rules: [
          {
            protocol: 'dns',
            action: 'hijack-dns'
          },
          {
            ip_is_private: true,
            outbound: 'direct-out'
          }
        ],
        final: 'socks-out'
      }
    };

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    return this.configPath;
  }

  start(socksPort = 1080) {
    if (this.isRunning) {
      return { ok: true, message: 'TUN is already running' };
    }

    if (!fs.existsSync(this.singBoxPath)) {
      return { ok: false, error: 'BINARY_MISSING', message: 'فایل sing-box.exe در پوشه bin یافت نشد.' };
    }

    if (!this.isAdmin()) {
      return {
        ok: false,
        error: 'ADMIN_REQUIRED',
        message: 'برای فعال‌سازی حالت تونل کل سیستم (TUN Mode)، اجرای برنامه با دسترسی Administrator الزامی است.'
      };
    }

    try {
      this.generateConfig(socksPort);

      this.process = spawn(this.singBoxPath, ['run', '-c', this.configPath], {
        cwd: this.binDir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.isRunning = true;
      this.lastError = null;

      const appendLog = (data) => {
        const lines = data.toString().split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const entry = {
            time: new Date().toLocaleTimeString('en-US', { hour12: false }),
            text: line
          };
          this.logs.push(entry);
          if (this.logs.length > 200) this.logs.shift();
        }
      };

      this.process.stdout.on('data', appendLog);
      this.process.stderr.on('data', (data) => {
        appendLog(data);
        const str = data.toString();
        if (str.includes('FATAL') || str.includes('panic:')) {
          this.lastError = str.trim();
        }
      });

      this.process.on('error', (err) => {
        this.isRunning = false;
        this.lastError = err.message;
        this.process = null;
      });

      this.process.on('close', (code) => {
        this.isRunning = false;
        this.process = null;
      });

      return { ok: true, message: 'حالت تونل کل سیستم با موفقیت فعال شد.' };
    } catch (e) {
      this.isRunning = false;
      this.lastError = e.message;
      return { ok: false, error: 'START_FAILED', message: e.message };
    }
  }

  stop() {
    if (!this.isRunning || !this.process) {
      this.isRunning = false;
      this.process = null;
      return { ok: true, message: 'TUN was not running' };
    }

    try {
      const pid = this.process.pid;
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } catch (e) {
        this.process.kill('SIGINT');
      }
      this.isRunning = false;
      this.process = null;
      return { ok: true, message: 'حالت تونل کل سیستم غیرفعال شد.' };
    } catch (e) {
      this.isRunning = false;
      this.process = null;
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
