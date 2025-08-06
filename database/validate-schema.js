const { query } = require('../src/config/database');

class SchemaValidator {
  constructor() {
    this.validationResults = [];
    this.errors = [];
    this.warnings = [];
  }

  logResult(test, status, details = '') {
    const result = {
      test,
      status,
      details,
      timestamp: new Date().toISOString()
    };
    this.validationResults.push(result);
    
    const statusEmoji = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️' : '❌';
    console.log(`${statusEmoji} ${test}: ${status} ${details ? '- ' + details : ''}`);
    
    if (status === 'FAIL') this.errors.push(result);
    if (status === 'WARN') this.warnings.push(result);
  }

  // Validate all required tables exist
  async validateTables() {
    console.log('\n📋 Validating Database Tables...');
    
    try {
      const result = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      const existingTables = result.rows.map(r => r.table_name);
      
      const requiredTables = [
        'users', 'schools', 'user_sessions', 'password_reset_tokens',
        'students', 'staff', 'file_uploads', 'audit_logs', 'maintenance_mode',
        'system_settings', 'subscription_plans', 'school_subscriptions'
      ];
      
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      const extraTables = existingTables.filter(table => !requiredTables.includes(table));
      
      if (missingTables.length === 0) {
        this.logResult('Required Tables', 'PASS', `All ${requiredTables.length} required tables exist`);
      } else {
        this.logResult('Required Tables', 'FAIL', `Missing tables: ${missingTables.join(', ')}`);
      }
      
      if (extraTables.length > 0) {
        this.logResult('Extra Tables', 'WARN', `Found extra tables: ${extraTables.join(', ')}`);
      }
      
      return existingTables;
    } catch (error) {
      this.logResult('Table Validation', 'FAIL', error.message);
      return [];
    }
  }

  // Validate table structures
  async validateTableStructures() {
    console.log('\n🏗️ Validating Table Structures...');
    
    const tableValidations = [
      {
        table: 'users',
        requiredColumns: [
          'id', 'email', 'password_hash', 'user_type', 'role', 'school_id',
          'first_name', 'last_name', 'is_active', 'activation_status',
          'failed_login_attempts', 'locked_until', 'created_at', 'updated_at'
        ]
      },
      {
        table: 'schools',
        requiredColumns: [
          'id', 'name', 'code', 'subscription_type', 'price_per_student',
          'subscription_status', 'is_active', 'created_at', 'updated_at'
        ]
      },
      {
        table: 'user_sessions',
        requiredColumns: [
          'id', 'user_id', 'refresh_token', 'is_active', 'expires_at', 'created_at'
        ]
      },
      {
        table: 'password_reset_tokens',
        requiredColumns: [
          'id', 'user_id', 'token', 'expires_at', 'used', 'created_at'
        ]
      }
    ];
    
    for (const validation of tableValidations) {
      try {
        const result = await query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [validation.table]);
        
        const existingColumns = result.rows.map(r => r.column_name);
        const missingColumns = validation.requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length === 0) {
          this.logResult(`${validation.table} Structure`, 'PASS', `All ${validation.requiredColumns.length} required columns exist`);
        } else {
          this.logResult(`${validation.table} Structure`, 'FAIL', `Missing columns: ${missingColumns.join(', ')}`);
        }
      } catch (error) {
        this.logResult(`${validation.table} Structure`, 'FAIL', error.message);
      }
    }
  }

  // Validate foreign key constraints
  async validateForeignKeys() {
    console.log('\n🔗 Validating Foreign Key Constraints...');
    
    try {
      const result = await query(`
        SELECT 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `);
      
      const expectedFKs = [
        { table: 'users', column: 'school_id', ref_table: 'schools', ref_column: 'id' },
        { table: 'users', column: 'created_by', ref_table: 'users', ref_column: 'id' },
        { table: 'user_sessions', column: 'user_id', ref_table: 'users', ref_column: 'id' },
        { table: 'password_reset_tokens', column: 'user_id', ref_table: 'users', ref_column: 'id' },
        { table: 'students', column: 'school_id', ref_table: 'schools', ref_column: 'id' },
        { table: 'students', column: 'parent_id', ref_table: 'users', ref_column: 'id' },
        { table: 'staff', column: 'school_id', ref_table: 'schools', ref_column: 'id' },
        { table: 'staff', column: 'user_id', ref_table: 'users', ref_column: 'id' },
        { table: 'audit_logs', column: 'user_id', ref_table: 'users', ref_column: 'id' },
        { table: 'file_uploads', column: 'user_id', ref_table: 'users', ref_column: 'id' },
        { table: 'maintenance_mode', column: 'created_by', ref_table: 'users', ref_column: 'id' },
        { table: 'school_subscriptions', column: 'school_id', ref_table: 'schools', ref_column: 'id' },
        { table: 'school_subscriptions', column: 'subscription_plan_id', ref_table: 'subscription_plans', ref_column: 'id' }
      ];
      
      const existingFKs = result.rows.map(fk => ({
        table: fk.table_name,
        column: fk.column_name,
        ref_table: fk.foreign_table_name,
        ref_column: fk.foreign_column_name
      }));
      
      const missingFKs = expectedFKs.filter(expected => 
        !existingFKs.some(existing => 
          existing.table === expected.table && 
          existing.column === expected.column &&
          existing.ref_table === expected.ref_table
        )
      );
      
      if (missingFKs.length === 0) {
        this.logResult('Foreign Key Constraints', 'PASS', `All ${expectedFKs.length} expected foreign keys exist`);
      } else {
        this.logResult('Foreign Key Constraints', 'FAIL', `Missing foreign keys: ${missingFKs.map(fk => `${fk.table}.${fk.column}`).join(', ')}`);
      }
      
      return result.rows;
    } catch (error) {
      this.logResult('Foreign Key Validation', 'FAIL', error.message);
      return [];
    }
  }

  // Validate indexes
  async validateIndexes() {
    console.log('\n📈 Validating Database Indexes...');
    
    try {
      const result = await query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);
      
      const existingIndexes = result.rows.map(idx => idx.indexname);
      
      const criticalIndexes = [
        'idx_users_email',
        'idx_users_type_role',
        'idx_users_school',
        'idx_users_active',
        'idx_users_activation_status',
        'idx_sessions_user_active',
        'idx_sessions_token',
        'idx_sessions_expires',
        'idx_password_reset_token',
        'idx_password_reset_expires',
        'idx_students_school',
        'idx_students_parent',
        'idx_staff_school',
        'idx_staff_user',
        'idx_audit_logs_user',
        'idx_audit_logs_table_record',
        'idx_audit_logs_created',
        'idx_file_uploads_user',
        'idx_school_subscriptions_school'
      ];
      
      const missingIndexes = criticalIndexes.filter(idx => !existingIndexes.includes(idx));
      
      if (missingIndexes.length === 0) {
        this.logResult('Critical Indexes', 'PASS', `All ${criticalIndexes.length} critical indexes exist`);
      } else {
        this.logResult('Critical Indexes', 'FAIL', `Missing indexes: ${missingIndexes.join(', ')}`);
      }
      
      return result.rows;
    } catch (error) {
      this.logResult('Index Validation', 'FAIL', error.message);
      return [];
    }
  }

  // Validate RLS policies
  async validateRLSPolicies() {
    console.log('\n🔒 Validating RLS Policies...');
    
    try {
      const result = await query(`
        SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
        FROM pg_policies 
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `);
      
      if (result.rows.length === 0) {
        this.logResult('RLS Policies', 'FAIL', 'No RLS policies found - security concern');
        return [];
      }
      
      // Check for critical RLS policies (using actual policy names from enable-rls.sql)
      const criticalPolicies = [
        'users_isolation_policy',
        'schools_access_policy',
        'students_school_isolation',
        'staff_school_isolation',
        'audit_logs_policy',
        'file_uploads_policy'
      ];
      
      const existingPolicies = result.rows.map(p => p.policyname);
      const missingPolicies = criticalPolicies.filter(policy => !existingPolicies.includes(policy));
      
      if (missingPolicies.length === 0) {
        this.logResult('RLS Policies', 'PASS', `All ${criticalPolicies.length} critical RLS policies exist`);
      } else {
        this.logResult('RLS Policies', 'WARN', `Missing policies: ${missingPolicies.join(', ')}`);
      }
      
      // Group policies by table
      const policiesByTable = {};
      result.rows.forEach(policy => {
        if (!policiesByTable[policy.tablename]) {
          policiesByTable[policy.tablename] = [];
        }
        policiesByTable[policy.tablename].push(policy);
      });
      
      console.log('📋 RLS Policies by table:');
      Object.keys(policiesByTable).forEach(table => {
        console.log(`   ${table}: ${policiesByTable[table].length} policies`);
      });
      
      return result.rows;
    } catch (error) {
      this.logResult('RLS Policy Validation', 'FAIL', error.message);
      return [];
    }
  }

  // Validate triggers
  async validateTriggers() {
    console.log('\n⚡ Validating Database Triggers...');
    
    try {
      const result = await query(`
        SELECT 
          trigger_name,
          event_manipulation,
          event_object_table,
          action_statement
        FROM information_schema.triggers 
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
      `);
      
      const expectedTriggers = [
        'update_schools_updated_at',
        'update_users_updated_at',
        'update_students_updated_at',
        'update_staff_updated_at',
        'update_maintenance_mode_updated_at',
        'update_system_settings_updated_at',
        'update_school_subscriptions_updated_at',
        'update_school_subscriptions_total'
      ];
      
      const existingTriggers = result.rows.map(t => t.trigger_name);
      const missingTriggers = expectedTriggers.filter(trigger => !existingTriggers.includes(trigger));
      
      if (missingTriggers.length === 0) {
        this.logResult('Database Triggers', 'PASS', `All ${expectedTriggers.length} expected triggers exist`);
      } else {
        this.logResult('Database Triggers', 'WARN', `Missing triggers: ${missingTriggers.join(', ')}`);
      }
      
      return result.rows;
    } catch (error) {
      this.logResult('Trigger Validation', 'FAIL', error.message);
      return [];
    }
  }

  // Validate default data
  async validateDefaultData() {
    console.log('\n📊 Validating Default Data...');
    
    try {
      // Check for default admin user
      const adminUser = await query(`
        SELECT COUNT(*) as count FROM users 
        WHERE email = 'admin@edufam.com' AND role = 'super_admin'
      `);
      
      if (adminUser.rows[0].count > 0) {
        this.logResult('Default Admin User', 'PASS', 'Default admin user exists');
      } else {
        this.logResult('Default Admin User', 'FAIL', 'Default admin user missing');
      }
      
      // Check for default system settings
      const systemSettings = await query(`
        SELECT COUNT(*) as count FROM system_settings
      `);
      
      if (systemSettings.rows[0].count >= 5) {
        this.logResult('System Settings', 'PASS', `${systemSettings.rows[0].count} system settings exist`);
      } else {
        this.logResult('System Settings', 'WARN', 'Insufficient system settings');
      }
      
      // Check for subscription plans
      const subscriptionPlans = await query(`
        SELECT COUNT(*) as count FROM subscription_plans
      `);
      
      if (subscriptionPlans.rows[0].count >= 3) {
        this.logResult('Subscription Plans', 'PASS', `${subscriptionPlans.rows[0].count} subscription plans exist`);
      } else {
        this.logResult('Subscription Plans', 'WARN', 'Insufficient subscription plans');
      }
      
    } catch (error) {
      this.logResult('Default Data Validation', 'FAIL', error.message);
    }
  }

  // Run all validations
  async runAllValidations() {
    console.log('🔍 Starting Comprehensive Database Schema Validation...\n');
    console.log('='.repeat(60));
    
    await this.validateTables();
    await this.validateTableStructures();
    await this.validateForeignKeys();
    await this.validateIndexes();
    await this.validateRLSPolicies();
    await this.validateTriggers();
    await this.validateDefaultData();
    
    this.generateReport();
  }

  // Generate validation report
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DATABASE SCHEMA VALIDATION REPORT');
    console.log('='.repeat(60));
    
    const totalValidations = this.validationResults.length;
    const passedValidations = this.validationResults.filter(r => r.status === 'PASS').length;
    const failedValidations = this.errors.length;
    const warningValidations = this.warnings.length;
    
    console.log(`\n📊 Validation Summary:`);
    console.log(`   Total Validations: ${totalValidations}`);
    console.log(`   ✅ Passed: ${passedValidations}`);
    console.log(`   ❌ Failed: ${failedValidations}`);
    console.log(`   ⚠️  Warnings: ${warningValidations}`);
    console.log(`   Success Rate: ${((passedValidations / totalValidations) * 100).toFixed(1)}%`);
    
    if (this.errors.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.test}: ${error.details}`);
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning.test}: ${warning.details}`);
      });
    }
    
    // Recommendations
    console.log(`\n💡 RECOMMENDATIONS:`);
    
    if (failedValidations > 0) {
      console.log(`   🔴 HIGH PRIORITY: Fix ${failedValidations} critical schema issues`);
    }
    
    if (warningValidations > 0) {
      console.log(`   🟡 MEDIUM PRIORITY: Address ${warningValidations} schema warnings`);
    }
    
    if (failedValidations === 0 && warningValidations === 0) {
      console.log(`   🟢 EXCELLENT: Database schema is properly configured!`);
    }
    
    console.log('='.repeat(60));
  }
}

// Run validation if script is executed directly
if (require.main === module) {
  const validator = new SchemaValidator();
  validator.runAllValidations().catch(console.error);
}

module.exports = SchemaValidator; 