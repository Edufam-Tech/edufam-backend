const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // Store connected clients by userId
    this.rooms = new Map(); // Store room-based connections (e.g., class rooms, school rooms)
  }

  // Initialize WebSocket server
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/api/mobile/ws'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    console.log('WebSocket service initialized');
  }

  // Handle new WebSocket connection
  async handleConnection(ws, req) {
    try {
      // Extract token from query parameters or headers
      const token = this.extractToken(req);
      
      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.userId;

      // Get user details and verify active status
      const user = await query(`
        SELECT id, first_name, last_name, user_type, school_id, is_active
        FROM users WHERE id = $1 AND is_active = true
      `, [userId]);

      if (user.rows.length === 0) {
        ws.close(1008, 'Invalid user');
        return;
      }

      const userData = user.rows[0];

      // Store client connection
      const clientInfo = {
        ws,
        userId,
        userType: userData.user_type,
        schoolId: userData.school_id,
        connectedAt: new Date(),
        lastActivity: new Date()
      };

      this.clients.set(userId, clientInfo);

      // Join user to appropriate rooms
      this.joinUserRooms(userId, userData);

      // Set up message handlers
      ws.on('message', (message) => {
        this.handleMessage(userId, message);
      });

      ws.on('close', () => {
        this.handleDisconnection(userId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for user ${userId}:`, error);
        this.handleDisconnection(userId);
      });

      // Send connection confirmation
      this.sendToUser(userId, {
        type: 'connection_confirmed',
        data: {
          message: 'Connected to real-time updates',
          userId,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`User ${userId} (${userData.user_type}) connected to WebSocket`);

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  // Extract authentication token from request
  extractToken(req) {
    // Try query parameter first
    const url = new URL(req.url, `http://${req.headers.host}`);
    let token = url.searchParams.get('token');

    if (!token) {
      // Try Authorization header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    return token;
  }

  // Join user to relevant rooms based on their role
  joinUserRooms(userId, userData) {
    // All users join their school room
    const schoolRoom = `school_${userData.school_id}`;
    this.joinRoom(userId, schoolRoom);

    // Role-specific rooms
    switch (userData.user_type) {
      case 'school_director':
        this.joinRoom(userId, 'directors');
        break;
      case 'principal':
        this.joinRoom(userId, `principal_${userData.school_id}`);
        this.joinRoom(userId, 'principals');
        break;
      case 'staff':
        this.joinRoom(userId, `staff_${userData.school_id}`);
        // Also join specific class rooms if they're a teacher
        this.joinTeacherClassRooms(userId);
        break;
      case 'parent':
        this.joinRoom(userId, `parents_${userData.school_id}`);
        // Join rooms for their children's classes
        this.joinParentClassRooms(userId);
        break;
      case 'student':
        this.joinRoom(userId, `students_${userData.school_id}`);
        // Join their class room
        this.joinStudentClassRoom(userId);
        break;
    }
  }

  // Join user to a specific room
  joinRoom(userId, roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(userId);
  }

  // Leave user from a specific room
  leaveRoom(userId, roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(userId);
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  // Join teacher to their class rooms
  async joinTeacherClassRooms(userId) {
    try {
      const classes = await query(`
        SELECT DISTINCT class_id 
        FROM teacher_classes 
        WHERE teacher_id = $1 AND is_active = true
      `, [userId]);

      classes.rows.forEach(cls => {
        this.joinRoom(userId, `class_${cls.class_id}`);
      });
    } catch (error) {
      console.error('Error joining teacher class rooms:', error);
    }
  }

  // Join parent to their children's class rooms
  async joinParentClassRooms(userId) {
    try {
      const classes = await query(`
        SELECT DISTINCT s.class_id 
        FROM parent_students ps
        JOIN students s ON ps.student_id = s.id
        WHERE ps.parent_id = $1 AND s.is_active = true
      `, [userId]);

      classes.rows.forEach(cls => {
        this.joinRoom(userId, `class_${cls.class_id}`);
      });
    } catch (error) {
      console.error('Error joining parent class rooms:', error);
    }
  }

  // Join student to their class room
  async joinStudentClassRoom(userId) {
    try {
      const student = await query(`
        SELECT class_id FROM students WHERE id = $1 AND is_active = true
      `, [userId]);

      if (student.rows.length > 0) {
        this.joinRoom(userId, `class_${student.rows[0].class_id}`);
      }
    } catch (error) {
      console.error('Error joining student class room:', error);
    }
  }

  // Handle incoming messages from clients
  handleMessage(userId, message) {
    try {
      const data = JSON.parse(message);
      
      // Update last activity
      if (this.clients.has(userId)) {
        this.clients.get(userId).lastActivity = new Date();
      }

      switch (data.type) {
        case 'ping':
          this.sendToUser(userId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
        
        case 'join_room':
          if (data.roomId) {
            this.joinRoom(userId, data.roomId);
          }
          break;
        
        case 'leave_room':
          if (data.roomId) {
            this.leaveRoom(userId, data.roomId);
          }
          break;
        
        case 'typing':
          // Handle typing indicators for chat
          if (data.conversationId) {
            this.broadcastToRoom(`conversation_${data.conversationId}`, {
              type: 'user_typing',
              data: {
                userId,
                conversationId: data.conversationId,
                isTyping: data.isTyping
              }
            }, userId);
          }
          break;

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Handle client disconnection
  handleDisconnection(userId) {
    // Remove from all rooms
    this.rooms.forEach((users, roomId) => {
      users.delete(userId);
      if (users.size === 0) {
        this.rooms.delete(roomId);
      }
    });

    // Remove client connection
    this.clients.delete(userId);

    console.log(`User ${userId} disconnected from WebSocket`);
  }

  // Send message to specific user
  sendToUser(userId, message) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Error sending message to user ${userId}:`, error);
        this.handleDisconnection(userId);
        return false;
      }
    }
    return false;
  }

  // Send message to multiple users
  sendToUsers(userIds, message) {
    const results = userIds.map(userId => ({
      userId,
      sent: this.sendToUser(userId, message)
    }));
    
    return results;
  }

  // Broadcast message to all users in a room
  broadcastToRoom(roomId, message, excludeUserId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const results = [];
    room.forEach(userId => {
      if (userId !== excludeUserId) {
        const sent = this.sendToUser(userId, message);
        results.push({ userId, sent });
      }
    });

    return results;
  }

  // Broadcast to all users of a specific type
  broadcastToUserType(userType, message, schoolId = null) {
    const results = [];
    
    this.clients.forEach((client, userId) => {
      if (client.userType === userType && (!schoolId || client.schoolId === schoolId)) {
        const sent = this.sendToUser(userId, message);
        results.push({ userId, sent });
      }
    });

    return results;
  }

  // =============================================================================
  // REAL-TIME EVENT HANDLERS
  // =============================================================================

  // Handle grade publication
  handleGradePublished(data) {
    const { studentIds, classId, subjectName, assessmentName } = data;
    
    // Notify students
    studentIds.forEach(studentId => {
      this.sendToUser(studentId, {
        type: 'grade_published',
        data: {
          message: `New ${subjectName} grades available for ${assessmentName}`,
          subject: subjectName,
          assessment: assessmentName,
          timestamp: new Date().toISOString()
        }
      });
    });

    // Notify parents
    this.broadcastToRoom(`class_${classId}`, {
      type: 'grade_published',
      data: {
        message: `New grades published for ${subjectName} - ${assessmentName}`,
        classId,
        subject: subjectName,
        assessment: assessmentName
      }
    });
  }

  // Handle attendance marked
  handleAttendanceMarked(data) {
    const { classId, period, date, summary } = data;
    
    this.broadcastToRoom(`class_${classId}`, {
      type: 'attendance_marked',
      data: {
        message: `Attendance marked for period ${period}`,
        classId,
        period,
        date,
        summary
      }
    });
  }

  // Handle timetable changes
  handleTimetableChanged(data) {
    const { affectedUsers, changes } = data;
    
    affectedUsers.forEach(userId => {
      this.sendToUser(userId, {
        type: 'timetable_changed',
        data: {
          message: 'Your timetable has been updated',
          changes,
          timestamp: new Date().toISOString()
        }
      });
    });
  }

  // Handle fee payment received
  handlePaymentReceived(data) {
    const { studentId, amount, paymentMethod, parentId } = data;
    
    // Notify parent
    if (parentId) {
      this.sendToUser(parentId, {
        type: 'payment_received',
        data: {
          message: `Payment of KES ${amount} received via ${paymentMethod}`,
          amount,
          paymentMethod,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Notify finance team
    this.broadcastToUserType('staff', {
      type: 'payment_received',
      data: {
        message: `New payment received: KES ${amount}`,
        studentId,
        amount,
        paymentMethod
      }
    });
  }

  // Handle approval requests
  handleApprovalRequest(data) {
    const { approvalType, requesterId, schoolId, amount, priority } = data;
    
    // Notify directors and principals
    this.broadcastToUserType('school_director', {
      type: 'approval_requested',
      data: {
        message: `New ${approvalType} approval required`,
        approvalType,
        amount,
        priority,
        timestamp: new Date().toISOString()
      }
    }, schoolId);
    
    this.broadcastToUserType('principal', {
      type: 'approval_requested',
      data: {
        message: `New ${approvalType} approval required`,
        approvalType,
        amount,
        priority
      }
    }, schoolId);
  }

  // Handle emergency alerts
  handleEmergencyAlert(data) {
    const { schoolId, alertType, message, severity } = data;
    
    this.broadcastToRoom(`school_${schoolId}`, {
      type: 'emergency_alert',
      data: {
        alertType,
        message,
        severity,
        timestamp: new Date().toISOString()
      }
    });
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  // Get connection statistics
  getConnectionStats() {
    const stats = {
      totalConnections: this.clients.size,
      userTypes: {},
      rooms: this.rooms.size,
      roomDetails: {}
    };

    // Count by user type
    this.clients.forEach(client => {
      stats.userTypes[client.userType] = (stats.userTypes[client.userType] || 0) + 1;
    });

    // Room details
    this.rooms.forEach((users, roomId) => {
      stats.roomDetails[roomId] = users.size;
    });

    return stats;
  }

  // Clean up inactive connections
  cleanupInactiveConnections() {
    const now = new Date();
    const timeout = 30 * 60 * 1000; // 30 minutes

    this.clients.forEach((client, userId) => {
      if (now - client.lastActivity > timeout) {
        console.log(`Cleaning up inactive connection for user ${userId}`);
        client.ws.close();
        this.handleDisconnection(userId);
      }
    });
  }

  // Send ping to all connected clients (heartbeat)
  sendHeartbeat() {
    const message = {
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    };

    this.clients.forEach((client, userId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.ping();
        } catch (error) {
          console.error(`Error sending ping to user ${userId}:`, error);
          this.handleDisconnection(userId);
        }
      }
    });
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

// Start cleanup and heartbeat intervals
setInterval(() => {
  webSocketService.cleanupInactiveConnections();
}, 5 * 60 * 1000); // Every 5 minutes

setInterval(() => {
  webSocketService.sendHeartbeat();
}, 30 * 1000); // Every 30 seconds

module.exports = webSocketService;