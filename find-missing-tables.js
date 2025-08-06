const fs = require('fs');
const path = require('path');
const { query, closePool } = require('./src/config/database');

async function findMissingTables() {
  try {
    console.log('🔍 Comprehensive missing table analysis...\n');

    // Get current tables
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const currentTables = result.rows.map(r => r.table_name);
    console.log('📋 Current tables in database:', currentTables.length);
    currentTables.forEach(table => console.log(`   ✓ ${table}`));

    // Check all SQL files for CREATE TABLE statements
    const sqlFiles = fs.readdirSync(path.join(__dirname, 'database')).filter(f => f.endsWith('.sql'));
    console.log(`\n📄 Found ${sqlFiles.length} SQL files\n`);

    const allExpectedTables = new Set();
    const tablesByFile = {};

    for (const file of sqlFiles) {
      console.log(`📄 Analyzing ${file}...`);
      const content = fs.readFileSync(path.join(__dirname, 'database', file), 'utf8');
      
      // Find CREATE TABLE statements
      const createTableMatches = content.match(/CREATE TABLE\s+(\w+)/gi);
      if (createTableMatches) {
        const tables = createTableMatches.map(match => 
          match.replace(/CREATE TABLE\s+/i, '').toLowerCase()
        );
        tablesByFile[file] = tables;
        tables.forEach(table => allExpectedTables.add(table));
        console.log(`   Found ${tables.length} tables: ${tables.join(', ')}`);
      } else {
        console.log(`   No CREATE TABLE statements found`);
      }
    }

    console.log(`\n📊 Total expected tables: ${allExpectedTables.size}`);
    
    // Find missing tables
    const missingTables = Array.from(allExpectedTables).filter(table => !currentTables.includes(table));
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MISSING TABLES ANALYSIS');
    console.log('='.repeat(60));
    
    if (missingTables.length === 0) {
      console.log('✅ All expected tables are present!');
    } else {
      console.log(`❌ Missing ${missingTables.length} tables:\n`);
      
      // Group missing tables by file
      for (const [file, tables] of Object.entries(tablesByFile)) {
        const missingFromFile = tables.filter(table => missingTables.includes(table));
        if (missingFromFile.length > 0) {
          console.log(`📄 ${file}:`);
          console.log(`   Missing: ${missingFromFile.join(', ')}`);
          console.log('');
        }
      }
      
      console.log('🔧 Suggested application order:');
      const applicationOrder = [
        'add-student-tables.sql',
        'add-academic-tables.sql', 
        'add-academic-module.sql',
        'add-financial-module.sql',
        'add-transport-module.sql',
        'add-communication-module.sql',
        'add-hr-module.sql',
        'add-reports-analytics-module.sql'
      ];
      
      applicationOrder.forEach((file, index) => {
        if (tablesByFile[file] && tablesByFile[file].some(table => missingTables.includes(table))) {
          console.log(`   ${index + 1}. ${file}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await closePool();
  }
}

findMissingTables();