const { query } = require('./src/config/database');

async function checkExistingStructure() {
  try {
    // Check existing invoice_items structure
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'invoice_items'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Existing invoice_items table structure:');
    if (result.rows.length === 0) {
      console.log('  (table does not exist)');
    } else {
      result.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
    
    // Also check invoices structure
    const invoicesResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'invoices'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Existing invoices table structure:');
    if (invoicesResult.rows.length === 0) {
      console.log('  (table does not exist)');
    } else {
      invoicesResult.rows.forEach(row => {
        console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkExistingStructure();