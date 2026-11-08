const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CombinerEngine = require('./combiner');
const TunManager = require('./tun');

const PORT = 8888;
const HOST = '127.0.0.1';

const combiner = new CombinerEngine({ port: 1080 });
const tun = new TunManager();

const WEB_DIR = path.resolve(__dirname, '..', 'web');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // ─── API Routes ───────────────────────────────────────────────────────────
  if (pathname === '/api/status' && req.method === 'GET') {
    const combinerStatus = combiner.getSnapshot();
    const tunStatus = tun.getStatus();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      combiner: combinerStatus,
      tun: tunStatus
    }));
    return;
  }

  if (pathname === '/api/proxy/toggle' && req.method === 'POST') {
    if (combiner.isRunning) {
      if (tun.isRunning) {
        tun.stop();
      }
      await combiner.stop();
    } else {
      await combiner.start();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, running: combiner.isRunning }));
    return;
  }

  if (pathname === '/api/tun/toggle' && req.method === 'POST') {
    if (tun.isRunning) {
      const resStop = tun.stop();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resStop));
    } else {
      if (!combiner.isRunning) {
        await combiner.start();
      }
      const resStart = tun.start(combiner.port);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resStart));
    }
    return;
  }

  if (pathname === '/api/mode' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      combiner.setMode(body.mode, body.weights);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: combiner.mode }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
    return;
  }

  if (pathname === '/api/speedtest' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Speedtest started' }));
    // Run calibration in background
    combiner.runSpeedCalibration();
    return;
  }

  if (pathname === '/api/restart-admin' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Restarting as Administrator...' }));

    const batchPath = path.resolve(__dirname, '..', 'Start-Combiner.bat');
    const psCmd = `Start-Process -FilePath "${batchPath}" -Verb RunAs`;
    spawn('powershell', ['-WindowStyle', 'Hidden', '-Command', psCmd], {
      detached: true,
      stdio: 'ignore'
    }).unref();

    setTimeout(() => {
      process.exit(0);
    }, 1000);
    return;
  }

  // ─── Static Files ─────────────────────────────────────────────────────────
  let safePath = path.normalize(path.join(WEB_DIR, pathname === '/' ? 'index.html' : pathname));
  if (!safePath.startsWith(WEB_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    serveStatic(req, res, safePath);
  } else {
    serveStatic(req, res, path.join(WEB_DIR, 'index.html'));
  }
});

// Cleanup upon exit
function cleanup() {
  console.log('\n[WiFi-LAN Combiner] Shutting down cleanly...');
  tun.stop();
  combiner.stop();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
  tun.stop();
});

async function main() {
  console.log('========================================================');
  console.log('   WiFi-LAN Combiner - Internet Bonding & TUN Mode      ');
  console.log('========================================================');

  // Start Combiner Proxy by default
  await combiner.start();
  console.log(`[Combiner] SOCKS5 Proxy listening on 127.0.0.1:${combiner.port}`);

  server.listen(PORT, HOST, () => {
    console.log(`[Dashboard] Web App available at http://${HOST}:${PORT}`);
  });

  // NOTE: Speed calibration is NOT run at startup automatically.
  // It uses cloudflare speed.cloudflare.com which may be blocked in some regions.
  // The user can trigger it manually from the dashboard via the speedtest button.
}

main().catch(err => {
  console.error('[Fatal Error]', err);
});

