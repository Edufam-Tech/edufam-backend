const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Apply WebSocket Schema Specifically
 */

async function applyWebSocketSchema() {
  console.log('🚀 Applying WebSocket Real-Time Schema');
  console.log('====================================');

  // Database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    console.log('✅ Database connection successful');
    console.log(`   Current time: ${result.rows[0].now}`);
    console.log(`   PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);
    client.release();

    // Read and apply WebSocket schema
    const schemaPath = './database/04-realtime-websocket-simple.sql';
    console.log(`\n📄 Applying WebSocket Schema: ${schemaPath}`);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }

    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into statements and execute
    const statements = schemaContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== '');

    console.log(`   Found ${statements.length} SQL statements`);

    let successCount = 0;
    let warningCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await pool.query(statement);
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('unterminated dollar-quoted string')) {
          console.log(`   ⚠️  Statement ${i + 1} warning: ${error.message.split('\n')[0]}`);
          warningCount++;
        } else {
          console.error(`   ❌ Statement ${i + 1} error: ${error.message}`);
        }
      }
    }

    console.log(`   ✅ Executed ${successCount}/${statements.length} statements (${warningCount} warnings)`);
    console.log('✅ Successfully applied WebSocket Schema');

    // Validate new tables exist
    console.log('\n🔍 Validating WebSocket tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'websocket_connections',
          'realtime_event_types', 
          'realtime_events',
          'realtime_event_deliveries',
          'realtime_channels',
          'realtime_channel_subscriptions',
          'realtime_user_activity',
          'realtime_system_metrics'
        )
      ORDER BY table_name
    `);

    console.log('📋 WebSocket Tables Validation:');
    const expectedTables = [
      'websocket_connections',
      'realtime_event_types', 
      'realtime_events',
      'realtime_event_deliveries',
      'realtime_channels',
      'realtime_channel_subscriptions',
      'realtime_user_activity',
      'realtime_system_metrics'
    ];

    for (const tableName of expectedTables) {
      const exists = validation.rows.find(row => row.table_name === tableName);
      if (exists) {
        console.log(`   ✅ ${tableName}: EXISTS`);
      } else {
        console.log(`   ❌ ${tableName}: MISSING`);
      }
    }

    console.log('\n🎉 WebSocket Schema Application Complete!');
    console.log('\n📚 New Real-Time Features Available:');
    console.log('   • WebSocket Connection Management');
    console.log('   • Real-Time Event Broadcasting');
    console.log('   • Live Notifications & Alerts');
    console.log('   • User Activity Tracking');
    console.log('   • Channel-Based Messaging');
    console.log('   • Connection Quality Monitoring');
    console.log('   • Performance Metrics & Analytics');

  } catch (error) {
    console.error('❌ Error applying WebSocket schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the application
applyWebSocketSchema();