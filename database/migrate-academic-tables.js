const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Starting Academic Tables Migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'add-academic-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing migration SQL...');
    
    // Execute the entire migration as one transaction
    await query('BEGIN');
    
    try {
      // Execute the migration SQL
      await query(migrationSQL);
      
      // Commit the transaction
      await query('COMMIT');
      
      console.log('✅ Migration executed successfully!');
      
    } catch (error) {
      // Rollback on error
      await query('ROLLBACK');
      throw error;
    }
    
    // Verify the tables were created
    console.log('🔍 Verifying migration...');
    
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('academic_years', 'academic_terms')
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name}`);
    });
    
    // Check for academic years data
    const academicYearsCount = await query('SELECT COUNT(*) as count FROM academic_years');
    console.log(`📈 Academic Years: ${academicYearsCount.rows[0].count} records`);
    
    // Check for academic terms data
    const academicTermsCount = await query('SELECT COUNT(*) as count FROM academic_terms');
    console.log(`📈 Academic Terms: ${academicTermsCount.rows[0].count} records`);
    
    // Check if schools table was updated
    const schoolsColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'schools' 
      AND column_name = 'current_academic_year_id'
    `);
    
    if (schoolsColumns.rows.length > 0) {
      console.log('✅ Schools table updated with current_academic_year_id column');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    const { pool } = require('../src/config/database');
    await pool.end();
    console.log('🔒 Database connection closed');
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration }; 