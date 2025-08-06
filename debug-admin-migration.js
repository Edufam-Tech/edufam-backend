const { query, pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function debugAdminMigration() {
  console.log('🔍 Debugging Admin Platform Migration...\n');

  try {
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'database', 'add-admin-platform-modules.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    // Split SQL by semicolons and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      .filter(stmt => stmt.toUpperCase().includes('CREATE'));

    console.log(`Found ${statements.length} CREATE statements to execute`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comment lines
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }

      try {
        console.log(`\n${i + 1}. Executing: ${statement.substring(0, 80)}...`);
        await query(statement + ';');
        console.log('  ✅ Success');
        successCount++;
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        console.log(`  📝 Statement: ${statement}`);
        errorCount++;
        
        // If it's the subscription_status error, break here to examine
        if (error.message.includes('subscription_status')) {
          console.log('\n🔍 Found the problematic statement!');
          console.log('Statement causing error:', statement);
          break;
        }
      }
    }

    console.log(`\n📊 Summary: ${successCount} successful, ${errorCount} failed`);

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

debugAdminMigration();