// WoWS Ship Picker — local development server
// Usage: node server.js
// Then open: http://localhost:3001
//
// Create local.config.js (gitignored) with your secrets.
// Copy local.config.example.js and fill in your values.

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3001;
const ROOT = __dirname;

let localConfig = {};
try { localConfig = require('./local.config.js'); } catch {}

const WOWS_APP_ID      = localConfig.WOWS_APP_ID      || '';
const GA_MEASUREMENT_ID = localConfig.GA_MEASUREMENT_ID || '';
const WG_BASE_PATH     = (localConfig.WG_BASE_PATH     || '').replace(/\/$/, '');
const WG_CALLBACK_BASE = (localConfig.WG_CALLBACK_BASE || 'http://localhost:3000').replace(/\/$/, '');

const WOWS_REGIONS = {
  eu:   'api.worldofwarships.eu',
  na:   'api.worldofwarships.com',
  asia: 'api.worldofwarships.asia',
  ru:   'api.worldofwarships.ru',
};

function injectSecrets(text) {
  if (WOWS_APP_ID)       text = text.replace(/__WOWS_APP_ID__/g,       WOWS_APP_ID);
  if (GA_MEASUREMENT_ID) text = text.replace(/__GA_MEASUREMENT_ID__/g, GA_MEASUREMENT_ID);
  text = text.replace(/__WG_BASE_PATH__/g, WG_BASE_PATH);
  return text;
}

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  // WG OAuth — login redirect
  if (req.method === 'GET' && urlPath === '/api/wg-auth/login') {
    if (!WOWS_APP_ID) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('WOWS_APP_ID not configured');
      return;
    }
    const query       = new URLSearchParams(req.url.split('?')[1] || '');
    const region      = query.get('region') || 'eu';
    const callbackUrl = `${WG_CALLBACK_BASE}${WG_BASE_PATH}/api/wg-auth/callback`;
    const wgParams    = new URLSearchParams({ application_id: WOWS_APP_ID, redirect_uri: callbackUrl, expires_at: 1209600 });
    const wotBase     = { eu: 'https://api.worldoftanks.eu', na: 'https://api.worldoftanks.com', asia: 'https://api.worldoftanks.asia', ru: 'https://api.worldoftanks.ru' };
    const loginUrl    = `${wotBase[region] || wotBase.eu}/wot/auth/login/?${wgParams}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: loginUrl }));
    return;
  }

  // WG OAuth — callback
  if (req.method === 'GET' && urlPath === '/api/wg-auth/callback') {
    const params = new URLSearchParams(req.url.split('?')[1] || '');
    if (params.get('status') !== 'ok' || !params.get('access_token')) {
      res.writeHead(302, { Location: `${WG_BASE_PATH}/?wg_auth_error=1` });
      res.end();
      return;
    }
    const fwd = new URLSearchParams({
      status:       'ok',
      access_token: params.get('access_token'),
      account_id:   params.get('account_id')  || '',
      nickname:     params.get('nickname')     || '',
      expires_at:   params.get('expires_at')   || '',
    });
    res.writeHead(302, { Location: `${WG_BASE_PATH}/?${fwd}` });
    res.end();
    return;
  }

  // WoWS API proxy — injects application_id server-side
  if (req.method === 'GET' && urlPath.startsWith('/api/wows/')) {
    if (!WOWS_APP_ID) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: { code: 'CONFIG', message: 'WOWS_APP_ID not set in local.config.js' } }));
      return;
    }
    const qParts      = req.url.split('?');
    const query       = new URLSearchParams(qParts[1] || '');
    const region      = query.get('region') || 'eu';
    query.delete('region');
    query.set('application_id', WOWS_APP_ID);
    const wowsEndpoint = urlPath.replace('/api/wows', '/wows');
    const host         = WOWS_REGIONS[region] || WOWS_REGIONS.eu;
    const wowsPath     = wowsEndpoint + '?' + query.toString();
    const proxyReq = https.request({ hostname: host, path: wowsPath, method: 'GET' }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=300' });
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      console.error('WoWS proxy error:', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: { code: 'PROXY_ERROR', message: err.message } }));
    });
    proxyReq.end();
    return;
  }

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(err.code === 'ENOENT' ? 404 : 500);
      res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    const ext         = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    if (ext === '.html' || ext === '.js') {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(injectSecrets(data.toString('utf8')), 'utf8');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}).listen(PORT, '127.0.0.1', () => {
  console.log(`WoWS Ship Picker running at http://localhost:${PORT}/`);
  console.log('Press Ctrl+C to stop.');
});
