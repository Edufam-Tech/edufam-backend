const { query } = require('../config/database');

/**
 * Support HR Controller
 * Provides endpoints for Support HR dashboard: analytics, tickets, knowledge base, training, onboarding
 */
class SupportHRController {
  // GET /api/admin/support/analytics
  static async analyticsSummary(req, res, next) {
    try {
      const totals = await query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'open')::int AS open,
           COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
           COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
           COALESCE(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0),0)::numeric(10,2) AS avg_resolution_hours
         FROM support_tickets`
      );

      const csat = await query(
        `SELECT COALESCE(AVG(csat_score),0)::numeric(10,2) AS avg_csat FROM support_tickets`
      ).catch(() => ({ rows: [{ avg_csat: 0 }] }));

      res.json({ success: true, data: {
        total_tickets: totals.rows[0]?.total ?? 0,
        open_tickets: totals.rows[0]?.open ?? 0,
        in_progress_tickets: totals.rows[0]?.in_progress ?? 0,
        resolved_tickets: totals.rows[0]?.resolved ?? 0,
        avg_resolution_hours: totals.rows[0]?.avg_resolution_hours ?? 0,
        avg_csat: csat.rows[0]?.avg_csat ?? 0,
      }});
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/support/analytics/timeseries?period=30d
  static async analyticsTimeseries(req, res, next) {
    try {
      const { period = '30d' } = req.query;
      const sinceSql = `CASE WHEN $1 = '7d' THEN NOW() - INTERVAL '7 days' WHEN $1 = '90d' THEN NOW() - INTERVAL '90 days' ELSE NOW() - INTERVAL '30 days' END`;
      const series = await query(
        `WITH days AS (
           SELECT generate_series((DATE(${sinceSql})), current_date, INTERVAL '1 day')::date AS day
         ),
         created AS (
           SELECT DATE(created_at) AS day, COUNT(*)::int AS created_count
           FROM support_tickets
           WHERE created_at >= ${sinceSql}
           GROUP BY DATE(created_at)
         ),
         resolved AS (
           SELECT DATE(updated_at) AS day, COUNT(*)::int AS resolved_count
           FROM support_tickets
           WHERE status = 'resolved' AND updated_at >= ${sinceSql}
           GROUP BY DATE(updated_at)
         ),
         by_status AS (
           SELECT status, COUNT(*)::int AS count FROM support_tickets GROUP BY status
         )
         SELECT d.day,
                COALESCE(c.created_count,0) AS created_count,
                COALESCE(r.resolved_count,0) AS resolved_count,
                (SELECT json_agg(json_build_object('status', s.status, 'count', s.count)) FROM by_status s) AS by_status
         FROM days d
         LEFT JOIN created c ON c.day = d.day
         LEFT JOIN resolved r ON r.day = d.day
         ORDER BY d.day ASC`,
        [period]
      );

      const byDay = series.rows.map(r => ({ day: r.day, created_count: r.created_count, resolved_count: r.resolved_count }));
      const byStatus = (series.rows[0]?.by_status) || [];
      res.json({ success: true, data: { byDay, byStatus, period } });
    } catch (error) {
      next(error);
    }
  }

  // ================== Tickets ==================
  // GET /api/admin/support/tickets
  static async listTickets(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 1000));
      const rows = await query(
        `SELECT id, title, description, status, priority, 'general'::text AS classification,
                NULL::text AS school_name, NULL::text AS school_logo,
                ''::text AS submitted_by, assigned_to::text, created_at, updated_at,
                NULL::timestamptz AS last_response_at, 0::int AS response_count, NULL::timestamptz AS estimated_resolution
         FROM support_tickets
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      res.json({ success: true, data: rows.rows });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/admin/support/tickets/:id
  static async getTicket(req, res, next) {
    try {
      const { id } = req.params;
      const t = await query(`SELECT * FROM support_tickets WHERE id = $1`, [id]);
      if (t.rows.length === 0) return res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
      const messages = await query(`SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`, [id]);
      const data = { ...t.rows[0], messages: messages.rows };
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/admin/support/tickets/:id
  static async updateTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { status, priority, assigned_to } = req.body || {};
      const fields = [];
      const params = [];
      if (status) { params.push(status); fields.push(`status = $${params.length}`); }
      if (priority) { params.push(priority); fields.push(`priority = $${params.length}`); }
      if (assigned_to) { params.push(assigned_to); fields.push(`assigned_to = $${params.length}`); }
      if (fields.length === 0) return res.json({ success: true, data: { updated: false } });
      params.push(id);
      await query(`UPDATE support_tickets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
      res.json({ success: true, data: { updated: true } });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/admin/support/tickets/:id/status
  static async updateTicketStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      await query(`UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // POST /api/admin/support/tickets/:id/messages
  static async addTicketMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { body, direction = 'out', channel = 'in_app' } = req.body || {};
      const ins = await query(`INSERT INTO support_ticket_messages (ticket_id, body, direction, channel) VALUES ($1,$2,$3,$4) RETURNING *`, [id, body, direction, channel]);
      await query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [id]);
      res.json({ success: true, data: ins.rows[0] });
    } catch (error) { next(error); }
  }

  // ================== Knowledge Base ==================
  // GET /api/admin/support/kb
  static async listKB(req, res, next) {
    try {
      const { q = '', categoryId, mpesaRelated, schoolType } = req.query || {};
      const clauses = [];
      const params = [];
      if (q) {
        params.push(`%${q}%`, `%${q}%`);
        clauses.push(`(title ILIKE $${params.length - 1} OR content ILIKE $${params.length})`);
      }
      if (categoryId) { params.push(categoryId); clauses.push(`category_id = $${params.length}`); }
      if (schoolType && schoolType !== 'all') { params.push(schoolType); clauses.push(`school_type = $${params.length}`); }
      if (mpesaRelated === 'true') clauses.push(`mpesa_related = true`);
      if (mpesaRelated === 'false') clauses.push(`mpesa_related = false`);
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await query(`SELECT * FROM kb_articles ${where} ORDER BY created_at DESC LIMIT 200`, params);
      res.json({ success: true, data: rows.rows });
    } catch (error) { next(error); }
  }

  // GET /api/admin/support/kb/categories
  static async listKBCategories(req, res, next) {
    try {
      const rows = await query(`SELECT * FROM kb_categories ORDER BY name ASC`);
      res.json({ success: true, data: rows.rows });
    } catch (error) { next(error); }
  }

  // POST /api/admin/support/kb
  static async createKBArticle(req, res, next) {
    try {
      const { title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots } = req.body || {};
      const ins = await query(
        `INSERT INTO kb_articles (title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [title, content, category_id || null, school_type || null, issue_tags || null, !!mpesa_related, video_urls || null, screenshots || null]
      );
      res.json({ success: true, data: ins.rows[0] });
    } catch (error) { next(error); }
  }

  // PUT /api/admin/support/kb/:id
  static async updateKBArticle(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots } = req.body || {};
      await query(
        `UPDATE kb_articles
         SET title = COALESCE($1, title),
             content = COALESCE($2, content),
             category_id = COALESCE($3, category_id),
             school_type = COALESCE($4, school_type),
             issue_tags = COALESCE($5, issue_tags),
             mpesa_related = COALESCE($6, mpesa_related),
             video_urls = COALESCE($7, video_urls),
             screenshots = COALESCE($8, screenshots),
             updated_at = NOW()
         WHERE id = $9`,
        [title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots, id]
      );
      const sel = await query(`SELECT * FROM kb_articles WHERE id = $1`, [id]);
      res.json({ success: true, data: sel.rows[0] });
    } catch (error) { next(error); }
  }

  // DELETE /api/admin/support/kb/:id
  static async deleteKBArticle(req, res, next) {
    try {
      const { id } = req.params;
      await query(`DELETE FROM kb_articles WHERE id = $1`, [id]);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // ================== Training ==================
  // GET /api/admin/support/training/history
  static async trainingHistory(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 1000));
      const rows = await query(
        `SELECT id, school_id, topic, scheduled_at, status, duration_minutes, trainer, notes, created_at
         FROM training_records
         ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
         LIMIT $1`,
        [limit]
      );
      // Enrich with school name when possible
      const out = [];
      for (const r of rows.rows) {
        const s = r.school_id ? await query(`SELECT name FROM schools WHERE id = $1`, [r.school_id]) : { rows: [] };
        out.push({ ...r, school_name: s.rows[0]?.name || null });
      }
      res.json({ success: true, data: out });
    } catch (error) { next(error); }
  }

  // POST /api/admin/support/schools/:schoolId/quick-actions/trigger-training
  static async triggerTraining(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { topic, scheduledAt, duration, trainer, notes } = req.body || {};
      const ins = await query(
        `INSERT INTO training_records (school_id, topic, scheduled_at, duration_minutes, trainer, notes)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [schoolId, topic, scheduledAt, parseInt(duration || '60', 10), trainer || null, notes || null]
      );
      res.json({ success: true, data: ins.rows[0] });
    } catch (error) { next(error); }
  }

  // PATCH /api/admin/support/training/:id/status
  static async updateTrainingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      await query(`UPDATE training_records SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // ================== Onboarding ==================
  // GET /api/admin/multi-school/onboarding
  static async listOnboarding(req, res, next) {
    try {
      const limit = Math.max(1, Math.min(parseInt(req.query.limit || '100', 10), 1000));
      // Select common fields with safe fallbacks
      const rows = await query(
        `SELECT
           id,
           COALESCE(request_number, id::text) AS request_number,
           COALESCE(s.name, school_name) AS school_name,
           principal_name,
           principal_email,
           principal_phone,
           region_name,
           region_id,
           school_type,
           curriculum_type,
           expected_students,
           expected_staff,
           preferred_plan,
           submitted_at,
           status,
           priority,
           COALESCE(documents_count, 0) AS documents_count,
           documents_submitted,
           last_updated,
           estimated_completion,
           assigned_to,
           assigned_admin_name,
           notes,
           internal_notes
         FROM school_onboarding_requests r
         LEFT JOIN schools s ON s.id = r.school_id
         ORDER BY submitted_at DESC NULLS LAST, last_updated DESC NULLS LAST
         LIMIT $1`,
        [limit]
      );
      res.json({ success: true, data: rows.rows });
    } catch (error) { next(error); }
  }

  // PATCH /api/admin/multi-school/onboarding/:id/status
  static async updateOnboardingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body || {};
      await query(`UPDATE school_onboarding_requests SET status = COALESCE($1, status), notes = COALESCE($2, notes), last_updated = NOW() WHERE id = $3`, [status || null, notes || null, id]);
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // POST /api/admin/multi-school/onboarding/:id/notes
  static async addOnboardingNote(req, res, next) {
    try {
      const { id } = req.params;
      const { note, is_internal } = req.body || {};
      if (is_internal) {
        await query(`UPDATE school_onboarding_requests SET internal_notes = CONCAT(COALESCE(internal_notes,''), CASE WHEN internal_notes IS NULL OR internal_notes = '' THEN '' ELSE E'\n' END, $1), last_updated = NOW() WHERE id = $2`, [note, id]);
      } else {
        await query(`UPDATE school_onboarding_requests SET notes = CONCAT(COALESCE(notes,''), CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END, $1), last_updated = NOW() WHERE id = $2`, [note, id]);
      }
      res.json({ success: true });
    } catch (error) { next(error); }
  }

  // PATCH /api/admin/multi-school/onboarding/bulk-status
  static async bulkUpdateOnboardingStatus(req, res, next) {
    try {
      const { ids = [], status } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true, data: { updated: 0 } });
      await query(`UPDATE school_onboarding_requests SET status = $1, last_updated = NOW() WHERE id = ANY($2::uuid[])`, [status, ids]);
      res.json({ success: true, data: { updated: ids.length } });
    } catch (error) { next(error); }
  }
}

module.exports = SupportHRController;


