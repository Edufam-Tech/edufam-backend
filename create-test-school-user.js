const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function getAnySchoolId() {
  const existingSchool = await query('SELECT id FROM schools ORDER BY created_at ASC LIMIT 1');
  if (existingSchool.rows.length === 0) {
    throw new Error('No schools found. Please create a school first to attach test users.');
  }
  return existingSchool.rows[0].id;
}

async function upsertSchoolUser(email, role, firstName, lastName, password) {
  const normalizedEmail = email.toLowerCase().trim();
  const schoolId = await getAnySchoolId();
  const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing.rows.length > 0) {
    const id = existing.rows[0].id;
    await query(
      `UPDATE users SET password_hash = $1, user_type = 'school_user', role = $2, school_id = $3, is_active = true, activation_status = 'active', email_verified = true WHERE id = $4`,
      [passwordHash, role, schoolId, id]
    );
    return { id, email: normalizedEmail, role, user_type: 'school_user', school_id: schoolId, updated: true };
  }
  const result = await query(
    `INSERT INTO users (email, password_hash, user_type, role, first_name, last_name, school_id, is_active, email_verified, activation_status, created_at)
     VALUES ($1, $2, 'school_user', $3, $4, $5, $6, true, true, 'active', NOW())
     RETURNING id, email, role, user_type, school_id`,
    [normalizedEmail, passwordHash, role, firstName, lastName, schoolId]
  );
  return { ...result.rows[0], updated: false };
}

async function main() {
  try {
    console.log('🔧 Creating test school users...');
    const teacher = await upsertSchoolUser('teacher@edufam.com', 'teacher', 'Test', 'Teacher', 'TempPass123!');
    const parent = await upsertSchoolUser('parent@edufam.com', 'parent', 'Test', 'Parent', 'TempPass123!');
    const principal = await upsertSchoolUser('principal@edufam.com', 'principal', 'Test', 'Principal', 'TempPass123!');
    console.log('✅ Users ready:');
    console.table([
      { email: teacher.email, role: teacher.role, type: teacher.user_type, password: 'TempPass123!' },
      { email: parent.email, role: parent.role, type: parent.user_type, password: 'TempPass123!' },
      { email: principal.email, role: principal.role, type: principal.user_type, password: 'TempPass123!' },
    ]);
    process.exit(0);
  } catch (e) {
    console.error('❌ Failed to create school users:', e.message);
    process.exit(1);
  }
}

main();


