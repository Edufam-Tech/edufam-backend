const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🚀 Starting Student Tables Migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'add-student-tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Executing student tables migration...');
    
    // Execute the migration as a single transaction
    await query('BEGIN');
    await query(migrationSQL);
    await query('COMMIT');
    
    console.log('✅ Student Tables Migration completed successfully!');
    
    // Verify the tables were created
    console.log('🔍 Verifying migration...');
    
    const tables = ['students', 'classes', 'enrollments'];
    
    for (const table of tables) {
      const result = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [table]);
      
      if (result.rows[0].exists) {
        console.log(`✅ Table '${table}' created successfully`);
      } else {
        console.log(`❌ Table '${table}' was not created`);
      }
    }
    
    // Check indexes
    console.log('🔍 Verifying indexes...');
    
    const indexQueries = [
      'SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = \'students\'',
      'SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = \'classes\'',
      'SELECT COUNT(*) as count FROM pg_indexes WHERE tablename = \'enrollments\''
    ];
    
    for (let i = 0; i < indexQueries.length; i++) {
      const result = await query(indexQueries[i]);
      console.log(`📈 Indexes for ${tables[i]}: ${result.rows[0].count} indexes`);
    }
    
    // Check RLS policies
    console.log('🔍 Verifying RLS policies...');
    
    const rlsQueries = [
      'SELECT COUNT(*) as count FROM pg_policies WHERE tablename = \'students\'',
      'SELECT COUNT(*) as count FROM pg_policies WHERE tablename = \'classes\'',
      'SELECT COUNT(*) as count FROM pg_policies WHERE tablename = \'enrollments\''
    ];
    
    for (let i = 0; i < rlsQueries.length; i++) {
      const result = await query(rlsQueries[i]);
      console.log(`🔒 RLS policies for ${tables[i]}: ${result.rows[0].count} policies`);
    }
    
    console.log('🎉 Student Tables Migration verification completed!');
    
  } catch (error) {
    // Rollback on error
    await query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    process.exit(0);
  }
}

// Run migration if script is executed directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration }; 