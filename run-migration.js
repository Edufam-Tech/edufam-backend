#!/usr/bin/env node

/**
 * Migration Runner Script
 * 
 * This script runs the refresh_tokens migration with proper error handling
 * Run with: node run-migration.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function runMigration() {
  let pool;
  
  try {
    log('\n🚀 Running Refresh Tokens Migration\n', 'bold');
    
    // Check if DATABASE_URL_SESSION is set
    if (!process.env.DATABASE_URL_SESSION) {
      log('❌ DATABASE_URL_SESSION environment variable is not set', 'red');
      log('💡 Please set DATABASE_URL_SESSION to your session pooler URL', 'yellow');
      return;
    }
    
    // Create connection pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL_SESSION,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    log('1. Connecting to database...', 'blue');
    const client = await pool.connect();
    log('   ✅ Database connected successfully', 'green');
    
    // Check if table already exists
    log('\n2. Checking if refresh_tokens table exists...', 'blue');
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      log('   ⚠️  refresh_tokens table already exists', 'yellow');
      log('   💡 Dropping existing table to ensure clean migration...', 'yellow');
      
      // Drop existing table and related objects
      await client.query('DROP TABLE IF EXISTS refresh_tokens CASCADE;');
      log('   ✅ Existing table dropped', 'green');
    } else {
      log('   ✅ Table does not exist, proceeding with creation', 'green');
    }
    
    // Run the migration
    log('\n3. Running migration...', 'blue');
    
    // Create table
    await client.query(`
      CREATE TABLE refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          revoked BOOLEAN DEFAULT FALSE,
          revoked_at TIMESTAMP WITH TIME ZONE NULL,
          device_info JSONB,
          ip_address INET,
          user_agent TEXT
      );
    `);
    log('   ✅ Table created successfully', 'green');
    
    // Add foreign key constraint
    await client.query(`
      ALTER TABLE refresh_tokens 
      ADD CONSTRAINT refresh_tokens_user_id_fkey 
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    `);
    log('   ✅ Foreign key constraint added', 'green');
    
    // Create indexes
    const indexes = [
      'CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);',
      'CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);',
      'CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);',
      'CREATE INDEX idx_refresh_tokens_revoked ON refresh_tokens(revoked);',
      'CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id, revoked, expires_at);'
    ];
    
    for (const indexSQL of indexes) {
      await client.query(indexSQL);
    }
    log('   ✅ Indexes created successfully', 'green');
    
    // Create functions
    log('\n4. Creating database functions...', 'blue');
    
    // Cleanup function
    await client.query(`
      CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
      RETURNS INTEGER AS $$
      DECLARE
          deleted_count INTEGER;
      BEGIN
          DELETE FROM refresh_tokens 
          WHERE expires_at < NOW() OR revoked = TRUE;
          
          GET DIAGNOSTICS deleted_count = ROW_COUNT;
          RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Revoke user tokens function
    await client.query(`
      CREATE OR REPLACE FUNCTION revoke_user_refresh_tokens(p_user_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
          revoked_count INTEGER;
      BEGIN
          UPDATE refresh_tokens 
          SET revoked = TRUE, revoked_at = NOW()
          WHERE user_id = p_user_id AND revoked = FALSE;
          
          GET DIAGNOSTICS revoked_count = ROW_COUNT;
          RETURN revoked_count;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // Revoke specific token function
    await client.query(`
      CREATE OR REPLACE FUNCTION revoke_refresh_token(p_token_hash VARCHAR(255))
      RETURNS BOOLEAN AS $$
      DECLARE
          token_exists BOOLEAN;
      BEGIN
          UPDATE refresh_tokens 
          SET revoked = TRUE, revoked_at = NOW()
          WHERE token_hash = p_token_hash AND revoked = FALSE;
          
          GET DIAGNOSTICS token_exists = FOUND;
          RETURN token_exists;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    log('   ✅ Functions created successfully', 'green');
    
    // Enable RLS
    log('\n5. Setting up Row Level Security...', 'blue');
    await client.query('ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;');
    
    // Create RLS policies
    await client.query(`
      CREATE POLICY refresh_tokens_user_policy ON refresh_tokens
          FOR ALL
          TO authenticated
          USING (user_id = current_setting('app.current_user_id')::UUID);
    `);
    
    await client.query(`
      CREATE POLICY refresh_tokens_system_policy ON refresh_tokens
          FOR ALL
          TO service_role
          USING (true);
    `);
    
    log('   ✅ RLS policies created successfully', 'green');
    
    // Create view
    log('\n6. Creating monitoring view...', 'blue');
    await client.query(`
      CREATE OR REPLACE VIEW active_refresh_tokens AS
      SELECT 
          rt.id,
          rt.user_id,
          u.email,
          u.role,
          rt.created_at,
          rt.expires_at,
          rt.device_info,
          rt.ip_address,
          rt.user_agent,
          (rt.expires_at - NOW()) AS time_until_expiry
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.revoked = FALSE 
        AND rt.expires_at > NOW()
      ORDER BY rt.created_at DESC;
    `);
    
    log('   ✅ Monitoring view created successfully', 'green');
    
    // Test the migration
    log('\n7. Testing migration...', 'blue');
    
    // Test cleanup function
    const cleanupResult = await client.query('SELECT cleanup_expired_refresh_tokens()');
    log(`   ✅ Cleanup function working (cleaned ${cleanupResult.rows[0].cleanup_expired_refresh_tokens} records)`, 'green');
    
    // Test view
    const viewResult = await client.query('SELECT COUNT(*) FROM active_refresh_tokens');
    log(`   ✅ Monitoring view working (${viewResult.rows[0].count} active tokens)`, 'green');
    
    client.release();
    
    // Success summary
    log('\n🎉 Migration Completed Successfully!', 'bold');
    log('=====================================', 'bold');
    log('✅ refresh_tokens table created', 'green');
    log('✅ Foreign key constraint added', 'green');
    log('✅ Indexes created', 'green');
    log('✅ Database functions created', 'green');
    log('✅ RLS policies enabled', 'green');
    log('✅ Monitoring view created', 'green');
    
    log('\n💡 Next steps:', 'yellow');
    log('   1. Set environment variables in Railway', 'yellow');
    log('   2. Deploy the updated backend', 'yellow');
    log('   3. Test JWT authentication', 'yellow');
    log('   4. Monitor via /api/health/pool-stats', 'yellow');
    
  } catch (error) {
    log(`\n💥 Migration failed: ${error.message}`, 'red');
    log('🔧 Error details:', 'yellow');
    log(`   Code: ${error.code || 'N/A'}`, 'yellow');
    log(`   Detail: ${error.detail || 'N/A'}`, 'yellow');
    log(`   Hint: ${error.hint || 'N/A'}`, 'yellow');
    
    if (error.message.includes('foreign key')) {
      log('\n💡 Foreign key error - make sure the users table exists', 'yellow');
    } else if (error.message.includes('permission')) {
      log('\n💡 Permission error - make sure you have CREATE privileges', 'yellow');
    }
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the migration
runMigration().catch(error => {
  log(`\n💥 Script failed: ${error.message}`, 'red');
  process.exit(1);
});
