const { query, pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function applyAdminPlatformTables() {
  console.log('🚀 Starting Admin Platform Tables Migration...\n');

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'database', 'add-admin-platform-modules.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('📋 Executing Admin Platform Schema...');
    
    // Execute the SQL
    await query(sqlContent);
    
    console.log('✅ Admin Platform tables created successfully!');
    
    // Verify table creation
    const result = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name LIKE ANY(ARRAY['platform_%', 'school_onboarding%', 'subscription_%', 'admin_%', 'feature_%', 'regional_%', 'system_%', 'performance_%', 'alert_%', 'migration_%', 'external_%', 'integration_%', 'compliance_%', 'audit_%'])
      ORDER BY table_name
    `);

    console.log('\n📊 Admin Platform Tables Summary:');
    console.log(`Total tables created: ${result.rows.length}`);
    console.log('\nCreated tables:');
    result.rows.forEach(row => console.log(`  ✓ ${row.table_name}`));

    // Create default data
    console.log('\n📝 Creating default platform data...');
    
    // Create default subscription plans
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

    // Create default platform regions
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

    // Create default feature flags
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

    // Create default platform settings
    await query(`
      INSERT INTO platform_settings (setting_category, setting_key, setting_value, setting_type, description, is_global)
      VALUES 
        ('email', 'smtp_host', 'smtp.edufam.com', 'string', 'SMTP server hostname', true),
        ('email', 'smtp_port', '587', 'number', 'SMTP server port', true),
        ('email', 'from_email', 'noreply@edufam.com', 'string', 'Default from email address', true),
        ('sms', 'provider', 'africastalking', 'string', 'SMS service provider', true),
        ('storage', 'default_provider', 'aws_s3', 'string', 'Default file storage provider', true),
        ('storage', 'max_file_size_mb', '50', 'number', 'Maximum file upload size in MB', true),
        ('security', 'password_min_length', '8', 'number', 'Minimum password length', true),
        ('security', 'session_timeout_minutes', '480', 'number', 'Session timeout in minutes', true),
        ('billing', 'payment_grace_period_days', '7', 'number', 'Grace period for late payments', true),
        ('support', 'max_tickets_per_school', '10', 'number', 'Maximum support tickets per school per month', true)
      ON CONFLICT (setting_category, setting_key, region_id, school_id) DO NOTHING;
    `);

    console.log('✅ Default platform data created successfully!');

    console.log('\n🎉 Admin Platform Migration Completed Successfully!');
    console.log('📋 Summary:');
    console.log(`   • ${result.rows.length} database tables created`);
    console.log('   • Default subscription plans configured');
    console.log('   • Regional structure established');
    console.log('   • Feature flags initialized');
    console.log('   • Platform settings configured');

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

applyAdminPlatformTables();