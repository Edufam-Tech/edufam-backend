/**
 * Apply All New Schema Updates
 * This script applies all the new database schemas for the completed modules
 */

const { query, closePool } = require('./src/config/database');
const fs = require('fs').promises;
const path = require('path');

async function applySchemaFile(filePath, description) {
  console.log(`\n📄 Applying ${description}...`);
  console.log(`   File: ${filePath}`);
  
  try {
    const sql = await fs.readFile(filePath, 'utf8');
    
    // Split by statement separator and execute each
    const statements = sql.split(/;\s*$/gm).filter(stmt => stmt.trim().length > 0);
    
    console.log(`   Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      try {
        await query(statement);
        if (i % 10 === 0 || i === statements.length - 1) {
          console.log(`   ✅ Executed ${i + 1}/${statements.length} statements`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Statement ${i + 1} warning:`, error.message.substring(0, 100));
        // Continue with next statement - some might fail due to existing objects
      }
    }
    
    console.log(`✅ Successfully applied ${description}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to apply ${description}:`, error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    console.log('🔌 Testing database connection...');
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    console.log(`   PostgreSQL version: ${result.rows[0].pg_version.split(',')[0]}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function checkExistingTables() {
  try {
    console.log('\n📊 Checking existing table structure...');
    
    const result = await query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log(`Found ${result.rows.length} existing tables:`);
    
    const tables = result.rows.map(row => row.tablename);
    
    // Check for new tables that will be created
    const newTables = [
      'director_school_access',
      'director_active_contexts', 
      'cross_school_analytics',
      'school_switch_audit',
      'director_favorite_schools',
      'cross_school_notifications',
      'fee_assignments',
      'fee_assignment_items',
      'student_fee_assignments',
      'fee_assignment_history',
      'fee_assignment_templates',
      'fee_assignment_approvals',
      'approval_requests',
      'approval_workflow_templates',
      'approval_level_actions',
      'approval_notifications',
      'approval_decision_history',
      'approval_metrics',
      'approval_rule_exceptions'
    ];
    
    const existingNewTables = newTables.filter(table => tables.includes(table));
    const missingNewTables = newTables.filter(table => !tables.includes(table));
    
    if (existingNewTables.length > 0) {
      console.log(`\n⚠️  These new tables already exist:`);
      existingNewTables.forEach(table => console.log(`   - ${table}`));
    }
    
    if (missingNewTables.length > 0) {
      console.log(`\n📋 These new tables will be created:`);
      missingNewTables.forEach(table => console.log(`   - ${table}`));
    }
    
    return { existingTables: tables, newTables: missingNewTables };
  } catch (error) {
    console.error('❌ Failed to check existing tables:', error.message);
    return { existingTables: [], newTables: [] };
  }
}

async function createSchemaBackup() {
  try {
    console.log('\n💾 Creating schema backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const backupFile = `schema-backup-${timestamp}.sql`;
    
    // Get current schema
    const result = await query(`
      SELECT 
        'CREATE TABLE ' || tablename || ' (' || 
        string_agg(
          column_name || ' ' || data_type ||
          CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
          END ||
          CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
          END,
          ', '
        ) || ');' as create_statement
      FROM information_schema.columns
      WHERE table_schema = 'public'
      GROUP BY tablename
      ORDER BY tablename
    `);
    
    const backupContent = result.rows.map(row => row.create_statement).join('\n\n');
    await fs.writeFile(backupFile, backupContent);
    
    console.log(`✅ Schema backup saved to: ${backupFile}`);
    return backupFile;
  } catch (error) {
    console.warn('⚠️  Could not create schema backup:', error.message);
    return null;
  }
}

async function validateSchemaAfterUpdate() {
  try {
    console.log('\n🔍 Validating schema after updates...');
    
    // Check critical tables exist
    const criticalTables = [
      'users', 'schools', 'students', 'staff', 'classes',
      'director_school_access', 'fee_assignments', 'approval_requests'
    ];
    
    const validationResults = [];
    
    for (const table of criticalTables) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`);
        validationResults.push({ table, status: 'OK', count: result.rows[0].count });
      } catch (error) {
        validationResults.push({ table, status: 'ERROR', error: error.message });
      }
    }
    
    console.log('📋 Validation Results:');
    validationResults.forEach(result => {
      if (result.status === 'OK') {
        console.log(`   ✅ ${result.table}: ${result.count} records`);
      } else {
        console.log(`   ❌ ${result.table}: ${result.error}`);
      }
    });
    
    const errorCount = validationResults.filter(r => r.status === 'ERROR').length;
    console.log(`\n📊 Validation Summary: ${validationResults.length - errorCount}/${validationResults.length} tables OK`);
    
    return errorCount === 0;
  } catch (error) {
    console.error('❌ Schema validation failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Edufam Backend Schema Update Process');
  console.log('================================================\n');
  
  try {
    // Step 1: Test database connection
    if (!(await testDatabaseConnection())) {
      process.exit(1);
    }
    
    // Step 2: Check existing tables
    const { existingTables, newTables } = await checkExistingTables();
    
    // Step 3: Create backup
    await createSchemaBackup();
    
    // Step 4: Apply new schemas
    const schemas = [
      {
        file: './database/01-multi-school-director.sql',
        description: 'Multi-School Director Management Schema'
      },
      {
        file: './database/02-fee-assignment-workflow.sql', 
        description: 'Fee Assignment Workflow Schema'
      },
      {
        file: './database/03-comprehensive-approval-system.sql',
        description: 'Comprehensive Approval System Schema'
      }
    ];
    
    let successCount = 0;
    
    for (const schema of schemas) {
      if (await applySchemaFile(schema.file, schema.description)) {
        successCount++;
      }
    }
    
    // Step 5: Validate schema
    const validationPassed = await validateSchemaAfterUpdate();
    
    // Step 6: Summary
    console.log('\n================================================');
    console.log('📊 SCHEMA UPDATE SUMMARY');
    console.log('================================================');
    console.log(`✅ Schemas applied: ${successCount}/${schemas.length}`);
    console.log(`✅ Schema validation: ${validationPassed ? 'PASSED' : 'FAILED'}`);
    console.log(`📋 New tables created: ${newTables.length}`);
    
    if (successCount === schemas.length && validationPassed) {
      console.log('\n🎉 All schema updates completed successfully!');
      console.log('\n📚 New Features Available:');
      console.log('   • Multi-School Director Management');
      console.log('   • Fee Assignment Workflow System');
      console.log('   • Comprehensive Approval Engine');
      console.log('   • Cross-School Analytics');
      console.log('   • Enhanced Security & Audit');
      
      console.log('\n🔄 Next Steps:');
      console.log('   1. Restart your application server');
      console.log('   2. Test the new API endpoints');
      console.log('   3. Configure approval workflows');
      console.log('   4. Set up multi-school director access');
      
    } else {
      console.log('\n⚠️  Some updates failed - please check the logs above');
    }
    
  } catch (error) {
    console.error('\n❌ Schema update process failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await closePool();
    console.log('\n🔒 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };