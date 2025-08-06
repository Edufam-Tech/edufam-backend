const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./src/config/database');

async function applyPrerequisites() {
  try {
    console.log('🚀 Applying prerequisite tables and columns...\n');

    const sql = fs.readFileSync(path.join(__dirname, 'create-missing-prerequisites.sql'), 'utf8');
    
    // Split by statement and execute each separately
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(`📄 Processing ${statements.length} SQL statements...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length === 0) continue;
      
      try {
        await query(statement);
        console.log(`✅ Statement ${i + 1}: Success`);
      } catch (error) {
        if (error.message.includes('already exists') || 
            error.message.includes('duplicate key') ||
            error.message.includes('does not exist')) {
          console.log(`⚠️  Statement ${i + 1}: ${error.message} (continuing...)`);
        } else {
          console.log(`❌ Statement ${i + 1}: ${error.message}`);
          throw error;
        }
      }
    }
    
    console.log('\n✅ Prerequisites applied successfully!');
    
    // Verify tables were created
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('subjects', 'departments', 'class_subjects')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Verification:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name} table exists`);
    });
    
  } catch (error) {
    console.error('❌ Error applying prerequisites:', error.message);
    throw error;
  } finally {
    await closePool();
  }
}

applyPrerequisites().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});