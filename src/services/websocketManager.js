const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * WebSocket Manager (Simplified)
 * Core WebSocket connection management
 */
class WebSocketManager {
  constructor() {
    this.io = null;
    this.connections = new Map();
    this.userConnections = new Map();
    this.schoolConnections = new Map();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];
    const envOrigin = process.env.FRONTEND_URL;
    const allowedOrigins = Array.isArray(envOrigin)
      ? envOrigin
      : envOrigin
      ? [envOrigin, ...defaultOrigins]
      : defaultOrigins;

    this.io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    console.log('✅ WebSocket server initialized');
    return this.io;
  }

  /**
   * Set up basic event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', async (socket) => {
      try {
        const user = await this.authenticateConnection(socket);
        if (user) {
          await this.handleConnection(socket, user);
        } else {
          socket.disconnect(true);
        }
      } catch (error) {
        console.error('Connection error:', error);
        socket.disconnect(true);
      }
    });
  }

  /**
   * Authenticate connection
   */
  async authenticateConnection(socket) {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return null;

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const userResult = await query(`
        SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.school_id, s.name as school_name
        FROM users u
        LEFT JOIN schools s ON s.id = u.school_id
        WHERE u.id = $1 AND u.is_active = true
      `, [decoded.userId]);

      if (userResult.rows.length === 0) return null;

      const user = userResult.rows[0];
      return {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        role: user.role,
        schoolId: user.school_id,
        schoolName: user.school_name
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Handle new connection
   */
  async handleConnection(socket, user) {
    // Store connection info
    const connectionInfo = {
      socketId: socket.id,
      userId: user.id,
      schoolId: user.schoolId,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(socket.id, connectionInfo);

    // Index by user
    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id).add(socket.id);

    // Index by school
    if (!this.schoolConnections.has(user.schoolId)) {
      this.schoolConnections.set(user.schoolId, new Set());
    }
    this.schoolConnections.get(user.schoolId).add(socket.id);

    // Join rooms
    socket.join(`user:${user.id}`);
    socket.join(`school:${user.schoolId}`);
    socket.join(`role:${user.role}`);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket.id);
    });

    // Send welcome
    socket.emit('connected', {
      userId: user.id,
      schoolId: user.schoolId,
      timestamp: new Date().toISOString()
    });

    console.log(`✅ User ${user.id} connected`);
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(socketId) {
    const connectionInfo = this.connections.get(socketId);
    if (!connectionInfo) return;

    // Remove from indexes
    this.connections.delete(socketId);
    
    if (this.userConnections.has(connectionInfo.userId)) {
      this.userConnections.get(connectionInfo.userId).delete(socketId);
    }

    if (this.schoolConnections.has(connectionInfo.schoolId)) {
      this.schoolConnections.get(connectionInfo.schoolId).delete(socketId);
    }

    console.log(`❌ User ${connectionInfo.userId} disconnected`);
  }

  /**
   * Broadcast to users
   */
  async broadcastToUsers(userIds, event, data, options = {}) {
    const deliveries = [];
    
    for (const userId of userIds) {
      const userConnections = this.userConnections.get(userId);
      if (userConnections && userConnections.size > 0) {
        for (const socketId of userConnections) {
          const socket = this.io.sockets.sockets.get(socketId);
          if (socket && socket.connected) {
            socket.emit(event, {
              ...data,
              timestamp: new Date().toISOString()
            });
            deliveries.push({ userId, status: 'delivered' });
          }
        }
      } else {
        deliveries.push({ userId, status: 'failed', errorMessage: 'User not connected' });
      }
    }

    return deliveries;
  }

  /**
   * Broadcast to school
   */
  async broadcastToSchool(schoolId, event, data) {
    this.io.to(`school:${schoolId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast to role
   */
  async broadcastToRole(role, event, data, schoolId = null) {
    const room = schoolId ? `school:${schoolId}` : `role:${role}`;
    this.io.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connection metrics
   */
  getMetrics() {
    return {
      totalConnections: this.connections.size,
      userConnections: this.userConnections.size,
      schoolConnections: this.schoolConnections.size
    };
  }
}

module.exports = new WebSocketManager();