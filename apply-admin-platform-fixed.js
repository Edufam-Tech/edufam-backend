const { query, pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function applyAdminPlatformFixed() {
  console.log('🚀 Starting Fixed Admin Platform Migration...\n');

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'database', 'add-admin-platform-modules.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Split into lines and process
    const lines = sqlContent.split('\n');
    
    // Extract CREATE TABLE statements
    const tableStatements = [];
    const indexStatements = [];
    let currentStatement = '';
    let inTableStatement = false;
    let inIndexStatement = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('--') || trimmedLine.length === 0) {
        continue;
      }

      // Detect start of CREATE TABLE
      if (trimmedLine.toUpperCase().startsWith('CREATE TABLE')) {
        inTableStatement = true;
        currentStatement = line;
        continue;
      }

      // Detect start of CREATE INDEX
      if (trimmedLine.toUpperCase().startsWith('CREATE INDEX')) {
        inIndexStatement = true;
        currentStatement = line;
        continue;
      }

      // Continue building current statement
      if (inTableStatement || inIndexStatement) {
        currentStatement += '\n' + line;
      }

      // Detect end of statement (semicolon)
      if (trimmedLine.endsWith(';')) {
        if (inTableStatement) {
          tableStatements.push(currentStatement);
          inTableStatement = false;
        } else if (inIndexStatement) {
          indexStatements.push(currentStatement);
          inIndexStatement = false;
        }
        currentStatement = '';
      }
    }

    console.log(`📋 Found ${tableStatements.length} table statements and ${indexStatements.length} index statements`);

    // Execute table creation first
    console.log('\n🔨 Creating tables...');
    let tableSuccessCount = 0;
    for (let i = 0; i < tableStatements.length; i++) {
      const statement = tableStatements[i];
      try {
        const tableName = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i)?.[1] || 'unknown';
        console.log(`  ${i + 1}. Creating table: ${tableName}`);
        await query(statement);
        console.log(`    ✅ Success`);
        tableSuccessCount++;
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        // Don't stop for table creation errors
      }
    }

    // Execute index creation
    console.log('\n📊 Creating indexes...');
    let indexSuccessCount = 0;
    for (let i = 0; i < indexStatements.length; i++) {
      const statement = indexStatements[i];
      try {
        const indexName = statement.match(/CREATE INDEX (?:IF NOT EXISTS )?(\w+)/i)?.[1] || 'unknown';
        console.log(`  ${i + 1}. Creating index: ${indexName}`);
        await query(statement);
        console.log(`    ✅ Success`);
        indexSuccessCount++;
      } catch (error) {
        console.log(`    ❌ Error: ${error.message}`);
        // Continue with other indexes
      }
    }

    // Create default data
    console.log('\n📝 Creating default platform data...');
    
    // Create default subscription plans
    try {
      await query(`
        INSERT INTO subscription_plans (plan_name, plan_code, description, plan_type, billing_cycle, base_price, price_per_student, max_students, features, module_access, is_default)
        VALUES 
          ('Starter Plan', 'STARTER', 'Perfect for small schools getting started', 'basic', 'monthly', 99.00, 2.00, 200, 
           '["Basic Student Management", "Basic Academic Records", "Parent Portal", "Basic Reports"]',
           '["academic", "student", "parent_portal", "basic_reports"]', true),
          ('Professional Plan', 'PRO', 'Comprehensive solution for growing schools', 'standard', 'monthly', 199.00, 3.50, 500,
           '["Full Student Management", "Academic Records", "Finance Management", "HR Management", "Advanced Reports", "Mobile App"]',
           '["academic", "student", "financial", "hr", "communication", "reports", "mobile"]', false),
          ('Enterprise Plan', 'ENTERPRISE', 'Complete solution for large institutions', 'premium', 'monthly', 499.00, 5.00, 2000,
           '["All Professional Features", "AI Timetabling", "Performance Appraisals", "Trip Management", "Advanced Analytics", "API Access"]',
           '["all_modules", "ai_features", "api_access", "priority_support"]', false)
        ON CONFLICT (plan_code) DO NOTHING;
      `);
      console.log('  ✅ Subscription plans created');
    } catch (error) {
      console.log(`  ❌ Subscription plans error: ${error.message}`);
    }

    // Create default platform regions
    try {
      await query(`
        INSERT INTO platform_regions (region_name, region_code, country, timezone, currency)
        VALUES 
          ('Kenya - Central', 'KE-CENTRAL', 'Kenya', 'Africa/Nairobi', 'KES'),
          ('Kenya - Coast', 'KE-COAST', 'Kenya', 'Africa/Nairobi', 'KES'),
          ('Kenya - Western', 'KE-WESTERN', 'Kenya', 'Africa/Nairobi', 'KES'),
          ('Uganda - Central', 'UG-CENTRAL', 'Uganda', 'Africa/Kampala', 'UGX'),
          ('Tanzania - Northern', 'TZ-NORTH', 'Tanzania', 'Africa/Dar_es_Salaam', 'TZS')
        ON CONFLICT (region_code) DO NOTHING;
      `);
      console.log('  ✅ Platform regions created');
    } catch (error) {
      console.log(`  ❌ Platform regions error: ${error.message}`);
    }

    // Create default feature flags
    try {
      await query(`
        INSERT INTO feature_flags (flag_name, description, flag_type, default_value, is_active)
        VALUES 
          ('ai_timetabling', 'Enable AI-powered timetable generation', 'boolean', 'false', true),
          ('mobile_app_access', 'Enable mobile application access', 'boolean', 'true', true),
          ('advanced_analytics', 'Enable advanced analytics and reporting', 'boolean', 'false', true),
          ('bulk_operations', 'Enable bulk data operations', 'boolean', 'true', true),
          ('third_party_integrations', 'Enable third-party service integrations', 'boolean', 'false', true)
        ON CONFLICT (flag_name) DO NOTHING;
      `);
      console.log('  ✅ Feature flags created');
    } catch (error) {
      console.log(`  ❌ Feature flags error: ${error.message}`);
    }

    // Verify table creation
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE ANY(ARRAY['platform_%', 'school_onboarding%', 'subscription_%', 'admin_%', 'feature_%', 'regional_%', 'system_%', 'performance_%', 'alert_%', 'migration_%', 'external_%', 'integration_%', 'compliance_%', 'audit_%'])
      ORDER BY table_name
    `);

    console.log('\n🎉 Admin Platform Migration Completed!');
    console.log('📋 Summary:');
    console.log(`   • ${tableSuccessCount}/${tableStatements.length} tables created successfully`);
    console.log(`   • ${indexSuccessCount}/${indexStatements.length} indexes created successfully`);
    console.log(`   • ${result.rows.length} admin platform tables available`);

    console.log('\nAdmin Platform Tables:');
    result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (pool) {
      await pool.end();
      console.log('\n🔒 Database connection closed.');
    }
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connections...');
  if (pool) {
    await pool.end();
    console.log('🔒 Database connection pool closed');
  }
  process.exit(0);
});

applyAdminPlatformFixed();