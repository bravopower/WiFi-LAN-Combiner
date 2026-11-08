const net = require('net');
const dns = require('dns');
const os = require('os');
const https = require('https');

// Tunnel & virtual interface keywords to exclude
const SKIP_INTERFACES = [
  'xray', 'tun', 'tap', 'vpn', 'hamachi', 'wiresock',
  'openvpn', 'tunnelbear', 'surfshark', 'express', 'loopback',
  'bluetooth', 'roboping', 'pseudo', 'wintun', 'sing-box'
];

class CombinerEngine {
  constructor(options = {}) {
    this.port = options.port || 1080;
    this.host = options.host || '127.0.0.1';
    this.server = null;
    this.isRunning = false;
    
    // Distribution mode: 'auto', 'equal', 'manual'
    this.mode = 'auto';
    this.interfaces = [];
    this.weightedPool = [];
    this.poolIndex = 0;
    
    // Statistics & tracking
    this.stats = {};
    this.speedTracker = {};
    this.totalConnections = 0;
    this.activeConnections = 0;
    this.serverStartTime = Date.now();
    this.logs = [];
    this.logId = 0;
    
    // Timer for speed calculation
    this.speedInterval = null;
    this.isTestingSpeed = false;
  }

  detectInterfaces() {
    const all = os.networkInterfaces();
    const detected = [];

    for (const [name, addrs] of Object.entries(all)) {
      const lower = name.toLowerCase();
      if (SKIP_INTERFACES.some(skip => lower.includes(skip))) continue;

      for (const addr of addrs) {
        // Exclude IPv6, internal/loopback, and APIPA (169.254.*)
        if (addr.family === 'IPv4' && !addr.internal && !addr.address.startsWith('169.254.')) {
          let type = 'other';
          if (lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless')) {
            type = 'wifi';
          } else if (lower.includes('ethernet') || lower.includes('lan') || lower.includes('local area')) {
            type = 'lan';
          }

          detected.push({
            name,
            address: addr.address,
            type,
            weight: 1,
            speedKBs: 0,
            active: true
          });
        }
      }
    }

    // Preserve existing weights if interface was already known
    for (const d of detected) {
      const existing = this.interfaces.find(i => i.address === d.address);
      if (existing) {
        d.weight = existing.weight;
        d.speedKBs = existing.speedKBs;
      }
      if (!this.stats[d.name]) {
        this.stats[d.name] = { bytesDown: 0, bytesUp: 0, conns: 0, activeConns: 0, speedDownKBs: 0, speedUpKBs: 0 };
        this.speedTracker[d.name] = { lastDown: 0, lastUp: 0, lastTime: Date.now() };
      }
    }

    this.interfaces = detected;
    this.rebuildPool();
    return this.interfaces;
  }

  rebuildPool() {
    const pool = [];
    for (const iface of this.interfaces) {
      const w = Math.max(1, iface.weight || 1);
      for (let i = 0; i < w; i++) {
        pool.push(iface);
      }
    }
    this.weightedPool = pool.length > 0 ? pool : this.interfaces;
    if (this.poolIndex >= this.weightedPool.length) {
      this.poolIndex = 0;
    }
  }

  getNextInterface() {
    if (this.weightedPool.length === 0) {
      this.rebuildPool();
    }
    if (this.weightedPool.length === 0) return null;

    const iface = this.weightedPool[this.poolIndex];
    this.poolIndex = (this.poolIndex + 1) % this.weightedPool.length;
    return iface;
  }

  setMode(mode, customWeights = null) {
    this.mode = mode;
    if (mode === 'equal') {
      for (const i of this.interfaces) i.weight = 1;
    } else if (mode === 'manual' && customWeights) {
      for (const [addr, w] of Object.entries(customWeights)) {
        const found = this.interfaces.find(i => i.address === addr);
        if (found) found.weight = Math.max(1, Math.min(10, Number(w)));
      }
    }
    this.rebuildPool();
  }

  speedTestInterface(localAddress, timeoutMs = 7000) {
    return new Promise((resolve) => {
      const testBytes = 2500000; // 2.5 MB
      const url = `https://speed.cloudflare.com/__down?bytes=${testBytes}`;
      const startTime = Date.now();
      let received = 0;

      const req = https.get(url, { localAddress, timeout: timeoutMs }, (res) => {
        res.on('data', (chunk) => { received += chunk.length; });
        res.on('end', () => {
          const elapsed = (Date.now() - startTime) / 1000;
          const speedKBs = elapsed > 0 ? Math.round(received / elapsed / 1024) : 0;
          resolve(speedKBs);
        });
        res.on('error', () => resolve(0));
      });

      req.on('error', () => resolve(0));
      req.on('timeout', () => {
        req.destroy();
        resolve(0);
      });
    });
  }

  async runSpeedCalibration() {
    if (this.isTestingSpeed) return false;
    this.isTestingSpeed = true;
    try {
      this.detectInterfaces();
      const speeds = [];
      for (const iface of this.interfaces) {
        const spd = await this.speedTestInterface(iface.address);
        iface.speedKBs = spd;
        speeds.push(spd);
      }

      if (this.mode === 'auto') {
        const positiveSpeeds = speeds.filter(s => s > 0);
        const minSpeed = positiveSpeeds.length > 0 ? Math.min(...positiveSpeeds) : 1;
        for (const iface of this.interfaces) {
          if (iface.speedKBs > 0) {
            iface.weight = Math.max(1, Math.min(10, Math.round(iface.speedKBs / minSpeed)));
          } else {
            iface.weight = 1;
          }
        }
      }
      this.rebuildPool();
      return true;
    } finally {
      this.isTestingSpeed = false;
    }
  }

  addLog(ifaceName, host, port, success, errorMsg = '') {
    const entry = {
      id: ++this.logId,
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      iface: ifaceName,
      host,
      port,
      success,
      error: errorMsg
    };
    this.logs.push(entry);
    if (this.logs.length > 150) this.logs.shift();
  }

  start() {
    if (this.isRunning) return true;

    this.detectInterfaces();
    this.server = net.createServer((socket) => this.handleClient(socket));

    this.server.on('error', (err) => {
      console.error('[Combiner] Server error:', err.message);
    });

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        this.isRunning = true;
        this.serverStartTime = Date.now();
        this.startSpeedTicker();
        resolve(true);
      });
      this.server.once('error', reject);
    });
  }

  stop() {
    if (!this.isRunning || !this.server) return Promise.resolve(true);

    if (this.speedInterval) {
      clearInterval(this.speedInterval);
      this.speedInterval = null;
    }

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        this.server = null;
        resolve(true);
      });
    });
  }

  startSpeedTicker() {
    if (this.speedInterval) clearInterval(this.speedInterval);
    this.speedInterval = setInterval(() => {
      const now = Date.now();
      for (const iface of this.interfaces) {
        const s = this.stats[iface.name];
        const tracker = this.speedTracker[iface.name];
        if (s && tracker) {
          const dt = (now - tracker.lastTime) / 1000;
          if (dt > 0) {
            s.speedDownKBs = Math.round((s.bytesDown - tracker.lastDown) / dt / 1024);
            s.speedUpKBs = Math.round((s.bytesUp - tracker.lastUp) / dt / 1024);
            tracker.lastDown = s.bytesDown;
            tracker.lastUp = s.bytesUp;
            tracker.lastTime = now;
          }
        }
      }
    }, 1000);
  }

  handleClient(clientSocket) {
    clientSocket.once('error', () => {});

    // SOCKS5 Step 1: Greeting
    clientSocket.once('data', (initData) => {
      if (!initData || initData.length < 2 || initData[0] !== 0x05) {
        clientSocket.destroy();
        return;
      }

      // SOCKS5 reply: No auth required
      clientSocket.write(Buffer.from([0x05, 0x00]));

      // SOCKS5 Step 2: Request
      clientSocket.once('data', (reqData) => {
        if (!reqData || reqData.length < 4 || reqData[0] !== 0x05) {
          clientSocket.destroy();
          return;
        }

        const cmd = reqData[1];
        if (cmd !== 0x01) { // CONNECT only
          this.sendReply(clientSocket, 0x07); // Command not supported
          return;
        }

        const atyp = reqData[3];
        let targetHost;
        let targetPort;

        try {
          if (atyp === 0x01) {
            // IPv4
            if (reqData.length < 10) { this.sendReply(clientSocket, 0x01); return; }
            targetHost = `${reqData[4]}.${reqData[5]}.${reqData[6]}.${reqData[7]}`;
            targetPort = reqData.readUInt16BE(8);
          } else if (atyp === 0x03) {
            // Domain
            const len = reqData[4];
            if (reqData.length < 5 + len + 2) { this.sendReply(clientSocket, 0x01); return; }
            targetHost = reqData.slice(5, 5 + len).toString('ascii');
            targetPort = reqData.readUInt16BE(5 + len);
          } else if (atyp === 0x04) {
            // IPv6
            if (reqData.length < 22) { this.sendReply(clientSocket, 0x08); return; }
            const parts = [];
            for (let i = 0; i < 16; i += 2) parts.push(reqData.readUInt16BE(4 + i).toString(16));
            targetHost = parts.join(':');
            targetPort = reqData.readUInt16BE(20);
          } else {
            this.sendReply(clientSocket, 0x08);
            return;
          }
        } catch (e) {
          this.sendReply(clientSocket, 0x01);
          return;
        }

        const iface = this.getNextInterface();
        if (!iface) {
          this.sendReply(clientSocket, 0x03); // Network unreachable
          return;
        }

        const connectOutbound = (destHost) => {
          const targetSocket = net.createConnection({
            host: destHost,
            port: targetPort,
            localAddress: iface.address
          });

          targetSocket.once('error', (err) => {
            this.addLog(iface.name, targetHost, targetPort, false, err.code || err.message);
            this.sendReply(clientSocket, 0x05); // Connection refused
          });

          targetSocket.once('connect', () => {
            this.totalConnections++;
            this.activeConnections++;
            const s = this.stats[iface.name];
            if (s) {
              s.conns++;
              s.activeConns++;
            }
            this.addLog(iface.name, targetHost, targetPort, true);
            this.sendReply(clientSocket, 0x00); // Success

            // Track traffic
            clientSocket.on('data', (chunk) => {
              if (s) s.bytesUp += chunk.length;
            });
            targetSocket.on('data', (chunk) => {
              if (s) s.bytesDown += chunk.length;
            });

            clientSocket.pipe(targetSocket);
            targetSocket.pipe(clientSocket);

            const cleanup = () => {
              if (targetSocket.__cleaned) return;
              targetSocket.__cleaned = true;
              this.activeConnections = Math.max(0, this.activeConnections - 1);
              if (s) s.activeConns = Math.max(0, s.activeConns - 1);
              clientSocket.destroy();
              targetSocket.destroy();
            };

            clientSocket.on('close', cleanup);
            targetSocket.on('close', cleanup);
            clientSocket.on('error', cleanup);
            targetSocket.on('error', cleanup);
          });
        };

        if (atyp === 0x03) {
          dns.resolve4(targetHost, (err, addrs) => {
            if (err || !addrs || addrs.length === 0) {
              connectOutbound(targetHost);
            } else {
              connectOutbound(addrs[0]);
            }
          });
        } else {
          connectOutbound(targetHost);
        }
      });
    });
  }

  sendReply(socket, repCode) {
    const reply = Buffer.alloc(10);
    reply[0] = 0x05;
    reply[1] = repCode;
    reply[2] = 0x00;
    reply[3] = 0x01; // IPv4
    try {
      socket.write(reply);
      if (repCode !== 0x00) socket.destroy();
    } catch (e) {
      socket.destroy();
    }
  }

  getSnapshot() {
    let totalDown = 0;
    let totalUp = 0;
    let totalSpeedDownKBs = 0;
    let totalSpeedUpKBs = 0;

    const ifaceList = this.interfaces.map(i => {
      const s = this.stats[i.name] || { bytesDown: 0, bytesUp: 0, conns: 0, activeConns: 0, speedDownKBs: 0, speedUpKBs: 0 };
      totalDown += s.bytesDown;
      totalUp += s.bytesUp;
      totalSpeedDownKBs += s.speedDownKBs;
      totalSpeedUpKBs += s.speedUpKBs;

      return {
        name: i.name,
        address: i.address,
        type: i.type,
        weight: i.weight,
        speedKBs: i.speedKBs,
        bytesDown: s.bytesDown,
        bytesUp: s.bytesUp,
        conns: s.conns,
        activeConns: s.activeConns,
        speedDownKBs: s.speedDownKBs,
        speedUpKBs: s.speedUpKBs
      };
    });

    return {
      running: this.isRunning,
      port: this.port,
      host: this.host,
      mode: this.mode,
      isTestingSpeed: this.isTestingSpeed,
      totalConnections: this.totalConnections,
      activeConnections: this.activeConnections,
      totalBytesDown: totalDown,
      totalBytesUp: totalUp,
      totalSpeedDownKBs,
      totalSpeedUpKBs,
      uptime: Date.now() - this.serverStartTime,
      interfaces: ifaceList,
      recentLogs: this.logs.slice(-30)
    };
  }
}

module.exports = CombinerEngine;
