const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./src/config/database');

async function applyRemainingSchemas() {
  console.log('🚀 Applying remaining missing database schemas...\n');
  
  const schemasToApply = [
    'add-academic-module.sql',
    'add-hr-module.sql'
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
      
      // For large SQL files, execute in smaller chunks to handle any issues
      try {
        await query(sql);
        console.log(`✅ Successfully applied ${schemaFile}`);
        successCount++;
      } catch (error) {
        // If there's an error, try to execute statement by statement
        console.log(`⚠️  Full execution failed, trying statement by statement...`);
        
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        let stmtSuccess = 0;
        let stmtErrors = 0;
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i].trim();
          if (statement.length === 0) continue;
          
          try {
            await query(statement);
            stmtSuccess++;
          } catch (statementError) {
            // Check if it's a benign error
            if (statementError.message.includes('already exists') || 
                statementError.message.includes('duplicate key') ||
                statementError.message.includes('does not exist')) {
              console.log(`   ⚠️  Statement ${i + 1}: ${statementError.message.substring(0, 100)}... (continuing)`);
              stmtSuccess++;
            } else {
              console.log(`   ❌ Statement ${i + 1}: ${statementError.message.substring(0, 100)}...`);
              stmtErrors++;
            }
          }
        }
        
        if (stmtErrors === 0) {
          console.log(`✅ Applied ${schemaFile} with ${stmtSuccess} statements`);
          successCount++;
        } else {
          console.log(`❌ ${schemaFile} had ${stmtErrors} failed statements out of ${statements.length}`);
          errors.push({ file: schemaFile, error: `${stmtErrors} failed statements` });
          errorCount++;
        }
      }
      
    } catch (error) {
      console.log(`❌ Error applying ${schemaFile}:`);
      console.log(`   ${error.message.substring(0, 200)}...`);
      errors.push({ file: schemaFile, error: error.message });
      errorCount++;
    }
  }

  // Verify database state
  console.log('\n📋 Verifying database state...');
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log(`✅ Database now has ${result.rows.length} tables`);
    
    // Check for key tables from each module
    const keyTables = ['assessments', 'grades', 'employees', 'payroll', 'leave_applications'];
    const existingKeyTables = result.rows
      .map(r => r.table_name)
      .filter(table => keyTables.includes(table));
      
    console.log(`📊 Key module tables present: ${existingKeyTables.join(', ')}`);
    
  } catch (error) {
    console.log('❌ Could not verify database state:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 REMAINING SCHEMA APPLICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully applied: ${successCount} schemas`);
  console.log(`❌ Failed: ${errorCount} schemas`);
  
  if (errors.length > 0) {
    console.log('\n❌ ERRORS:');
    errors.forEach(({ file, error }) => {
      console.log(`   📄 ${file}: ${error.substring(0, 100)}...`);
    });
  }
  
  if (successCount > 0) {
    console.log('\n🎉 Database schemas have been updated!');
    console.log('📋 Run final verification:');
    console.log('   node find-missing-tables.js');
  }

  await closePool();
  process.exit(errorCount > 0 ? 1 : 0);
}

applyRemainingSchemas().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});