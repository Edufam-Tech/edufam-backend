const { query } = require('./src/config/database');
const fs = require('fs');

async function applySpecializedModules() {
  try {
    console.log('🚀 Applying specialized school modules schema...');
    
    const sql = fs.readFileSync('./database/add-specialized-school-modules.sql', 'utf8');
    await query(sql);
    
    console.log('✅ Specialized school modules schema applied successfully!');
    
    // Check what tables were created
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE ANY(ARRAY['timetable_%', 'certificate_%', 'invoice_%', 'appraisal_%', 'trip_%'])
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    
    console.log(`\n🎉 Total specialized module tables created: ${result.rows.length}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    
    // If it's a missing prerequisite table error, let's check what's missing
    if (error.message.includes('does not exist')) {
      console.log('\n🔍 Checking for missing prerequisite tables...');
      
      const missingTables = [
        'classrooms', 
        'academic_years', 
        'academic_terms'
      ];
      
      for (const table of missingTables) {
        try {
          const check = await query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [table]);
          if (check.rows.length === 0) {
            console.log(`❌ Missing table: ${table}`);
          } else {
            console.log(`✅ Found table: ${table}`);
          }
        } catch (e) {
          console.log(`❌ Error checking table ${table}: ${e.message}`);
        }
      }
    }
    
    process.exit(1);
  }
}

applySpecializedModules();