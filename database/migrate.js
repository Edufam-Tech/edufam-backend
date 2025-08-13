const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

const runMigration = async () => {
  console.log('🚀 Starting Edufam database migration...\n');
  
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error('Schema file not found at: ' + schemaPath);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema file loaded successfully');
    
    // Execute schema creation only if base tables missing
    const baseTableCheck = await query(`
      SELECT COUNT(*)::int AS count
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schools'
    `);
    if (baseTableCheck.rows[0].count === 0) {
      console.log('⚡ Executing database schema creation...');
      await query(schema);
    } else {
      console.log('ℹ️  Base schema detected, skipping schema.sql');
    }

    // Apply module migrations in a safe order
    const migrationFiles = [
      'add-academic-tables.sql',
      'add-student-tables.sql',
      'add-academic-module.sql',
      'add-hr-module.sql',
      '2025-08-08_performance_appraisals.sql',
      '2025-08-11_performance_appraisals_additions.sql',
      '2025-08-11_examinations.sql',
      '2025-08-11_hr_recruitment.sql'
    ];

    for (const file of migrationFiles) {
      const p = path.join(__dirname, file);
      if (!fs.existsSync(p)) {
        console.log(`ℹ️  Skipping missing migration: ${file}`);
        continue;
      }
      console.log(`⚙️  Applying migration: ${file}`);
      const sql = fs.readFileSync(p, 'utf8');
      try {
        await query(sql);
        console.log(`✅ Applied: ${file}`);
      } catch (err) {
        const msg = String(err && err.message || err);
        if (/already exists|duplicate|exists/.test(msg)) {
          console.log(`ℹ️  Skipping statements that already exist in: ${file}`);
          continue;
        }
        throw err;
      }
    }
    
    // Verify tables were created
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n✅ Database migration completed successfully!');
    console.log('📊 Tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Verify default data
    const adminResult = await query('SELECT email, role FROM users WHERE role = $1', ['super_admin']);
    const plansResult = await query('SELECT COUNT(*) as count FROM subscription_plans');
    const settingsResult = await query('SELECT COUNT(*) as count FROM system_settings');
    
    console.log('\n📋 Default data verification:');
    console.log(`   👤 Super admin users: ${adminResult.rows.length}`);
    console.log(`   💰 Subscription plans: ${plansResult.rows[0].count}`);
    console.log(`   ⚙️  System settings: ${settingsResult.rows[0].count}`);
    
    if (adminResult.rows.length > 0) {
      console.log('\n🔐 Default login credentials:');
      console.log('   📧 Email: admin@edufam.com');
      console.log('   🔑 Password: TempAdmin123!');
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN!');
    }
    
    console.log('\n🎉 Migration successful! Ready for authentication system development.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('📋 Troubleshooting:');
    console.error('   1. Check database connection');
    console.error('   2. Verify schema.sql file exists');
    console.error('   3. Check PostgreSQL permissions');
    console.error('   4. Review error details above');
    process.exit(1);
  } finally {
    await closePool();
  }
};

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted');
  await closePool();
  process.exit(1);
});

// Run migration
runMigration(); 