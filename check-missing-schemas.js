const { query, closePool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function checkMissingSchemas() {
  try {
    console.log('🔍 Checking for missing database schemas...\n');

    // Get current tables
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const currentTables = result.rows.map(r => r.table_name);
    console.log('📋 Current tables in database:', currentTables.length);
    
    // Define expected tables from each module
    const moduleSchemas = {
      'Communication Module': [
        'messages',
        'message_recipients', 
        'message_threads',
        'thread_participants',
        'announcements',
        'notifications',
        'notification_recipients',
        'communication_templates',
        'scheduled_communications',
        'communication_logs',
        'communication_settings',
        'parent_communication_preferences',
        'communication_groups',
        'communication_group_members'
      ],
      'HR Module': [
        'employees',
        'leave_types',
        'leave_applications',
        'leave_balances',
        'payroll',
        'performance_reviews',
        'performance_goals',
        'training_records',
        'disciplinary_actions',
        'employee_attendance',
        'hr_settings'
      ],
      'Financial Module (M-Pesa)': [
        'mpesa_transactions',
        'mpesa_callbacks'
      ],
      'Academic Module': [
        'assessments',
        'assessment_categories',
        'grades',
        'grading_scales',
        'grade_boundaries',
        'grade_approval_history',
        'attendance',
        'attendance_registers',
        'attendance_reasons',
        'attendance_settings'
      ],
      'Financial Module (Core)': [
        'fee_categories',
        'fee_structures',
        'fee_assignments',
        'payments',
        'payment_methods',
        'payment_plans',
        'payment_plan_installments',
        'fee_discounts',
        'fee_waivers',
        'invoices',
        'invoice_items',
        'receipts'
      ]
    };

    console.log('\n🔍 Checking each module...\n');
    
    let totalMissing = 0;
    const missingSchemas = [];

    for (const [moduleName, expectedTables] of Object.entries(moduleSchemas)) {
      const missingTables = expectedTables.filter(table => !currentTables.includes(table));
      
      console.log(`📦 ${moduleName}:`);
      console.log(`   Expected: ${expectedTables.length} tables`);
      console.log(`   Missing: ${missingTables.length} tables`);
      
      if (missingTables.length > 0) {
        console.log(`   ❌ Missing tables: ${missingTables.join(', ')}`);
        missingSchemas.push({
          module: moduleName,
          missingTables: missingTables
        });
        totalMissing += missingTables.length;
      } else {
        console.log(`   ✅ All tables present`);
      }
      console.log('');
    }

    // Check for corresponding SQL files
    console.log('📁 Checking for corresponding schema files...\n');
    
    const schemaFiles = [
      'add-communication-module.sql',
      'add-hr-module.sql', 
      'add-financial-module.sql',
      'add-academic-module.sql'
    ];

    const unappliedSchemas = [];

    for (const filename of schemaFiles) {
      const filePath = path.join(__dirname, 'database', filename);
      if (fs.existsSync(filePath)) {
        console.log(`📄 Found: ${filename}`);
        
        // Determine if this schema needs to be applied based on missing tables
        const needsApplication = missingSchemas.some(schema => {
          if (filename.includes('communication') && schema.module === 'Communication Module') return true;
          if (filename.includes('hr') && schema.module === 'HR Module') return true;
          if (filename.includes('financial') && (schema.module.includes('Financial') || schema.module.includes('M-Pesa'))) return true;
          if (filename.includes('academic') && schema.module === 'Academic Module') return true;
          return false;
        });

        if (needsApplication) {
          unappliedSchemas.push(filename);
          console.log(`   ⚠️  Needs to be applied`);
        } else {
          console.log(`   ✅ Already applied`);
        }
      } else {
        console.log(`❌ Missing: ${filename}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total missing tables: ${totalMissing}`);
    console.log(`Unapplied schema files: ${unappliedSchemas.length}`);
    
    if (unappliedSchemas.length > 0) {
      console.log('\n🚨 SCHEMAS THAT NEED TO BE APPLIED:');
      unappliedSchemas.forEach(schema => {
        console.log(`   📄 ${schema}`);
      });
      
      console.log('\n🔧 To apply these schemas, run:');
      unappliedSchemas.forEach(schema => {
        console.log(`   node -e "const fs=require('fs'); const {query}=require('./src/config/database'); const sql=fs.readFileSync('./database/${schema}','utf8'); query(sql).then(()=>console.log('${schema} applied')).catch(console.error).finally(()=>process.exit());"`);
      });
    } else {
      console.log('\n✅ All schemas appear to be applied!');
    }

  } catch (error) {
    console.error('❌ Error checking schemas:', error.message);
  } finally {
    await closePool();
  }
}

checkMissingSchemas();