const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const CommunicationController = require('../controllers/communicationController');
const { query } = require('../config/database');

// Message Routes
router.post('/messages/send', 
  authenticate, 
  CommunicationController.sendMessage
);

// Recipient directory for messaging (exclude director)
router.get('/messages/users',
  authenticate,
  CommunicationController.getMessagingUsers
);

// Conversations (threads)
// Note: we use message_threads + thread_participants under the hood
router.get('/messages/conversations', authenticate, CommunicationController.getConversations);
router.post(
  '/messages/conversations',
  authenticate,
  requireRole(['principal','teacher','hr','finance','parent']),
  CommunicationController.createConversation
);
router.get('/messages/conversations/:conversationId', authenticate, CommunicationController.getConversationDetails);
router.post(
  '/messages/conversations/:conversationId/messages',
  authenticate,
  requireRole(['principal','teacher','hr','finance','parent']),
  CommunicationController.sendThreadMessage
);
router.post(
  '/messages/conversations/:conversationId/participants',
  authenticate,
  requireRole(['principal','teacher','hr','finance','parent']),
  CommunicationController.addParticipant
);
router.delete(
  '/messages/conversations/:conversationId/participants/:userId',
  authenticate,
  requireRole(['principal','teacher','hr','finance','parent']),
  CommunicationController.removeParticipant
);

// Conversation history (mobile convenience endpoint)
router.get('/messages/history/:conversationId', authenticate, CommunicationController.getConversationHistory);

// Restrict to valid boxes to prevent matching other subpaths like 'conversations'
router.get('/messages/:box(inbox|outbox)', 
  authenticate, 
  CommunicationController.getMessages
);

router.get('/message/:id', 
  authenticate, 
  CommunicationController.getMessage
);

router.put('/message/:id/read', 
  authenticate, 
  CommunicationController.markAsRead
);

router.delete('/message/:id', 
  authenticate, 
  CommunicationController.deleteMessage
);

// Announcement Routes
router.post('/announcements', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director', 'admin']), 
  CommunicationController.createAnnouncement
);

router.get('/announcements', 
  authenticate, 
  CommunicationController.getAnnouncements
);

// Recent announcements helper to match mobile client expectations
router.get('/announcements/recent',
  authenticate,
  async (req, res, next) => {
    try {
      const days = parseInt(req.query.days || '7', 10);
      const adminOnly = req.query.admin_only === 'true';
      
      let sql = `
        SELECT 
          a.id,
          a.title,
          a.content AS message,
          a.created_at,
          a.target_audience,
          a.priority,
          a.is_urgent,
          u.first_name || ' ' || u.last_name as created_by_name,
          u.role as created_by_role
        FROM announcements a
        JOIN users u ON a.created_by = u.id
        WHERE a.school_id = $1
          AND a.created_at >= CURRENT_DATE - INTERVAL '${days} days'
      `;
      
      const params = [req.user.schoolId];
      
      if (adminOnly) {
        sql += ` AND u.role = 'super_admin'`;
      }
      
      sql += ` ORDER BY a.is_urgent DESC, a.created_at DESC LIMIT 20`;
      
      const result = await query(sql, params);
      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  }
);

router.put('/announcements/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director', 'admin']), 
  CommunicationController.updateAnnouncement
);

router.delete('/announcements/:id', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director', 'admin']), 
  CommunicationController.deleteAnnouncement
);

// Notification Routes
router.post('/notifications/send', 
  authenticate, 
  requireRole(['teacher', 'principal', 'school_director', 'admin']), 
  CommunicationController.sendNotification
);

router.get('/notifications', 
  authenticate, 
  CommunicationController.getNotifications
);

router.put('/notifications/:id/read', 
  authenticate, 
  CommunicationController.markNotificationAsRead
);

// Unread notifications helper to match mobile client expectations
router.get('/notifications/unread',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await query(`
        SELECT id, type, title, message, created_at
        FROM notifications
        WHERE user_id = $1 AND (is_read = false OR is_read IS NULL)
        ORDER BY created_at DESC
        LIMIT 50
      `, [req.user.userId]);
      res.json({ success: true, data: result.rows });
    } catch (error) { next(error); }
  }
);

// Settings Routes
router.get('/settings', 
  authenticate, 
  CommunicationController.getCommunicationSettings
);

router.put('/settings', 
  authenticate, 
  requireRole(['principal', 'school_director', 'admin']), 
  CommunicationController.updateCommunicationSettings
);


module.exports = router;