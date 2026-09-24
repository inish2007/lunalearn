import http from 'http';
import { env } from './config/env.js';
import { handleAuthRoutes } from './routes/auth.routes.js';

export * from './config/env.js';
export * from './lib/supabase.js';
export * from './lib/scoped-client.js';
export * from './types/database.js';
export * from './types/auth.js';
export * from './services/auth.service.js';
export * from './middleware/auth.middleware.js';

const PORT = parseInt(env.PORT, 10);

export const server = http.createServer(async (req, res) => {
  // Global CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // Base Health Check
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'lunalearn-backend',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // System & Supabase Status
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
      endpoints: [
        'GET  /health',
        'GET  /api/status',
        'POST /api/auth/signup',
        'POST /api/auth/login',
        'POST /api/auth/logout (protected)',
        'GET  /api/auth/me (protected)'
      ],
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Auth Routes Dispatcher
  const handled = await handleAuthRoutes(req, res);
  if (handled) return;

  // 404 Route Not Found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Not found',
    routes: [
      '/health',
      '/api/status',
      '/api/auth/signup',
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/me'
    ]
  }));
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n⚠️  Port ${PORT} is currently in use. Another backend server instance may already be running.`);
    console.warn(`   You can kill the existing process or run on another port by setting PORT=4001\n`);
  } else {
    console.error('Server error:', err);
  }
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log('====================================================');
    console.log(`🌙 LunaLearn Backend running on http://localhost:${PORT}`);
    console.log(`   Health Check:     http://localhost:${PORT}/health`);
    console.log(`   API Status:       http://localhost:${PORT}/api/status`);
    console.log(`   Sign Up:          POST http://localhost:${PORT}/api/auth/signup`);
    console.log(`   Sign In:          POST http://localhost:${PORT}/api/auth/login`);
    console.log(`   Current Student:  GET  http://localhost:${PORT}/api/auth/me`);
    console.log(`   Sign Out:         POST http://localhost:${PORT}/api/auth/logout`);
    console.log('====================================================');
  });
}
