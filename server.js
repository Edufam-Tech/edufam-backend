const express = require('express');
const cors = require('cors');
const compression = require('compression');
const session = require('express-session');
const { createServer } = require('http');
const { testConnection, getPoolStats, closePool } = require('./src/config/database');
const tokenCleanup = require('./src/utils/tokenCleanup');
const { checkMaintenanceMode } = require('./src/utils/maintenance');

// Import security middleware
const { 
  securityHeaders, 
  corsOptions, 
  rateLimits, 
  sanitizeInput, 
  requestLogger, 
  detectSuspiciousActivity 
} = require('./src/middleware/security');

const httpsEnforcement = require('./src/middleware/httpsEnforcement');

const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

// Import routes
const apiRoutes = require('./src/routes');

require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Trust proxy for Railway deployment (behind reverse proxy)
app.set('trust proxy', 1);

// WebSocket manager (initialized per server instance)
const websocketManager = require('./src/services/websocketManager');

// Apply security middleware in order
app.use(httpsEnforcement); // HTTPS enforcement first
app.use(securityHeaders); // Security headers second

// Centralized CORS configuration - Apply BEFORE other middleware
app.use(cors(corsOptions));

// Session configuration - only mount if USE_COOKIE_SESSIONS is true
const useCookieSessions = process.env.USE_COOKIE_SESSIONS === 'true';

if (useCookieSessions) {
  console.log('🍪 Cookie-based sessions enabled');
  app.use(session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Required for cross-origin requests in production
    },
    name: 'edufam.sid', // Custom session name
    rolling: true, // Reset expiration on activity
    proxy: true // Trust proxy for secure cookies
  }));
} else {
  console.log('🔑 JWT-based authentication enabled (stateless)');
}

app.use(compression()); // Response compression
app.use(requestLogger); // Request logging
app.use(detectSuspiciousActivity); // Security monitoring

// Enhanced debug logging for CORS and request tracking
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.headers.origin || 'No Origin';
  const userAgent = req.headers['user-agent'] || 'No User-Agent';
  const referer = req.headers.referer || 'No Referer';
  
  console.log(`\n📥 ${timestamp} - ${req.method} ${req.url}`);
  console.log(`🌐 Origin: ${origin}`);
  console.log(`🔗 Referer: ${referer}`);
  console.log(`🖥️ User-Agent: ${userAgent}`);
  console.log(`🔑 Auth Header: ${req.headers.authorization ? 'Present' : 'Missing'}`);
  console.log(`🍪 Cookies: ${req.headers.cookie ? 'Present' : 'Missing'}`);
  
  // Handle OPTIONS requests globally as backup
  if (req.method === 'OPTIONS') {
    console.log('🔄 Handling OPTIONS preflight request for:', req.url);
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-Access-Token');
    console.log('✅ OPTIONS response sent');
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
// Serve generated backups (read-only)
app.use('/backups', express.static('backups'));


// Enhanced health check route with security status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const maintenance = await checkMaintenanceMode();
    
    // Always return HTTP 200 with proper structure
    res.json({ 
      status: maintenance.active ? 'MAINTENANCE' : 'OK', 
      message: maintenance.active 
        ? (maintenance.message || 'System is currently under maintenance')
        : 'Edufam Backend Server is running',
      database: dbConnected ? 'Connected' : 'Disconnected',
      maintenance: maintenance.active ? {
        message: maintenance.message || 'System maintenance in progress',
        scheduled_start: maintenance.scheduled_start || null,
        scheduled_end: maintenance.scheduled_end || null,
        source: maintenance.source || 'unknown'
      } : null,
      security: {
        maintenance: maintenance.active,
        rateLimit: 'Active',
        cors: 'Configured',
        headers: 'Secured',
        tokenCleanup: tokenCleanup?.isRunning ? 'Active' : 'Inactive'
      },
      tokenCleanup: tokenCleanup?.getStatus ? tokenCleanup.getStatus() : { isRunning: false, error: 'Service not available' },
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      // Add CORS headers for health check
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        currentOrigin: req.headers.origin || 'No Origin'
      }
    });
  } catch (error) {
    // Even if everything fails, return 200 with error status
    console.error('💥 Health check failed:', error.message);
    res.json({
      status: 'ERROR',
      message: 'Server running but health check failed',
      database: 'Unknown',
      maintenance: null,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Dedicated maintenance mode check endpoint
app.get('/api/maintenance', async (req, res) => {
  try {
    const maintenance = await checkMaintenanceMode();
    
    res.json({
      status: maintenance.active ? 'MAINTENANCE' : 'OK',
      maintenance: maintenance.active ? {
        message: maintenance.message || 'System maintenance in progress',
        scheduled_start: maintenance.scheduled_start || null,
        scheduled_end: maintenance.scheduled_end || null,
        source: maintenance.source || 'unknown'
      } : null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('💥 Maintenance check failed:', error.message);
    res.json({
      status: 'ERROR',
      message: 'Failed to check maintenance mode',
      maintenance: null,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Additional database connection test endpoint
app.get('/api/health/database', async (req, res) => {
  try {
    const { query } = require('./src/config/database');
    const result = await query('SELECT NOW() as current_time, version() as pg_version, current_database() as database_name');
    
    res.json({
      status: 'OK',
      message: 'Database connection successful',
      database: {
        connected: true,
        current_time: result.rows[0].current_time,
        version: result.rows[0].pg_version,
        name: result.rows[0].database_name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      message: 'Database connection failed',
      database: {
        connected: false,
        error: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Pool statistics endpoint
app.get('/api/health/pool-stats', async (req, res) => {
  try {
    const { getPoolStats } = require('./src/config/database');
    const stats = getPoolStats();
    
    res.json({
      status: 'OK',
      message: 'Pool statistics retrieved successfully',
      pools: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pool stats check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Failed to retrieve pool statistics',
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

// Startup cleanup function to prevent random maintenance mode popups
async function cleanupMaintenanceMode() {
  try {
    const { query } = require('./src/config/database');
    const now = new Date();
    
    console.log('🧹 Cleaning up expired maintenance mode records...');
    
    // Clean up expired maintenance records
    const result = await query(`
      UPDATE maintenance_mode 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE is_active = true 
        AND (
          (scheduled_end IS NOT NULL AND scheduled_end < $1) OR
          (scheduled_start IS NOT NULL AND scheduled_start > $1)
        )
      RETURNING id, message, scheduled_start, scheduled_end
    `, [now]);
    
    if (result.rows.length > 0) {
      console.log(`✅ Cleaned up ${result.rows.length} expired maintenance record(s):`);
      result.rows.forEach(record => {
        console.log(`   - ${record.message || 'Maintenance'} (${record.scheduled_start} - ${record.scheduled_end})`);
      });
    } else {
      console.log('✅ No expired maintenance records found');
    }
    
  } catch (error) {
    console.error('❌ Error during maintenance mode cleanup:', error);
  }
}

// Run cleanup on startup
cleanupMaintenanceMode();

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

    // Get active database connections for monitoring
    console.log('📊 Fetching database connection statistics...');
    const activeConnections = await getActiveConnections();
    const poolStats = getPoolStats();
    
    if (activeConnections) {
      console.log(`📊 Active DB Connections: ${activeConnections.active_connections}/${activeConnections.total_connections} (${activeConnections.idle_connections} idle)`);
    }
    
    if (poolStats) {
      console.log(`📊 Pool Stats: Session(${poolStats.sessionPool?.totalCount || 0} total, ${poolStats.sessionPool?.idleCount || 0} idle)${poolStats.transactionPool ? `, Transaction(${poolStats.transactionPool.totalCount || 0} total, ${poolStats.transactionPool.idleCount || 0} idle)` : ''}`);
    }

    // Start token cleanup service
    console.log('🧹 Starting token cleanup service...');
    if (tokenCleanup && typeof tokenCleanup.start === 'function') {
      tokenCleanup.start();
    } else {
      console.warn('⚠️  Token cleanup service not available');
    }

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
        console.log(`🔗 DB URLs loaded: session${process.env.DATABASE_URL_TRANSACTION ? '/transaction' : ''}`);
        console.log(`🔒 Security: ✅ Active (CORS, Rate Limiting, Input Sanitization)`);
        console.log(`🔑 Auth Mode: ${useCookieSessions ? 'COOKIE' : 'JWT'}`);
        console.log(`🌐 Allowed Origins: ${process.env.ALLOWED_ORIGINS || 'Not configured'}`);
        console.log(`📊 Pool Settings: max=${process.env.DB_POOL_MAX || '10'}, min=${process.env.DB_POOL_MIN || '1'}`);
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

// Enhanced monitoring - get active DB connections
async function getActiveConnections() {
  try {
    const { query } = require('./src/config/database');
    const result = await query(`
      SELECT 
        COUNT(*) as total_connections,
        COUNT(CASE WHEN state = 'active' THEN 1 END) as active_connections,
        COUNT(CASE WHEN state = 'idle' THEN 1 END) as idle_connections,
        COUNT(CASE WHEN state = 'idle in transaction' THEN 1 END) as idle_in_transaction
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    return result.rows[0];
  } catch (error) {
    console.warn('⚠️  Could not fetch active connections:', error.message);
    return null;
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    console.log('📝 Stopping token cleanup service...');
    if (tokenCleanup && typeof tokenCleanup.stop === 'function') {
      tokenCleanup.stop();
    } else {
      console.warn('⚠️  Token cleanup service not available for stopping');
    }
    
    // Close database pools
    console.log('🔌 Closing database connections...');
    await closePool();
    
    // Close WebSocket connections
    console.log('📡 Closing WebSocket connections...');
    websocketManager.closeAllConnections();
    
    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('💥 Error during graceful shutdown:', error.message);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer();

module.exports = app;
