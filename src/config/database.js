const { Pool } = require('pg');
require('dotenv').config();

// Updated database configuration with longer timeouts
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Increased timeouts for network issues
  max: 5, // Reduced max connections
  min: 0, // No minimum connections
  idleTimeoutMillis: 60000, // 60 seconds
  connectionTimeoutMillis: 30000, // 30 seconds (increased)
  acquireTimeoutMillis: 90000, // 90 seconds (increased)
  
  // Additional network settings
  application_name: 'edufam-backend',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
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
  getClient,
  query,
  closePool
};