const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration - using same config as main application
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pool settings
  max: 5,
  min: 0,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 90000,
  
  // Additional network settings
  application_name: 'edufam-migration',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

const pool = new Pool(dbConfig);

async function migrateTransportReports() {
  let client;
  
  try {
    console.log('🔄 Starting Transport and Reports modules migration...');
    console.log(`🔗 Using: ${process.env.DATABASE_URL ? 'DATABASE_URL is set' : 'DATABASE_URL is missing'}`);
    
    // Test connection first
    console.log('🔌 Testing database connection...');
    client = await pool.connect();
    
    const testResult = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connected successfully');
    console.log(`🕐 Current time: ${testResult.rows[0].current_time}`);
    console.log(`🗄️ PostgreSQL version: ${testResult.rows[0].pg_version.split(' ')[0]} ${testResult.rows[0].pg_version.split(' ')[1]}`);
    
    console.log('\n🚀 Starting migration...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Read and execute transport module schema
    console.log('Adding Transport module tables...');
    const transportSchema = fs.readFileSync(
      path.join(__dirname, 'add-transport-module.sql'), 
      'utf8'
    );
    await client.query(transportSchema);
    
    // Read and execute reports module schema
    console.log('Adding Reports & Analytics module tables...');
    const reportsSchema = fs.readFileSync(
      path.join(__dirname, 'add-reports-analytics-module.sql'), 
      'utf8'
    );
    await client.query(reportsSchema);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Transport and Reports modules migration completed successfully!');
    
    // Display summary
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'vehicles', 'vehicle_maintenance', 'vehicle_insurance', 'drivers', 
        'driver_licenses', 'routes', 'route_stops', 'student_transport', 
        'transport_fees', 'transport_attendance', 'fuel_records', 'transport_incidents',
        'report_templates', 'saved_reports', 'analytics_dashboards', 'dashboard_widgets',
        'data_exports', 'scheduled_reports', 'report_permissions', 'kpi_definitions',
        'kpi_values', 'analytics_cache'
      )
      ORDER BY table_name
    `);
    
    console.log('\n📊 Migration Summary:');
    console.log(`Total tables created: ${tablesResult.rows.length}`);
    console.log('\nTransport Module Tables:');
    const transportTables = [
      'vehicles', 'vehicle_maintenance', 'vehicle_insurance', 'drivers',
      'driver_licenses', 'routes', 'route_stops', 'student_transport',
      'transport_fees', 'transport_attendance', 'fuel_records', 'transport_incidents'
    ];
    transportTables.forEach(table => {
      const exists = tablesResult.rows.find(row => row.table_name === table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });
    
    console.log('\nReports & Analytics Module Tables:');
    const reportsTables = [
      'report_templates', 'saved_reports', 'analytics_dashboards', 'dashboard_widgets',
      'data_exports', 'scheduled_reports', 'report_permissions', 'kpi_definitions',
      'kpi_values', 'analytics_cache'
    ];
    reportsTables.forEach(table => {
      const exists = tablesResult.rows.find(row => row.table_name === table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    });
    
  } catch (error) {
    // Rollback transaction on error if client exists
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('⚠️ Rollback failed:', rollbackError.message);
      }
    }
    
    console.error('❌ Migration failed:', error.message);
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
      console.error('🔐 Authentication failed - check your DATABASE_URL');
    } else if (error.message.includes('does not exist')) {
      console.error('🗄️ Database does not exist - check your DATABASE_URL');
    }
    
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateTransportReports()
    .then(async () => {
      console.log('\n🎉 Migration completed successfully!');
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('\n💥 Migration failed:', error);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { migrateTransportReports }; 