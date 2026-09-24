import http from 'http';
import { env } from './config/env.js';
import { supabase, supabaseAdmin } from './lib/supabase.js';

export * from './config/env.js';
export * from './lib/supabase.js';
export * from './types/database.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'lunalearn-backend',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (url.pathname === '/api/status') {
    const isConfigured = !env.SUPABASE_URL.includes('your-project-ref') && !env.SUPABASE_URL.includes('placeholder');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      environment: env.NODE_ENV,
      supabase: {
        configured: isConfigured,
        url: env.SUPABASE_URL
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found', routes: ['/health', '/api/status'] }));
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🌙 LunaLearn Backend running on http://localhost:${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/health`);
  console.log(`   API Status:   http://localhost:${PORT}/api/status`);
  console.log(`   Environment:  ${env.NODE_ENV}`);
  console.log(`   Supabase URL: ${env.SUPABASE_URL}`);
  console.log('====================================================');
});
