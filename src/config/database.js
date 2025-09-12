const { Pool } = require('pg');
require('dotenv').config();

// Database configuration with dual connection pools
const createPoolConfig = (connectionString, poolType = 'session') => {
  return {
    connectionString,
    ssl: process.env.SSL_REJECT_UNAUTHORIZED === 'false' ? false : { rejectUnauthorized: false },
    // Pool configuration driven by environment variables
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    min: parseInt(process.env.DB_POOL_MIN || '1', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '60000', 10),
    acquireTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '60000', 10),

    // Additional network and safety settings
    application_name: `edufam-backend-${poolType}`,
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    statement_timeout: 30000, // 30s statement timeout
    query_timeout: 30000
  };
};

// Validate required environment variables
const validateDatabaseConfig = () => {
  if (!process.env.DATABASE_URL_SESSION) {
    console.error('❌ DATABASE_URL_SESSION is required but not set');
    console.error('🔧 Please set DATABASE_URL_SESSION to your session pooler URL (port 5432)');
    throw new Error('DATABASE_URL_SESSION environment variable is required');
  }
  
  console.log('✅ DATABASE_URL_SESSION is configured');
  
  if (process.env.DATABASE_URL_TRANSACTION) {
    console.log('✅ DATABASE_URL_TRANSACTION is configured (transaction pooler)');
  } else {
    console.log('ℹ️  DATABASE_URL_TRANSACTION not set, using session pooler for all queries');
  }
};

// Initialize pools
let sessionPool, transactionPool;

try {
  validateDatabaseConfig();
  
  // Create session pool (primary, port 5432)
  sessionPool = new Pool(createPoolConfig(process.env.DATABASE_URL_SESSION, 'session'));
  
  // Create transaction pool (optional, port 6453)
  if (process.env.DATABASE_URL_TRANSACTION) {
    transactionPool = new Pool(createPoolConfig(process.env.DATABASE_URL_TRANSACTION, 'transaction'));
  }
  
  console.log('🔌 Database pools initialized');
  console.log(`📊 Pool settings: max=${process.env.DB_POOL_MAX || '10'}, min=${process.env.DB_POOL_MIN || '1'}`);
  console.log(`⏱️  Timeouts: idle=${process.env.DB_IDLE_TIMEOUT_MS || '30000'}ms, conn=${process.env.DB_CONN_TIMEOUT_MS || '60000'}ms`);
} catch (error) {
  console.error('❌ Failed to initialize database pools:', error.message);
  throw error;
}

// Enhanced connection test with better error handling
const testConnection = async () => {
  let client;
  try {
    console.log('🔄 Testing database connection via session pooler...');
    console.log(`🔗 Using: ${process.env.DATABASE_URL_SESSION ? 'DATABASE_URL_SESSION is set' : 'DATABASE_URL_SESSION is missing'}`);
    
    client = await sessionPool.connect();
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

// Connection retry helper with exponential backoff
const connectWithRetry = async (retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await sessionPool.connect();
      client.release();
      console.log(`✅ Database connection successful on attempt ${attempt}`);
      return true;
    } catch (error) {
      console.log(`❌ Connection attempt ${attempt} failed:`, error.message);
      if (attempt === retries) {
        console.error('💥 All connection attempts failed');
        throw error;
      }
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
};

// Pool error handlers
const setupPoolErrorHandlers = () => {
  sessionPool.on('error', (err, client) => {
    console.error('❌ Session pool error:', err.message);
    console.error('🔧 Pool error details:', {
      code: err.code,
      severity: err.severity,
      detail: err.detail
    });
  });

  if (transactionPool) {
    transactionPool.on('error', (err, client) => {
      console.error('❌ Transaction pool error:', err.message);
      console.error('🔧 Pool error details:', {
        code: err.code,
        severity: err.severity,
        detail: err.detail
      });
    });
  }
};

// Setup error handlers
setupPoolErrorHandlers();

// Helper functions
const getClient = async (poolType = 'session') => {
  try {
    const pool = poolType === 'transaction' && transactionPool ? transactionPool : sessionPool;
    const client = await pool.connect();
    return client;
  } catch (error) {
    console.error(`❌ Failed to get ${poolType} database client:`, error.message);
    throw error;
  }
};

// Primary query function (uses session pool)
const query = async (text, params) => {
  const client = await getClient('session');
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

// Read-only query function (uses transaction pool if available, else session pool)
const queryReadOnly = async (text, params) => {
  const client = await getClient('transaction');
  try {
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    console.error('❌ Database read-only query error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Get pool statistics
const getPoolStats = () => {
  const sessionStats = {
    totalCount: sessionPool.totalCount,
    idleCount: sessionPool.idleCount,
    waitingCount: sessionPool.waitingCount
  };

  const transactionStats = transactionPool ? {
    totalCount: transactionPool.totalCount,
    idleCount: transactionPool.idleCount,
    waitingCount: transactionPool.waitingCount
  } : null;

  return {
    session: sessionStats,
    transaction: transactionStats
  };
};

// Close all pools
const closePool = async () => {
  try {
    await sessionPool.end();
    console.log('🔒 Session pool closed');
    
    if (transactionPool) {
      await transactionPool.end();
      console.log('🔒 Transaction pool closed');
    }
  } catch (error) {
    console.error('❌ Error closing database pools:', error.message);
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
  // Pools
  sessionPool,
  transactionPool,
  
  // Connection functions
  testConnection,
  connectWithRetry,
  getClient,
  query,
  queryReadOnly,
  
  // Monitoring
  getPoolStats,
  
  // Cleanup
  closePool
};