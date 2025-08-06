const { query } = require('./src/config/database');

async function testGetUserSessions() {
  try {
    console.log('🔍 Testing getUserSessions query...');
    
    // First get the user ID
    const userResult = await query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@edufam.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const userId = userResult.rows[0].id;
    console.log('User ID:', userId);
    
    // Test the exact query from authService.getUserSessions
    const sql = `
      SELECT id, ip_address, user_agent, device_info, created_at, expires_at
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
      ORDER BY created_at DESC
    `;
    
    console.log('SQL Query:', sql);
    console.log('Parameter:', userId);
    
    const result = await query(sql, [userId]);
    
    console.log('Query result:');
    console.log('Rows found:', result.rows.length);
    
    if (result.rows.length > 0) {
      result.rows.forEach((session, index) => {
        console.log(`Session ${index + 1}:`);
        console.log('  ID:', session.id);
        console.log('  IP Address:', session.ip_address);
        console.log('  User Agent:', session.user_agent);
        console.log('  Created At:', session.created_at);
        console.log('  Expires At:', session.expires_at);
        console.log('  Device Info:', session.device_info);
      });
    } else {
      console.log('No active sessions found');
    }
    
  } catch (error) {
    console.error('❌ Query failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the script
testGetUserSessions().then(() => {
  console.log('🎉 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 