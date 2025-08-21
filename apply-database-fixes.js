const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'edufam_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function applyDatabaseFixes() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Applying database fixes...');
    
    // Read the SQL fix file
    const sqlFilePath = path.join(__dirname, 'database', 'fix-missing-tables.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await client.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          // Some statements might fail if tables/columns already exist, which is fine
          if (error.code === '42710' || error.code === '42701' || error.code === '42P07') {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('🎉 Database fixes applied successfully!');
    
    // Verify the fixes
    console.log('🔍 Verifying fixes...');
    
    // Check if expense_requests table exists
    const expenseCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expense_requests'
      );
    `);
    
    if (expenseCheck.rows[0].exists) {
      console.log('✅ expense_requests table exists');
    } else {
      console.log('❌ expense_requests table missing');
    }
    
    // Check if transport_vehicles table exists
    const vehicleCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transport_vehicles'
      );
    `);
    
    if (vehicleCheck.rows[0].exists) {
      console.log('✅ transport_vehicles table exists');
    } else {
      console.log('❌ transport_vehicles table missing');
    }
    
    // Check if students table has class_id column
    const classIdCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'students' 
        AND column_name = 'class_id'
      );
    `);
    
    if (classIdCheck.rows[0].exists) {
      console.log('✅ students.class_id column exists');
    } else {
      console.log('❌ students.class_id column missing');
    }
    
    // Check if fee_assignments table has assignment_name column
    const assignmentNameCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'fee_assignments' 
        AND column_name = 'assignment_name'
      );
    `);
    
    if (assignmentNameCheck.rows[0].exists) {
      console.log('✅ fee_assignments.assignment_name column exists');
    } else {
      console.log('❌ fee_assignments.assignment_name column missing');
    }
    
    console.log('🎯 Database verification completed!');
    
  } catch (error) {
    console.error('💥 Error applying database fixes:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  applyDatabaseFixes()
    .then(() => {
      console.log('🚀 Database fixes completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database fixes failed:', error);
      process.exit(1);
    });
}

module.exports = { applyDatabaseFixes };
