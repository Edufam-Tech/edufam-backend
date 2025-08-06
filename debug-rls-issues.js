const { query, closePool } = require('./src/config/database');

async function investigateRLSIssues() {
  console.log('🔍 Investigating RLS Policy Conflicts...\n');
  
  try {
    // Test 1: Basic database connection
    console.log('1. Testing basic database connection...');
    const timeResult = await query('SELECT NOW() as current_time');
    console.log('✅ Database connected:', timeResult.rows[0].current_time);

    // Test 2: Check current RLS settings  
    console.log('\n2. Checking current RLS settings...');
    const rlsStatus = await query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename IN ('users', 'user_sessions', 'audit_logs', 'file_uploads')
      ORDER BY tablename
    `);
    console.log('RLS Status:');
    rlsStatus.rows.forEach(row => {
      console.log(`   ${row.tablename}: ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    });

    // Test 3: Check if we can query users table without context
    console.log('\n3. Testing users table access without RLS context...');
    try {
      const usersTest = await query('SELECT id, email, user_type FROM users LIMIT 1');
      console.log('✅ Users query successful:', usersTest.rows[0]);
    } catch (error) {
      console.log('❌ Users query failed:', error.message);
      console.log('   Error code:', error.code);
    }

    // Test 4: Set RLS context and try again
    console.log('\n4. Setting RLS context...');
    await query("SELECT set_config('app.current_user_id', $1, false)", ['45f754b1-abcf-4fdc-8cfc-344a2fffdd71']);
    console.log('✅ User context set');

    // Test 5: Check current setting
    const contextResult = await query("SELECT current_setting('app.current_user_id', true) as user_id");
    console.log('Current user context:', contextResult.rows[0].user_id);

    // Test 6: Try user_sessions insert (the failing operation)
    console.log('\n5. Testing user_sessions insert with RLS context...');
    try {
      const sessionTest = await query(`
        INSERT INTO user_sessions (user_id, refresh_token, ip_address, user_agent, device_info, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        '45f754b1-abcf-4fdc-8cfc-344a2fffdd71',
        'test-refresh-token-' + Date.now(),
        '127.0.0.1',
        'Test User Agent',
        JSON.stringify({test: true}),
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      ]);
      console.log('✅ Session insert successful:', sessionTest.rows[0]);
    } catch (error) {
      console.log('❌ Session insert failed:', error.message);
      console.log('   Error code:', error.code);
      console.log('   Error detail:', error.detail);
    }

    // Test 7: Check specific RLS policies
    console.log('\n6. Checking RLS policies...');
    const policies = await query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename IN ('users', 'user_sessions', 'audit_logs', 'file_uploads')
      ORDER BY tablename, policyname
    `);
    
    console.log('Active RLS Policies:');
    policies.rows.forEach(policy => {
      console.log(`   ${policy.tablename}.${policy.policyname}: ${policy.cmd} (${policy.permissive})`);
    });

  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await closePool();
  }
}

investigateRLSIssues();