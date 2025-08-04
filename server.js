const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { testConnection } = require('./src/config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced health check route with database status
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    res.json({ 
      status: 'OK', 
      message: 'Edufam Backend Server is running',
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
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

// Basic API info route
app.get('/api', (req, res) => {
  res.json({
    name: 'Edufam Backend API',
    version: '1.0.0',
    description: 'Education Management Platform Backend',
    endpoints: {
      health: '/health',
      api_info: '/api'
    }
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection on server start
    console.log('🔌 Testing database connection...');
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but server will start anyway');
      console.warn('🔧 Update your .env DATABASE_URL to connect to Supabase');
    }
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Edufam Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 API info: http://localhost:${PORT}/api`);
      console.log(`🗄️ Database: ${dbConnected ? '✅ Connected' : '❌ Not Connected'}\n`);
    });
  } catch (error) {
    console.error('💥 Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; 