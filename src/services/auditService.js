const { query } = require('../config/database');

class AuditService {
  async log(eventType, details = {}, context = {}) {
    try {
      await query(
        `INSERT INTO security_audit_trail (
          event_type, event_category, severity, user_id, ip_address, user_agent, metadata, event_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          eventType,
          context.category || 'application',
          context.severity || 'info',
          context.userId || null,
          context.ip || null,
          context.userAgent || null,
          JSON.stringify(details)
        ]
      );
    } catch (error) {
      console.error('Failed to write audit log:', error.message);
    }
  }
}

module.exports = new AuditService();


