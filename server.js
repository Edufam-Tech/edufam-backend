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
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket service
const websocketManager = require('./src/services/websocketManager');
const io = websocketManager.initialize(server);
console.log('🔌 WebSocket server initialized');

// Apply security middleware in order
app.use(securityHeaders); // Security headers first
app.use(cors(corsOptions)); // CORS configuration
app.use(compression()); // Response compression
app.use(requestLogger); // Request logging
app.use(checkMaintenanceMode); // Maintenance mode check
app.use(detectSuspiciousActivity); // Security monitoring

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

// Mount API routes
app.use('/api', apiRoutes);

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Start server with enhanced logging
const startServer = async () => {
  try {
    // Test database connection on server start
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but server will start anyway');
      console.warn('🔧 Check your DATABASE_URL to connect to Supabase');
    }

    // Start token cleanup service
    console.log('🧹 Starting token cleanup service...');
    tokenCleanup.start();
    
    server.listen(PORT, () => {
      console.log(`\n🚀 Edufam Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 API info: http://localhost:${PORT}/api`);
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
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; 