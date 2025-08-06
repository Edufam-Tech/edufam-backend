const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./src/config/database');

async function applyAllMissingSchemas() {
  console.log('🚀 Applying all missing database schemas in correct order...\n');
  
  // Define application order based on dependencies
  const schemasToApply = [
    // Core dependencies first (these might be needed by other modules)
    'add-student-tables.sql',
    'add-academic-tables.sql',
    
    // Main modules (order shouldn't matter much between these)
    'add-academic-module.sql',
    'add-communication-module.sql', 
    'add-hr-module.sql',
    
    // Reports last (might reference other tables)
    'add-reports-analytics-module.sql'
  ];

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (const schemaFile of schemasToApply) {
    try {
      console.log(`📄 Applying ${schemaFile}...`);
      
      const schemaPath = path.join(__dirname, 'database', schemaFile);
      if (!fs.existsSync(schemaPath)) {
        console.log(`⚠️  File not found: ${schemaFile} - skipping`);
        continue;
      }

      const sql = fs.readFileSync(schemaPath, 'utf8');
      
      // Split SQL by statement and execute each separately to get better error reporting
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      console.log(`   Processing ${statements.length} SQL statements...`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (statement.length === 0) continue;
        
        try {
          await query(statement);
        } catch (statementError) {
          // Check if it's a "already exists" error - these are often OK
          if (statementError.message.includes('already exists') || 
              statementError.message.includes('duplicate key')) {
            console.log(`   ⚠️  Statement ${i + 1}: ${statementError.message} (continuing...)`);
          } else {
            throw statementError;
          }
        }
      }
      
      console.log(`✅ Successfully applied ${schemaFile}`);
      successCount++;
      
    } catch (error) {
      console.log(`❌ Error applying ${schemaFile}:`);
      console.log(`   ${error.message}`);
      errors.push({ file: schemaFile, error: error.message });
      errorCount++;
    }
  }

  // Verify what tables now exist
  console.log('\n📋 Verifying database state...');
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`✅ Database now has ${result.rows.length} tables`);
  } catch (error) {
    console.log('❌ Could not verify database state:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 SCHEMA APPLICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully applied: ${successCount} schemas`);
  console.log(`❌ Failed: ${errorCount} schemas`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ file, error }) => {
      console.log(`   📄 ${file}: ${error}`);
    });
  }
  
  if (successCount > 0) {
    console.log('\n🎉 Database schemas have been updated!');
    console.log('📋 You can now run validation:');
    console.log('   node database/validate-schema.js');
    console.log('   node find-missing-tables.js');
  }

  await closePool();
  
  // Exit with appropriate code
  process.exit(errorCount > 0 ? 1 : 0);
}

applyAllMissingSchemas().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});