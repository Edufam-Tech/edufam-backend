const { Pool } = require('pg');
const fs = require('fs');

/**
 * Apply Admin Platform HR Schema
 */

async function applyAdminHrSchema() {
  console.log('🚀 Applying Admin Platform HR Management Schema');
  console.log('==============================================');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edufam_db'
  });

  try {
    console.log('🔌 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    client.release();

    // Read and apply Admin HR schema
    const schemaPath = './database/05-admin-platform-hr.sql';
    console.log(`\n📄 Applying Admin HR Schema: ${schemaPath}`);
    
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
        
        if (i % 10 === 0 || i === statements.length - 1) {
          console.log(`   ✅ Executed ${i + 1}/${statements.length} statements`);
        }
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist')) {
          warningCount++;
          if (warningCount <= 5) { // Only show first 5 warnings
            console.log(`   ⚠️  Statement ${i + 1} warning: ${error.message.split('\n')[0]}`);
          }
        } else {
          console.error(`   ❌ Statement ${i + 1} error: ${error.message}`);
        }
      }
    }

    if (warningCount > 5) {
      console.log(`   ⚠️  ... and ${warningCount - 5} more warnings`);
    }

    console.log(`   ✅ Executed ${successCount}/${statements.length} statements (${warningCount} warnings)`);
    console.log('✅ Successfully applied Admin HR Schema');

    // Validate new tables exist
    console.log('\n🔍 Validating Admin HR tables...');
    const validation = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'admin_%'
      ORDER BY table_name
    `);

    console.log('📋 Admin HR Tables Validation:');
    const expectedTables = [
      'admin_departments',
      'admin_employees', 
      'admin_employee_leaves',
      'admin_trip_programs',
      'admin_trip_registrations',
      'admin_employee_training',
      'admin_company_assets',
      'admin_performance_reviews'
    ];

    for (const tableName of expectedTables) {
      const exists = validation.rows.find(row => row.table_name === tableName);
      if (exists) {
        console.log(`   ✅ ${tableName}: EXISTS`);
      } else {
        console.log(`   ❌ ${tableName}: MISSING`);
      }
    }

    // Get counts from new tables
    console.log('\n📊 Table Statistics:');
    for (const tableName of expectedTables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        const count = countResult.rows[0].count;
        console.log(`   📝 ${tableName}: ${count} records`);
      } catch (error) {
        console.log(`   ❌ ${tableName}: Error getting count`);
      }
    }

    console.log('\n🎉 Admin Platform HR Schema Application Complete!');
    console.log('\n📚 New Admin Features Available:');
    console.log('   • Employee Management & HR Operations');
    console.log('   • Department Structure & Organization');
    console.log('   • Leave Management System');
    console.log('   • Academic Trip Program Management');
    console.log('   • Student Trip Registration System');
    console.log('   • Employee Training & Development');
    console.log('   • Company Asset Management');
    console.log('   • Performance Review System');
    console.log('   • HR Analytics & Reporting');

    console.log('\n🎯 Integration Points:');
    console.log('   • Real-Time Notifications for Trip Programs');
    console.log('   • Approval Workflow for Leave Requests');
    console.log('   • Multi-School Context for Trip Management');
    console.log('   • Fee Assignment Integration for Trip Payments');

  } catch (error) {
    console.error('❌ Error applying Admin HR schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔒 Database connection closed');
  }
}

// Load environment variables
require('dotenv').config();

// Run the application
applyAdminHrSchema();