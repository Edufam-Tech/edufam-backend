const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');

// Import controllers
const CommunicationController = require('../controllers/communicationController');

// Message Routes
router.post('/messages/send', 
  authenticate, 
  CommunicationController.sendMessage
);

router.get('/messages/:type', 
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