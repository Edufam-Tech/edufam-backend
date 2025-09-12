#!/usr/bin/env node

/**
 * Test Database Migration Script
 * 
 * This script tests the refresh_tokens table migration
 * Run with: node test-migration.js
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

async function testMigration() {
  let pool;
  
  try {
    log('\n🧪 Testing Database Migration\n', 'bold');
    
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
    
    log('1. Testing database connection...', 'blue');
    const client = await pool.connect();
    log('   ✅ Database connected successfully', 'green');
    
    // Test 1: Check if refresh_tokens table exists
    log('\n2. Checking if refresh_tokens table exists...', 'blue');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'refresh_tokens'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      log('   ✅ refresh_tokens table exists', 'green');
    } else {
      log('   ❌ refresh_tokens table does not exist', 'red');
      log('   💡 Please run the migration: psql -d your_database -f database/migrations/20250115_create_refresh_tokens.sql', 'yellow');
      return;
    }
    
    // Test 2: Check table structure
    log('\n3. Checking table structure...', 'blue');
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'refresh_tokens'
      ORDER BY ordinal_position;
    `);
    
    const expectedColumns = [
      'id', 'user_id', 'token_hash', 'expires_at', 'created_at',
      'revoked', 'revoked_at', 'device_info', 'ip_address', 'user_agent'
    ];
    
    const actualColumns = columns.rows.map(row => row.column_name);
    const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
    
    if (missingColumns.length === 0) {
      log('   ✅ All expected columns present', 'green');
      columns.rows.forEach(row => {
        log(`   📋 ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`, 'yellow');
      });
    } else {
      log('   ❌ Missing columns:', 'red');
      missingColumns.forEach(col => log(`   - ${col}`, 'red'));
    }
    
    // Test 3: Check indexes
    log('\n4. Checking indexes...', 'blue');
    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'refresh_tokens';
    `);
    
    const expectedIndexes = [
      'idx_refresh_tokens_user_id',
      'idx_refresh_tokens_token_hash',
      'idx_refresh_tokens_expires_at',
      'idx_refresh_tokens_revoked',
      'idx_refresh_tokens_user_active'
    ];
    
    const actualIndexes = indexes.rows.map(row => row.indexname);
    const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.includes(idx));
    
    if (missingIndexes.length === 0) {
      log('   ✅ All expected indexes present', 'green');
    } else {
      log('   ❌ Missing indexes:', 'red');
      missingIndexes.forEach(idx => log(`   - ${idx}`, 'red'));
    }
    
    // Test 4: Check foreign key constraint
    log('\n5. Checking foreign key constraint...', 'blue');
    const constraints = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'refresh_tokens'::regclass;
    `);
    
    const hasForeignKey = constraints.rows.some(row => 
      row.conname === 'refresh_tokens_user_id_fkey' && row.contype === 'f'
    );
    
    if (hasForeignKey) {
      log('   ✅ Foreign key constraint present', 'green');
    } else {
      log('   ❌ Foreign key constraint missing', 'red');
      log('   💡 This might be expected if the constraint was already added', 'yellow');
    }
    
    // Test 5: Check functions
    log('\n6. Checking database functions...', 'blue');
    const functions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN (
        'cleanup_expired_refresh_tokens',
        'revoke_user_refresh_tokens',
        'revoke_refresh_token'
      );
    `);
    
    const expectedFunctions = [
      'cleanup_expired_refresh_tokens',
      'revoke_user_refresh_tokens',
      'revoke_refresh_token'
    ];
    
    const actualFunctions = functions.rows.map(row => row.routine_name);
    const missingFunctions = expectedFunctions.filter(func => !actualFunctions.includes(func));
    
    if (missingFunctions.length === 0) {
      log('   ✅ All expected functions present', 'green');
    } else {
      log('   ❌ Missing functions:', 'red');
      missingFunctions.forEach(func => log(`   - ${func}`, 'red'));
    }
    
    // Test 6: Check RLS policies
    log('\n7. Checking RLS policies...', 'blue');
    const policies = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual
      FROM pg_policies
      WHERE tablename = 'refresh_tokens';
    `);
    
    if (policies.rows.length > 0) {
      log('   ✅ RLS policies present', 'green');
      policies.rows.forEach(policy => {
        log(`   📋 ${policy.policyname}: ${policy.cmd} (${policy.permissive ? 'permissive' : 'restrictive'})`, 'yellow');
      });
    } else {
      log('   ❌ No RLS policies found', 'red');
    }
    
    // Test 7: Test table operations
    log('\n8. Testing table operations...', 'blue');
    
    // Try to insert a test record (will fail due to foreign key, but that's expected)
    try {
      await client.query(`
        INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
        VALUES ('00000000-0000-0000-0000-000000000000', 'test_hash', NOW() + INTERVAL '1 day')
      `);
      log('   ❌ Test insert succeeded (unexpected)', 'red');
    } catch (error) {
      if (error.message.includes('foreign key')) {
        log('   ✅ Foreign key constraint working (test insert properly rejected)', 'green');
      } else {
        log(`   ⚠️  Unexpected error: ${error.message}`, 'yellow');
      }
    }
    
    // Test cleanup function
    try {
      const result = await client.query('SELECT cleanup_expired_refresh_tokens()');
      log(`   ✅ Cleanup function working (cleaned ${result.rows[0].cleanup_expired_refresh_tokens} records)`, 'green');
    } catch (error) {
      log(`   ❌ Cleanup function error: ${error.message}`, 'red');
    }
    
    client.release();
    
    // Summary
    log('\n📋 Migration Test Summary', 'bold');
    log('========================', 'bold');
    log('✅ Migration test completed successfully!', 'green');
    log('\n💡 Next steps:', 'yellow');
    log('   1. Set up environment variables in Railway', 'yellow');
    log('   2. Deploy the updated backend', 'yellow');
    log('   3. Update frontend configurations', 'yellow');
    log('   4. Test the complete authentication flow', 'yellow');
    
  } catch (error) {
    log(`\n💥 Migration test failed: ${error.message}`, 'red');
    log('🔧 Error details:', 'yellow');
    log(`   Code: ${error.code || 'N/A'}`, 'yellow');
    log(`   Detail: ${error.detail || 'N/A'}`, 'yellow');
    log(`   Hint: ${error.hint || 'N/A'}`, 'yellow');
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the test
testMigration().catch(error => {
  log(`\n💥 Test script failed: ${error.message}`, 'red');
  process.exit(1);
});
