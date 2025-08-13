const { Pool } = require('pg');
require('dotenv').config();

// Updated database configuration with longer timeouts and safer defaults
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Optimized for Render/free-tier style environments
  max: parseInt(process.env.DB_POOL_MAX || '3', 10),
  min: parseInt(process.env.DB_POOL_MIN || '1', 10),
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 60000, // 60 seconds
  acquireTimeoutMillis: 60000, // 60 seconds

  // Additional network and safety settings
  application_name: 'edufam-backend',
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000,
  statement_timeout: 30000, // 30s statement timeout
  query_timeout: 30000
};

// Create connection pool
const pool = new Pool(dbConfig);

// Enhanced connection test with better error handling
const testConnection = async () => {
  let client;
  try {
    console.log('🔄 Attempting database connection...');
    console.log(`🔗 Using: ${process.env.DATABASE_URL ? 'DATABASE_URL is set' : 'DATABASE_URL is missing'}`);
    
    client = await pool.connect();
    console.log('🔌 Connection established, testing query...');
    
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connected successfully via Session Pooler');
    console.log(`🕐 Current time: ${result.rows[0].current_time}`);
    console.log(`🗄️ PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔧 Error details:', error.code || 'No error code');
    
    // Specific error handling
    if (error.message.includes('timeout')) {
      console.error('⏰ Connection timeout - this could be:');
      console.error('   1. Network/firewall blocking connection');
      console.error('   2. Supabase project paused/inactive');
      console.error('   3. Wrong connection URL');
      console.error('   4. DNS resolution issues');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🌐 DNS resolution failed - check your internet connection');
    } else if (error.message.includes('authentication failed')) {
      console.error('🔐 Authentication failed - check your password');
    }
    
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Connection retry helper (for cold starts / intermittent failures)
const connectWithRetry = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      client.release();
      return true;
    } catch (error) {
      console.log(`Connection attempt ${attempt} failed:`, error.message);
      if (attempt === retries) throw error;
      // Exponential backoff: 1s, 2s, 3s ...
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  return false;
};

// Rest of your code stays the same...
const getClient = async () => {
  try {
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error('❌ Failed to get database client:', error.message);
    throw error;
  }
};

const query = async (text, params) => {
  const client = await getClient();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

const closePool = async () => {
  try {
    await pool.end();
    console.log('🔒 Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error.message);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, closing database connections...');
  await closePool();
  process.exit(0);
});

module.exports = {
  pool,
  testConnection,
  connectWithRetry,
  getClient,
  query,
  closePool
};