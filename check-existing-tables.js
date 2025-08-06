const { query } = require('./src/config/database');

async function checkExistingTables() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE 'timetable_%' 
             OR table_name LIKE 'certificate_%' 
             OR table_name LIKE 'invoice_%' 
             OR table_name LIKE 'appraisal_%' 
             OR table_name LIKE 'trip_%'
             OR table_name = 'classrooms')
      ORDER BY table_name
    `);
    
    console.log('📊 Existing specialized module tables:');
    if (result.rows.length === 0) {
      console.log('  (none found)');
    } else {
      result.rows.forEach(row => console.log('  -', row.table_name));
    }
    
    console.log(`\nTotal: ${result.rows.length} tables`);
    
    // Also check if the main prerequisite tables exist
    console.log('\n🔍 Checking prerequisite tables:');
    const prereqs = ['schools', 'users', 'students', 'staff', 'classes', 'subjects', 'academic_years', 'academic_terms'];
    
    for (const table of prereqs) {
      try {
        const check = await query(`SELECT 1 FROM information_schema.tables WHERE table_name = $1`, [table]);
        if (check.rows.length > 0) {
          console.log(`  ✅ ${table}`);
        } else {
          console.log(`  ❌ ${table} (missing)`);
        }
      } catch (e) {
        console.log(`  ❌ ${table} (error: ${e.message})`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkExistingTables();