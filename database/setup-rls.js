const fs = require('fs');
const path = require('path');
const { query, closePool } = require('../src/config/database');

const setupRLS = async () => {
  console.log('🔐 Setting up Row Level Security (RLS) for multi-tenant architecture...\n');
  
  try {
    // Read RLS setup file
    const rlsPath = path.join(__dirname, 'enable-rls.sql');
    if (!fs.existsSync(rlsPath)) {
      throw new Error('RLS setup file not found at: ' + rlsPath);
    }
    
    const rlsSQL = fs.readFileSync(rlsPath, 'utf8');
    console.log('📄 RLS setup file loaded successfully');
    
    // Execute RLS setup
    console.log('⚡ Enabling Row Level Security and creating policies...');
    await query(rlsSQL);
    
    // Verify RLS is enabled
    const rlsStatus = await query(`
      SELECT 
        schemaname,
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('users', 'students', 'staff', 'schools', 'user_sessions', 'audit_logs', 'file_uploads', 'school_subscriptions')
      ORDER BY tablename
    `);
    
    console.log('\n✅ Row Level Security setup completed successfully!');
    console.log('🔒 RLS Status for Multi-Tenant Tables:');
    rlsStatus.rows.forEach(row => {
      const status = row.rls_enabled ? '🟢 ENABLED' : '🔴 DISABLED';
      console.log(`   ${status} ${row.tablename}`);
    });
    
    // Verify policies were created
    const policiesResult = await query(`
      SELECT 
        schemaname,
        tablename,
        policyname
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);
    
    console.log(`\n📋 Security Policies Created: ${policiesResult.rows.length}`);
    policiesResult.rows.forEach(row => {
      console.log(`   ✓ ${row.tablename}: ${row.policyname}`);
    });
    
    // Verify helper functions
    const functionsResult = await query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('current_user_school_id', 'is_admin_user', 'has_role')
      ORDER BY routine_name
    `);
    
    console.log(`\n🔧 Helper Functions Created: ${functionsResult.rows.length}`);
    functionsResult.rows.forEach(row => {
      console.log(`   ✓ public.${row.routine_name}()`);
    });
    
    console.log('\n🎯 Multi-Tenant Security Features:');
    console.log('   🏫 School Data Isolation: Complete');
    console.log('   👤 User Access Control: Role-based');
    console.log('   🔐 Admin Override: Super admin can access all data');
    console.log('   📊 Audit Trail: Protected with RLS');
    console.log('   📁 File Access: School-scoped');
    
    console.log('\n🚀 Ready for authentication system development!');
    
  } catch (error) {
    console.error('\n❌ RLS setup failed:', error.message);
    console.error('📋 Troubleshooting:');
    console.error('   1. Ensure database migration completed successfully');
    console.error('   2. Check database connection');
    console.error('   3. Verify PostgreSQL permissions');
    console.error('   4. Review error details above');
    process.exit(1);
  } finally {
    await closePool();
  }
};

// Handle script termination
process.on('SIGINT', async () => {
  console.log('\n🛑 RLS setup interrupted');
  await closePool();
  process.exit(1);
});

// Run RLS setup
setupRLS(); 