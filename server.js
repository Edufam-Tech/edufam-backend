const express = require('express');
const cors = require('cors');
const compression = require('compression');
const session = require('express-session');
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

// Session configuration for production deployment
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

app.use(compression()); // Response compression
app.use(requestLogger); // Request logging
app.use(checkMaintenanceMode); // Maintenance mode check
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

// Enhanced health check route with security status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    
    // Check for active maintenance mode with strict time logic
    let maintenanceInfo = null;
    let isMaintenanceActive = false;
    
    try {
      const { query } = require('./src/config/database');
      const now = new Date();
      
      const maintenanceResult = await query(`
        SELECT 
          is_active,
          message,
          scheduled_start,
          scheduled_end
        FROM maintenance_mode 
        WHERE is_active = true
        ORDER BY scheduled_start DESC
      `);
      
      if (maintenanceResult.rows.length > 0) {
        // Check time validity for each maintenance record
        for (const record of maintenanceResult.rows) {
          let shouldBeActive = true;
          
          // Check if maintenance should have started
          if (record.scheduled_start) {
            const startTime = new Date(record.scheduled_start);
            if (now < startTime) {
              shouldBeActive = false;
            }
          }
          
          // Check if maintenance has expired
          if (record.scheduled_end) {
            const endTime = new Date(record.scheduled_end);
            if (now > endTime) {
              shouldBeActive = false;
            }
          }
          
          if (shouldBeActive) {
            maintenanceInfo = record;
            isMaintenanceActive = true;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error checking maintenance mode in health endpoint:', error);
    }
    
    // Always return 200 for health check, but include maintenance status
    res.json({ 
      status: isMaintenanceActive ? 'MAINTENANCE' : 'OK', 
      message: isMaintenanceActive 
        ? (maintenanceInfo?.message || 'System is currently under maintenance')
        : 'Edufam Backend Server is running',
      database: dbConnected ? 'Connected' : 'Disconnected',
      security: {
        maintenance: isMaintenanceActive,
        rateLimit: 'Active',
        cors: 'Configured',
        headers: 'Secured',
        tokenCleanup: tokenCleanup.isRunning ? 'Active' : 'Inactive'
      },
      maintenance: isMaintenanceActive ? {
        message: maintenanceInfo?.message || 'System maintenance in progress',
        estimated_end_time: maintenanceInfo?.scheduled_end || null,
        scheduled_start: maintenanceInfo?.scheduled_start || null
      } : null,
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
    res.status(503).json({
      status: 'ERROR',
      message: 'Server running but database connection failed',
      database: 'Disconnected',
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
