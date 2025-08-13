const bcrypt = require('bcryptjs');
const { query, closePool } = require('./src/config/database');

const USERS = [
  { email: 'adan@gmail.com', role: 'super_admin', firstName: 'Adan', lastName: 'SuperAdmin' },
  { email: 'joseph@gmail.com', role: 'engineer', firstName: 'Joseph', lastName: 'Engineer' },
  { email: 'nasra@gmail.com', role: 'support_hr', firstName: 'Nasra', lastName: 'SupportHR' },
  { email: 'aisha@gmail.com', role: 'sales_marketing', firstName: 'Aisha', lastName: 'Sales' },
  { email: 'john@gmail.com', role: 'admin_finance', firstName: 'John', lastName: 'Finance' },
];

const PASSWORD = 'elimisha123';

async function upsertAdminUser({ email, role, firstName, lastName }, passwordHash) {
  // If exists, update password, role, activation; else insert
  const existing = await query('SELECT id FROM users WHERE email = $1 AND user_type = $2', [email.toLowerCase(), 'admin_user']);
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await query(
      `UPDATE users
       SET password_hash = $1,
           role = $2,
           is_active = true,
           email_verified = true,
           activation_status = 'active',
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $3`,
      [passwordHash, role, id]
    );
    return { id, email, role, updated: true };
  } else {
    const result = await query(
      `INSERT INTO users (
         email, password_hash, user_type, role, first_name, last_name,
         is_active, email_verified, activation_status, created_at
       ) VALUES ($1, $2, 'admin_user', $3, $4, $5, true, true, 'active', NOW())
       RETURNING id`,
      [email.toLowerCase(), passwordHash, role, firstName, lastName]
    );
    return { id: result.rows[0].id, email, role, created: true };
  }
}

async function run() {
  try {
    console.log('🔧 Seeding admin users...');
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const results = [];
    for (const user of USERS) {
      const res = await upsertAdminUser(user, passwordHash);
      results.push(res);
      console.log(`✅ ${res.updated ? 'Updated' : 'Created'}: ${user.email} (${user.role})`);
    }
    console.log('\n🔐 Credentials for all users set to password:', PASSWORD);
    console.log('Done.');
  } catch (err) {
    console.error('❌ Failed to seed admin users:', err.message);
  } finally {
    await closePool();
  }
}

run();


