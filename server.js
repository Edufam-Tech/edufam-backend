const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { createServer } = require('http');
const { testConnection } = require('./src/config/database');
const tokenCleanup = require('./src/utils/tokenCleanup');

// Import security middleware
const { 
  securityHeaders, 
  corsOptions, 
  rateLimits, 
  sanitizeInput, 
  requestLogger, 
  checkMaintenanceMode, 
  detectSuspiciousActivity 
} = require('./src/middleware/security');

const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import routes
const apiRoutes = require('./src/routes');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// WebSocket manager (initialized per server instance)
const websocketManager = require('./src/services/websocketManager');

// Apply security middleware in order
app.use(securityHeaders); // Security headers first

// Centralized CORS configuration - Apply BEFORE other middleware
app.use(cors(corsOptions));

app.use(compression()); // Response compression
app.use(requestLogger); // Request logging
app.use(checkMaintenanceMode); // Maintenance mode check
app.use(detectSuspiciousActivity); // Security monitoring

// Add debug logging for CORS issues
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  console.log('User-Agent:', req.headers['user-agent']);
  
  // Handle OPTIONS requests globally as backup
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request for:', req.url);
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
    return res.status(200).end();
  }
  
  next();
});

// Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// General rate limiting
app.use(rateLimits.general);

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Enhanced health check route with security status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    res.json({ 
      status: 'OK', 
      message: 'Edufam Backend Server is running',
      database: dbConnected ? 'Connected' : 'Disconnected',
      security: {
        maintenance: process.env.MAINTENANCE_MODE === 'true',
        rateLimit: 'Active',
        cors: 'Configured',
        headers: 'Secured',
        tokenCleanup: tokenCleanup.isRunning ? 'Active' : 'Inactive'
      },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Server running but database connection failed',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Graceful handler for accidental POSTs to root
// Some clients may inadvertently POST to "/" (e.g., misconfigured forms or proxies)
// Respond with guidance instead of a 404 to reduce noise during auth flows
app.post('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Edufam server root. Use /api or /api/v1 for API endpoints.',
    hint: 'Login endpoint: POST /api/auth/login or /api/v1/auth/login'
  });
});

// Also respond to GET / to avoid noisy 404s from health/test probes
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Edufam server root. API at /api and /api/v1.',
    health: '/health',
    api: ['/api', '/api/v1']
  });
});

// Handle OPTIONS requests for all API routes
app.options('*', (req, res) => {
  console.log('Global OPTIONS handler for:', req.url);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
  res.status(200).end();
});

// Mount API routes
app.use('/api', apiRoutes);
// Versioned alias to match /api/v1/* paths used by frontend and docs
app.use('/api/v1', apiRoutes);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server with enhanced logging and auto port retry if in use
const startServer = async () => {
  try {
    // Test database connection on server start
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but server will start anyway');
      console.warn('🔧 Check your DATABASE_URL to connect to Supabase');
    }

    // Start token cleanup service (run once)
    console.log('🧹 Starting token cleanup service...');
    tokenCleanup.start();

    // Helper to create and start HTTP server with WS, retrying on port conflicts
    const startOnPort = (port, retriesLeft = 5) => {
      const server = createServer(app);
      websocketManager.initialize(server);
      console.log('🔌 WebSocket server initialized');

      const onError = (error) => {
        if (error && error.code === 'EADDRINUSE' && retriesLeft > 0) {
          console.error(`❌ Port ${port} in use. Retrying on ${port + 1}...`);
          // Small delay to avoid race with previous process
          setTimeout(() => startOnPort(port + 1, retriesLeft - 1), 500);
        } else {
          console.error('💥 Failed to start server:', error ? error.message : 'Unknown error');
          process.exit(1);
        }
      };

      server.once('error', onError);

      server.listen(port, () => {
        server.removeListener('error', onError);
        console.log(`\n🚀 Edufam Backend Server running on port ${port}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔗 Health check: http://localhost:${port}/health`);
        console.log(`📡 API info: http://localhost:${port}/api`);
        console.log(`🗄️ Database: ${dbConnected ? '✅ Connected' : '❌ Not Connected'}`);
        console.log(`🔒 Security: ✅ Active (CORS, Rate Limiting, Input Sanitization)`);
        console.log(`🛡️ Maintenance Mode: ${process.env.MAINTENANCE_MODE === 'true' ? '🟡 Enabled' : '✅ Disabled'}`);
        console.log(`🧹 Token Cleanup: ✅ Active`);
        console.log('');
        console.log('📋 Available API Endpoints:');
        console.log('   🔐 POST /api/auth/login - User login');
        console.log('   🔄 POST /api/auth/refresh-token - Refresh access token');
        console.log('   🚪 POST /api/auth/logout - User logout');
        console.log('   🔐 POST /api/auth/forgot-password - Request password reset');
        console.log('   🔑 POST /api/auth/reset-password - Reset password with token');
        console.log('   👤 GET /api/auth/me - Get current user info');
        console.log('   📊 GET /api/auth/stats - Authentication statistics (admin)');
        console.log('   👥 GET /api/users - Get all users (admin)');
        console.log('   👤 GET /api/users/profile - Get current user profile');
        console.log('   📝 PUT /api/users/profile - Update user profile');
        console.log('   🔑 PUT /api/users/change-password - Change password');
        console.log('   📤 POST /api/upload/profile-picture - Upload profile picture');
        console.log('   📄 POST /api/upload/document - Upload document');
        console.log('   📁 GET /api/upload/files - Get user files');
        console.log('');
      });
    };

    startOnPort(PORT, 8);
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; 