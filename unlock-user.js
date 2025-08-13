const { query, closePool } = require('./src/config/database');

async function unlockUser(email) {
  if (!email) {
    console.error('Usage: node unlock-user.js <email>');
    process.exit(1);
  }

  try {
    console.log(`🔓 Unlocking user: ${email}`);
    const result = await query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL
       WHERE email = $1
       RETURNING id, email, failed_login_attempts, locked_until`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      console.log('❌ No user found with that email');
    } else {
      console.log('✅ User unlocked:', result.rows[0]);
    }
  } catch (err) {
    console.error('❌ Failed to unlock user:', err.message);
  } finally {
    await closePool();
  }
}

unlockUser(process.argv[2]);


