import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(rootDir, 'data', 'db.json');

// Server-only env: .env is parsed here and used exclusively by the /api/ai proxy.
// Vite never inlines these into the client bundle (no VITE_ prefix, config-file scope only).
function readEnvFile(name) {
  try {
    const out = {};
    for (const line of fs.readFileSync(path.join(rootDir, name), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    return out;
  } catch { return {}; }
}
const fileEnv = readEnvFile('.env');
const GROQ_API_KEY = (process.env.GROQ_API_KEY || fileEnv.GROQ_API_KEY || '').trim();
const GROQ_MODEL = (process.env.GROQ_MODEL || fileEnv.GROQ_MODEL || 'llama-3.3-70b-versatile').trim();

function readServerDb() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return null; }
}
function writeServerDb(obj) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(obj));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}

// Provider 1: Groq official API (free-tier key from .env). Server-to-server: no Origin
// header, no key in the browser. Fast-fails on bad key / rate limit / timeout.
function callGroq(messages) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    let req;
    try {
      const data = JSON.stringify({ model: GROQ_MODEL, messages, max_tokens: 900, temperature: 0.7 });
      req = https.request({
        hostname: 'api.groq.com',
        path: '/openai/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + GROQ_API_KEY,
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 10000
      }, r => {
        let buf = '';
        r.on('data', chunk => { buf += chunk; if (buf.length > 100 * 1024) r.destroy(); });
        r.on('end', () => {
          let text = '';
          try {
            const j = JSON.parse(buf);
            const msg = j && j.choices && j.choices[0] && j.choices[0].message;
            text = String((msg && msg.content) || '').trim();
          } catch { /* bad upstream body */ }
          if (r.statusCode === 200 && text) done({ ok: true, text });
          else done({ ok: false, why: 'groq_' + r.statusCode });
        });
      });
      req.on('timeout', () => req.destroy(new Error('timeout')));
      req.on('error', e => done({ ok: false, why: e && e.message === 'timeout' ? 'groq_timeout' : 'groq_unreachable' }));
      req.write(data);
      req.end();
    } catch { done({ ok: false, why: 'groq_unreachable' }); }
  });
}

// Provider 2: pollinations.ai (keyless, no quota) — fallback when no Groq key or Groq failed.
function callPollinations(messages) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; resolve(v); } };
    try {
      const up = https.request({
        hostname: 'text.pollinations.ai',
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 18000
      }, r => {
        let data = '';
        r.on('data', chunk => { data += chunk; if (data.length > 100 * 1024) r.destroy(); });
        r.on('end', () => {
          if (r.statusCode === 200) {
            const text = String(data).trim();
            if (text) return done({ ok: true, text });
            done({ ok: false, status: 502, why: 'empty_upstream' });
          } else {
            done({ ok: false, status: r.statusCode === 429 ? 429 : 502, why: 'upstream_' + r.statusCode });
          }
        });
      });
      up.on('timeout', () => up.destroy(new Error('timeout')));
      up.on('error', () => done({ ok: false, status: 504, why: 'upstream_unreachable' }));
      up.write(JSON.stringify({ model: 'openai', messages }));
      up.end();
    } catch { done({ ok: false, status: 504, why: 'upstream_unreachable' }); }
  });
}

function ssaSyncApi() {
  const clients = new Set();
  const broadcast = () => { for (const res of clients) { try { res.write('data: db\n\n'); } catch { /* closed */ } } };
  // Same-origin enforcement: only the app itself (or tools without Origin/Referer) may read or write the DB.
  const sameOrigin = req => {
    const src = req.headers.origin || req.headers.referer;
    if (!src) return true;
    try { return new URL(src).host === req.headers.host; } catch { return false; }
  };
  const forbid = res => {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
  };
  const attach = mws => {
    mws.use('/api/db/events', (req, res) => {
      if (!sameOrigin(req)) { forbid(res); return; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('data: hello\n\n');
      clients.add(res);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
    });
    mws.use('/api/db', (req, res) => {
      if (!sameOrigin(req)) { forbid(res); return; }
      if (req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ db: readServerDb() }));
        return;
      }
      if (req.method === 'PUT') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          if (body.length > 80 * 1024 * 1024) req.destroy();
        });
        req.on('end', () => {
          let ok = false;
          try {
            const parsed = JSON.parse(body);
            if (parsed && parsed.db && Array.isArray(parsed.db.users)) { writeServerDb(parsed.db); ok = true; }
          } catch { /* bad body */ }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok }));
          if (ok) broadcast();
        });
        return;
      }
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
      res.statusCode = 405;
      res.end();
    });
    // Real AI proxy: browser -> same-origin /api/ai -> text.pollinations.ai (keyless, 100% free)
    // -> optional Groq free-tier key in .env as backup -> client falls back to local tutor.
    // The key and the third-party calls never touch the browser.
    mws.use('/api/ai', (req, res) => {
      if (!sameOrigin(req)) { forbid(res); return; }
      if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 60 * 1024) req.destroy(); });
      req.on('end', async () => {
        let sent = false;
        const reply = (code, obj, provider, why) => {
          if (sent) return;
          sent = true;
          try {
            if (provider) res.setHeader('x-ai-provider', provider);
            if (why) res.setHeader('x-ai-fallback', why);
          } catch { /* headers already sent */ }
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
        let messages = null;
        try {
          const parsed = JSON.parse(body);
          const msgs = parsed && parsed.messages;
          if (Array.isArray(msgs) && msgs.length && msgs.length <= 10) {
            const ok = msgs.every(m => m && (m.role === 'system' || m.role === 'user' || m.role === 'assistant')
              && typeof m.content === 'string' && m.content.length <= 8000);
            if (ok) messages = msgs.map(m => ({ role: m.role, content: m.content }));
          }
        } catch { /* bad body */ }
        if (!messages) { reply(400, { error: 'bad_request' }); return; }
        let pWhy = '';
        const p = await callPollinations(messages);
        if (p.ok) { reply(200, { text: p.text, provider: 'pollinations' }, 'pollinations'); return; }
        pWhy = p.why;
        if (GROQ_API_KEY) {
          const g = await callGroq(messages);
          if (g.ok) { reply(200, { text: g.text, provider: 'groq' }, 'groq', pWhy); return; }
          reply(p.status === 429 ? 429 : p.status, { error: g.why }, 'groq', pWhy);
          return;
        }
        reply(p.status === 429 ? 429 : p.status, { error: p.why }, 'pollinations');
      });
    });
  };
  return {
    name: 'ssa-sync-api',
    configureServer(srv) { attach(srv.middlewares); },
    configurePreviewServer(srv) { attach(srv.middlewares); }
  };
}

export default defineConfig({
  plugins: [
    react(),
    ssaSyncApi(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.(?:mp4|webm)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'video-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(?:jpg|jpeg|png|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'image-cache', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          }
        ]
      },
      manifest: {
        id: '/',
        name: 'SSA Learning Hub',
        short_name: 'SSA Hub',
        description: 'Grade 1-12 learning platform with AI tutor - online & offline',
        theme_color: '#1a56db',
        background_color: '#ffffff',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'en',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
        ]
      }
    })
  ],
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true }
});
