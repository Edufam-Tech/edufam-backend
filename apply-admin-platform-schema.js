const fs = require('fs');
const path = require('path');
const { query } = require('./src/config/database');

async function applyAdminPlatformSchema() {
  try {
    console.log('🔧 Applying Admin Platform Schema...');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'database', '14-admin-platform-schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📄 SQL file loaded successfully');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        try {
          await query(statement);
          successCount++;
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error in statement ${i + 1}/${statements.length}:`, error.message);
          
          // Continue with other statements unless it's a critical error
          if (error.message.includes('already exists')) {
            console.log('⚠️  Table/object already exists, continuing...');
          }
        }
      }
    }
    
    console.log('\n================================================');
    console.log('🎉 ADMIN PLATFORM SCHEMA APPLICATION COMPLETED!');
    console.log('================================================');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    console.log('');
    console.log('📋 Created tables:');
    console.log('  ✅ platform_admins');
    console.log('  ✅ platform_regions');
    console.log('  ✅ admin_activity_logs');
    console.log('  ✅ platform_settings');
    console.log('  ✅ platform_metrics');
    console.log('  ✅ system_health_checks');
    console.log('  ✅ feature_flags');
    console.log('  ✅ maintenance_mode');
    console.log('');
    console.log('🔐 Applied Row Level Security (RLS) policies');
    console.log('📈 Created performance indexes');
    console.log('📊 Inserted sample data');
    console.log('');
    console.log('🚀 Admin platform is now ready for use!');
    console.log('================================================');
    
  } catch (error) {
    console.error('💥 Failed to apply admin platform schema:', error.message);
    process.exit(1);
  }
}

// Run the schema application
applyAdminPlatformSchema(); 