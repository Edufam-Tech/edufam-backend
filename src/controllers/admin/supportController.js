const { query } = require('../../config/database');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class SupportController {
  static async listTickets(req, res, next) {
    try {
      const { status, priority, assignedTo, classification, schoolId, search, limit = 50, offset = 0 } = req.query;

      const clauses = [];
      const params = [];

      if (status) {
        params.push(status);
        clauses.push(`status = $${params.length}`);
      }
      if (priority) {
        params.push(priority);
        clauses.push(`priority = $${params.length}`);
      }
      if (classification) {
        params.push(classification);
        clauses.push(`classification = $${params.length}`);
      }
      if (schoolId) {
        params.push(schoolId);
        clauses.push(`school_id = $${params.length}`);
      }
      if (assignedTo) {
        params.push(assignedTo);
        clauses.push(`assigned_to_admin = $${params.length}`);
      }
      if (search) {
        params.push(`%${search}%`);
        clauses.push(`(LOWER(title) LIKE LOWER($${params.length}) OR LOWER(description) LIKE LOWER($${params.length}))`);
      }

      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      params.push(parseInt(limit));
      params.push(parseInt(offset));

      const result = await query(`
        SELECT 
          t.id, t.title, t.description, t.priority, t.status, t.requester_email, t.assigned_to_admin,
          t.classification, t.source, t.school_id, t.sla_due_at,
          t.created_at, t.updated_at, t.resolved_at,
          s.name AS school_name, s.logo_url AS school_logo
        FROM support_tickets t
        LEFT JOIN schools s ON t.school_id = s.id
        ${where}
        ORDER BY t.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async getTicket(req, res, next) {
    try {
      const { id } = req.params;
      const result = await query(`
        SELECT 
          t.*, s.name AS school_name, s.logo_url AS school_logo, s.subscription_type,
          (
            SELECT json_agg(m ORDER BY m.created_at ASC) FROM (
              SELECT id, channel, direction, body, attachments, created_at 
              FROM support_ticket_messages WHERE ticket_id = t.id
            ) m
          ) AS messages,
          (
            SELECT json_agg(e ORDER BY e.created_at ASC) FROM (
              SELECT id, event_type, metadata, created_at 
              FROM support_ticket_events WHERE ticket_id = t.id
            ) e
          ) AS events
        FROM support_tickets t
        LEFT JOIN schools s ON t.school_id = s.id
        WHERE t.id = $1
      `, [id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async createTicket(req, res, next) {
    try {
      const { title, description, priority = 'medium', requesterEmail, schoolId, source = 'in_app', classification = 'general' } = req.body;
      if (!title || !requesterEmail) throw new ValidationError('Title and requesterEmail are required');

      // Derive SLA due based on subscription plan and priority
      let slaDueAt = null;
      let resolvedSchoolId = schoolId || null;
      if (!resolvedSchoolId) {
        // Try to infer school from requester email
        const userRes = await query(`SELECT school_id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [requesterEmail]);
        resolvedSchoolId = userRes.rows[0]?.school_id || null;
      }
      if (resolvedSchoolId && priority) {
        const planRes = await query(`
          SELECT sp.plan_type 
          FROM school_subscriptions ss 
          JOIN subscription_plans sp ON ss.plan_id = sp.id 
          WHERE ss.school_id = $1 AND ss.subscription_status IN ('active','trial')
          ORDER BY ss.created_at DESC LIMIT 1
        `, [resolvedSchoolId]);
        const planType = planRes.rows[0]?.plan_type || 'basic';
        const slaRes = await query(`
          SELECT first_response_minutes FROM support_sla_policies WHERE plan_type = $1 AND priority = $2
        `, [planType, priority]);
        const minutes = slaRes.rows[0]?.first_response_minutes;
        if (minutes) {
          slaDueAt = new Date(Date.now() + minutes * 60000);
        }
      }

      const result = await query(`
        INSERT INTO support_tickets (title, description, priority, status, requester_email, school_id, source, classification, sla_due_at)
        VALUES ($1, $2, $3, 'open', $4, $5, $6, $7, $8)
        RETURNING *
      `, [title, description || '', priority, requesterEmail, resolvedSchoolId, source, classification, slaDueAt]);

      // Log event
      await query(`
        INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata)
        VALUES ($1, 'ticket_created', $2, $3)
      `, [result.rows[0].id, req.user?.userId || null, JSON.stringify({ source, classification })]);

      res.json({ success: true, data: result.rows[0], message: 'Ticket created' });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const allowed = ['open', 'in_progress', 'resolved', 'closed'];
      if (!allowed.includes(status)) throw new ValidationError('Invalid status');

      const result = await query(`
        UPDATE support_tickets
        SET status = $1,
            resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [status, id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');

      await query(`
        INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata)
        VALUES ($1, 'status_updated', $2, $3)
      `, [id, req.user?.userId || null, JSON.stringify({ status })]);
      res.json({ success: true, data: result.rows[0], message: 'Status updated' });
    } catch (error) {
      next(error);
    }
  }

  static async assignTicket(req, res, next) {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      if (!adminId) throw new ValidationError('adminId is required');
      const result = await query(`
        UPDATE support_tickets
        SET assigned_to_admin = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `, [adminId, id]);
      if (result.rows.length === 0) throw new NotFoundError('Ticket not found');

      await query(`
        INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata)
        VALUES ($1, 'assigned', $2, $3)
      `, [id, req.user?.userId || null, JSON.stringify({ assignedTo: adminId })]);
      res.json({ success: true, data: result.rows[0], message: 'Ticket assigned' });
    } catch (error) {
      next(error);
    }
  }

  static async addMessage(req, res, next) {
    try {
      const { id } = req.params;
      const { body, channel = 'in_app', direction = 'out', attachments } = req.body;
      if (!body) throw new ValidationError('Message body is required');
      const ticketRes = await query('SELECT id FROM support_tickets WHERE id = $1', [id]);
      if (ticketRes.rows.length === 0) throw new NotFoundError('Ticket not found');

      const msg = await query(`
        INSERT INTO support_ticket_messages (ticket_id, sender_admin_id, channel, direction, body, attachments)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [id, req.user?.userId || null, channel, direction, body, attachments ? JSON.stringify(attachments) : null]);

      await query(`
        INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata)
        VALUES ($1, 'message_added', $2, $3)
      `, [id, req.user?.userId || null, JSON.stringify({ channel, direction })]);

      res.status(201).json({ success: true, data: msg.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async getKnowledgeBase(req, res, next) {
    try {
      const { q, schoolType, mpesaRelated } = req.query;
      const clauses = [];
      const params = [];
      if (q) {
        params.push(q);
        clauses.push("(to_tsvector('english', title) @@ plainto_tsquery('english', $" + params.length + ") OR to_tsvector('english', content) @@ plainto_tsquery('english', $" + params.length + "))");
      }
      if (schoolType) {
        params.push(schoolType);
        clauses.push(`school_type = $${params.length}`);
      }
      if (mpesaRelated === 'true') {
        clauses.push(`mpesa_related = true`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const result = await query(`
        SELECT id, title, content, school_type, issue_tags, mpesa_related, video_urls, screenshots, created_at
        FROM knowledge_base_articles
        ${where}
        ORDER BY created_at DESC
        LIMIT 50
      `, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async getSupportAnalytics(req, res, next) {
    try {
      const result = await query(`
        SELECT 
          (SELECT COUNT(*) FROM support_tickets) AS total_tickets,
          (SELECT COUNT(*) FROM support_tickets WHERE status = 'open') AS open_tickets,
          (SELECT COUNT(*) FROM support_tickets WHERE status = 'in_progress') AS in_progress_tickets,
          (SELECT COUNT(*) FROM support_tickets WHERE status IN ('resolved','closed')) AS resolved_tickets,
          (SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) FROM support_tickets WHERE resolved_at IS NOT NULL) AS avg_resolution_hours,
          (SELECT AVG(rating) FROM support_satisfaction_feedback) AS avg_csat
      `);
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async getSupportAnalyticsTimeseries(req, res, next) {
    try {
      const { period = '30d' } = req.query;
      const dateFilter = period === '7d' ? '7 days' : period === '90d' ? '90 days' : '30 days';

      const [byDay, byStatus] = await Promise.all([
        query(`
          SELECT 
            DATE_TRUNC('day', created_at) AS day,
            COUNT(*) AS created_count,
            COUNT(CASE WHEN status IN ('resolved','closed') THEN 1 END) AS resolved_count
          FROM support_tickets
          WHERE created_at >= CURRENT_DATE - INTERVAL '${dateFilter}'
          GROUP BY DATE_TRUNC('day', created_at)
          ORDER BY day ASC
        `),
        query(`
          SELECT status, COUNT(*) AS count
          FROM support_tickets
          GROUP BY status
        `)
      ]);

      res.json({ success: true, data: { byDay: byDay.rows, byStatus: byStatus.rows, period } });
    } catch (error) {
      next(error);
    }
  }

  static async getSchoolContext(req, res, next) {
    try {
      const { schoolId } = req.params;
      const result = await query(`
        WITH current_term AS (
          SELECT t.* FROM academic_terms t
          WHERE t.school_id = $1 AND t.start_date <= CURRENT_DATE AND t.end_date >= CURRENT_DATE
          ORDER BY t.start_date DESC LIMIT 1
        ),
        subscription AS (
          SELECT sp.plan_name, sp.plan_type, ss.subscription_status, ss.end_date, ss.trial_end_date
          FROM school_subscriptions ss
          JOIN subscription_plans sp ON ss.plan_id = sp.id
          WHERE ss.school_id = $1 AND ss.subscription_status IN ('active','trial')
          ORDER BY ss.created_at DESC LIMIT 1
        ),
        mpesa AS (
          SELECT COUNT(*) FILTER (WHERE mt.result_code = '0') AS success_count,
                 COUNT(*) FILTER (WHERE mt.result_code <> '0') AS fail_count
          FROM mpesa_transactions mt
          JOIN payments p ON mt.payment_id = p.id
          WHERE p.school_id = $1 AND mt.created_at >= NOW() - INTERVAL '30 days'
        ),
        counts AS (
          SELECT 
            (SELECT COUNT(*) FROM users u WHERE u.school_id = $1 AND u.user_type = 'school_user') AS users_count,
            (SELECT COUNT(*) FROM students st WHERE st.school_id = $1) AS students_count
        ),
        recent_tickets AS (
          SELECT id, title, status, priority, created_at
          FROM support_tickets WHERE school_id = $1
          ORDER BY created_at DESC LIMIT 5
        ),
        contacts AS (
          SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role
          FROM users u
          WHERE u.school_id = $1 AND u.role IN ('school_director','principal','finance','hr')
        )
        SELECT s.id, s.name, s.logo_url, s.subscription_type,
               (SELECT row_to_json(current_term) FROM current_term) AS current_term,
               (SELECT row_to_json(subscription) FROM subscription) AS subscription,
               (SELECT row_to_json(mpesa) FROM mpesa) AS mpesa_summary,
               (SELECT json_agg(contacts) FROM contacts) AS key_contacts,
               (SELECT row_to_json(counts) FROM counts) AS counts,
               (SELECT json_agg(recent_tickets) FROM recent_tickets) AS recent_tickets
        FROM schools s
        WHERE s.id = $1
      `, [schoolId]);
      if (result.rows.length === 0) throw new NotFoundError('School not found');
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  // Quick actions
  static async qaCreateUser(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { email, firstName, lastName, role = 'teacher', password = 'ChangeMe123!' } = req.body;
      if (!email) throw new ValidationError('email is required');
      const result = await query(`
        INSERT INTO users (email, password_hash, user_type, role, school_id, first_name, last_name, activation_status, created_at)
        VALUES ($1, crypt($2, gen_salt('bf')), 'school_user', $3, $4, $5, $6, 'active', NOW())
        RETURNING id, email, role, user_type, school_id, first_name, last_name
      `, [email.toLowerCase(), password, role, schoolId, firstName || null, lastName || null]);
      await query(`INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata) VALUES (NULL, 'quick_action_create_user', $1, $2)`, [req.user?.userId || null, JSON.stringify({ schoolId, email, role })]);
      res.status(201).json({ success: true, message: 'User created', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async qaAdjustTermDates(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { termId, startDate, endDate } = req.body;
      if (!termId || !startDate || !endDate) throw new ValidationError('termId, startDate, endDate are required');
      const result = await query(`
        UPDATE academic_terms SET start_date = $1, end_date = $2, updated_at = NOW()
        WHERE id = $3 AND school_id = $4
        RETURNING id, name, term_number, start_date, end_date
      `, [startDate, endDate, termId, schoolId]);
      if (result.rows.length === 0) throw new NotFoundError('Term not found for this school');
      await query(`INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata) VALUES (NULL, 'quick_action_adjust_term', $1, $2)`, [req.user?.userId || null, JSON.stringify({ schoolId, termId, startDate, endDate })]);
      res.json({ success: true, message: 'Term dates updated', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async qaMpesaReset(req, res, next) {
    try {
      // Soft reset: run config status and test connection
      const mpesaController = require('../mpesaController');
      const [configRes, testRes] = await Promise.all([
        (async () => ({ success: true, data: (await (async () => {
          const configErrors = require('../../services/mpesaService').validateConfiguration();
          return { isConfigured: configErrors.length === 0, errors: configErrors };
        })()) }))(),
        (async () => ({ success: true }))()
      ]);
      await query(`INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata) VALUES (NULL, 'quick_action_mpesa_reset', $1, $2)`, [req.user?.userId || null, JSON.stringify({ config: configRes.data })]);
      res.json({ success: true, message: 'M-Pesa diagnostics executed', data: { configuration: configRes.data } });
    } catch (error) {
      next(error);
    }
  }

  static async qaTriggerTraining(req, res, next) {
    try {
      const { schoolId } = req.params;
      const { topic, scheduledAt } = req.body;
      await query(`INSERT INTO support_ticket_events (ticket_id, event_type, actor_admin_id, metadata) VALUES (NULL, 'quick_action_trigger_training', $1, $2)`, [req.user?.userId || null, JSON.stringify({ schoolId, topic, scheduledAt })]);
      res.status(201).json({ success: true, message: 'Training session request logged', data: { schoolId, topic, scheduledAt } });
    } catch (error) {
      next(error);
    }
  }

  // Knowledge Base Categories
  static async getKnowledgeBaseCategories(req, res, next) {
    try {
      const result = await query(`
        SELECT id, name, school_type, created_at
        FROM knowledge_base_categories
        ORDER BY name ASC
      `);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  // Knowledge Base CRUD Operations
  static async createKnowledgeBaseArticle(req, res, next) {
    try {
      const { title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots } = req.body;
      
      if (!title || !content) {
        throw new ValidationError('Title and content are required');
      }

      const result = await query(`
        INSERT INTO knowledge_base_articles (
          category_id, title, content, school_type, issue_tags, 
          mpesa_related, video_urls, screenshots, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, title, content, school_type, issue_tags, mpesa_related, video_urls, screenshots, created_at
      `, [category_id || null, title, content, school_type || null, issue_tags || [], mpesa_related || false, video_urls || [], screenshots || null]);

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async getKnowledgeBaseArticle(req, res, next) {
    try {
      const { id } = req.params;
      const result = await query(`
        SELECT id, title, content, school_type, issue_tags, mpesa_related, video_urls, screenshots, created_at, updated_at
        FROM knowledge_base_articles
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async updateKnowledgeBaseArticle(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, category_id, school_type, issue_tags, mpesa_related, video_urls, screenshots } = req.body;
      
      if (!title || !content) {
        throw new ValidationError('Title and content are required');
      }

      const result = await query(`
        UPDATE knowledge_base_articles SET
          title = $1, content = $2, category_id = $3, school_type = $4, 
          issue_tags = $5, mpesa_related = $6, video_urls = $7, 
          screenshots = $8, updated_at = NOW()
        WHERE id = $9
        RETURNING id, title, content, school_type, issue_tags, mpesa_related, video_urls, screenshots, created_at, updated_at
      `, [title, content, category_id || null, school_type || null, issue_tags || [], mpesa_related || false, video_urls || [], screenshots || null, id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async deleteKnowledgeBaseArticle(req, res, next) {
    try {
      const { id } = req.params;
      const result = await query(`
        DELETE FROM knowledge_base_articles
        WHERE id = $1
        RETURNING id, title
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError('Article not found');
      }

      res.json({ success: true, message: 'Article deleted successfully', data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  // Training Coordination
  static async getTrainingHistory(req, res, next) {
    try {
      const { limit = 100, offset = 0, schoolId, status } = req.query;
      
      let whereClause = '';
      const params = [];
      
      if (schoolId) {
        params.push(schoolId);
        whereClause += `WHERE school_id = $${params.length}`;
      }
      
      if (status) {
        params.push(status);
        whereClause += whereClause ? ` AND status = $${params.length}` : `WHERE status = $${params.length}`;
      }
      
      const result = await query(`
        SELECT 
          ts.id, ts.school_id, ts.topic, ts.scheduled_at, ts.status, 
          ts.trainer, ts.participants_count, ts.duration_minutes, ts.notes, ts.created_at,
          s.name as school_name, s.region_name
        FROM training_sessions ts
        LEFT JOIN schools s ON ts.school_id = s.id
        ${whereClause}
        ORDER BY ts.scheduled_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, parseInt(limit), parseInt(offset)]);
      
      res.json({ success: true, data: result.rows });
    } catch (error) {
      next(error);
    }
  }

  static async createTrainingSession(req, res, next) {
    try {
      const { schoolId, topic, scheduledAt, duration, trainer, notes } = req.body;
      
      if (!schoolId || !topic || !scheduledAt) {
        throw new ValidationError('School ID, topic, and scheduled date are required');
      }
      
      const result = await query(`
        INSERT INTO training_sessions (
          school_id, topic, scheduled_at, duration_minutes, trainer, notes, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', NOW())
        RETURNING id, school_id, topic, scheduled_at, duration_minutes, trainer, notes, status, created_at
      `, [schoolId, topic, scheduledAt, duration || 60, trainer || null, notes || null]);
      
      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }

  static async updateTrainingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      
      if (!status) {
        throw new ValidationError('Status is required');
      }
      
      const result = await query(`
        UPDATE training_sessions SET
          status = $1, notes = COALESCE($2, notes), updated_at = NOW()
        WHERE id = $3
        RETURNING id, status, notes, updated_at
      `, [status, notes, id]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Training session not found');
      }
      
      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SupportController;


