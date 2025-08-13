const { query } = require('../config/database');

/**
 * Token Blacklist Utility
 * Supports JWT blacklisting for logout and compromised tokens
 */
class TokenBlacklist {
  async add(token, reason = 'logout', expiresAt = null) {
    try {
      await query(
        `INSERT INTO token_blacklist (token, reason, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token) DO UPDATE SET reason = EXCLUDED.reason, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
        [token, reason, expiresAt]
      );
      return true;
    } catch (error) {
      console.error('Failed to blacklist token:', error.message);
      return false;
    }
  }

  async isBlacklisted(token) {
    try {
      const result = await query(
        `SELECT 1 FROM token_blacklist WHERE token = $1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
        [token]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Failed to check token blacklist:', error.message);
      // During local development or first-run, the table may not exist yet (42P01)
      // In that case, do not block authentication; log and allow.
      if (error && (error.code === '42P01' || /token_blacklist/i.test(error.message))) {
        return false;
      }
      // Otherwise fail-safe: if we cannot verify, deny
      return true;
    }
  }
}

module.exports = new TokenBlacklist();


