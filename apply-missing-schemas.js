const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./src/config/database');

async function applyMissingSchemas() {
  console.log('🚀 Applying missing database schemas...\n');
  
  const schemasToApply = [
    'add-academic-module.sql',
    'add-financial-module.sql', 
    'add-communication-module.sql',
    'add-hr-module.sql'
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const schemaFile of schemasToApply) {
    try {
      console.log(`📄 Applying ${schemaFile}...`);
      
      const schemaPath = path.join(__dirname, 'database', schemaFile);
      if (!fs.existsSync(schemaPath)) {
        console.log(`❌ File not found: ${schemaFile}`);
        errorCount++;
        continue;
      }

      const sql = fs.readFileSync(schemaPath, 'utf8');
      await query(sql);
      
      console.log(`✅ Successfully applied ${schemaFile}`);
      successCount++;
      
    } catch (error) {
      console.log(`❌ Error applying ${schemaFile}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SCHEMA APPLICATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Successfully applied: ${successCount} schemas`);
  console.log(`❌ Failed: ${errorCount} schemas`);
  
  if (successCount > 0) {
    console.log('\n🎉 Database schemas have been updated!');
    console.log('📋 You may now run the validation script to verify:');
    console.log('   node database/validate-schema.js');
  }

  await closePool();
}

applyMissingSchemas().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});