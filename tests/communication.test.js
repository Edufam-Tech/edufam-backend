const request = require('supertest');
const app = require('../server');
const TestSetup = require('./setup');

describe('Communication Module Tests', () => {
  let testSchool, testUser, testToken;

  beforeAll(async () => {
    await TestSetup.setupTestDatabase();
    
    // Create test school and user
    testSchool = await TestSetup.createTestSchool();
    testUser = await TestSetup.createTestUser(testSchool.id, 'teacher');
    testToken = TestSetup.generateJWTToken(testUser);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestDatabase();
  });

  describe('Messages', () => {
    test('should send a message successfully', async () => {
      const recipient = await TestSetup.createTestUser(testSchool.id, 'student');
      
      const messageData = {
        title: 'Test Message',
        content: 'This is a test message',
        type: 'message',
        recipients: [recipient.id],
        recipientType: 'user'
      };

      const response = await request(app)
        .post('/api/communication/messages/send')
        .set('Authorization', `Bearer ${testToken}`)
        .send(messageData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(messageData.title);
      expect(response.body.data.content).toBe(messageData.content);
    });

    test('should get inbox messages', async () => {
      const response = await request(app)
        .get('/api/communication/messages/inbox')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should get outbox messages', async () => {
      const response = await request(app)
        .get('/api/communication/messages/outbox')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should fail to send message without required fields', async () => {
      const messageData = {
        title: 'Test Message'
        // Missing content and recipients
      };

      const response = await request(app)
        .post('/api/communication/messages/send')
        .set('Authorization', `Bearer ${testToken}`)
        .send(messageData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Announcements', () => {
    test('should create an announcement successfully', async () => {
      const announcementData = {
        title: 'Test Announcement',
        content: 'This is a test announcement',
        targetAudience: 'all',
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/communication/announcements')
        .set('Authorization', `Bearer ${testToken}`)
        .send(announcementData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(announcementData.title);
    });

    test('should get announcements', async () => {
      const response = await request(app)
        .get('/api/communication/announcements')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should update an announcement', async () => {
      // First create an announcement
      const createResponse = await request(app)
        .post('/api/communication/announcements')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: 'Original Title',
          content: 'Original content',
          targetAudience: 'teachers'
        });

      const announcementId = createResponse.body.data.id;

      // Then update it
      const updateData = {
        title: 'Updated Title',
        content: 'Updated content'
      };

      const response = await request(app)
        .put(`/api/communication/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
    });

    test('should delete an announcement', async () => {
      // First create an announcement
      const createResponse = await request(app)
        .post('/api/communication/announcements')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: 'To Delete',
          content: 'This will be deleted',
          targetAudience: 'students'
        });

      const announcementId = createResponse.body.data.id;

      // Then delete it
      const response = await request(app)
        .delete(`/api/communication/announcements/${announcementId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Notifications', () => {
    test('should send a notification successfully', async () => {
      const recipient = await TestSetup.createTestUser(testSchool.id, 'parent');
      
      const notificationData = {
        title: 'Test Notification',
        content: 'This is a test notification',
        type: 'general',
        recipients: [recipient.id]
      };

      const response = await request(app)
        .post('/api/communication/notifications/send')
        .set('Authorization', `Bearer ${testToken}`)
        .send(notificationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(notificationData.title);
    });

    test('should get notifications', async () => {
      const response = await request(app)
        .get('/api/communication/notifications')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Settings', () => {
    test('should get communication settings', async () => {
      const response = await request(app)
        .get('/api/communication/settings')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should update communication settings', async () => {
      const settingsData = {
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
        autoReminders: true,
        reminderFrequency: 'weekly'
      };

      const response = await request(app)
        .put('/api/communication/settings')
        .set('Authorization', `Bearer ${testToken}`)
        .send(settingsData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email_notifications).toBe(settingsData.emailNotifications);
    });
  });

  describe('Authorization', () => {
    test('should require authentication for protected routes', async () => {
      await request(app)
        .post('/api/communication/messages/send')
        .send({
          title: 'Test',
          content: 'Test',
          recipients: ['test']
        })
        .expect(401);
    });

    test('should require proper role for announcement creation', async () => {
      const studentUser = await TestSetup.createTestUser(testSchool.id, 'student');
      const studentToken = TestSetup.generateJWTToken(studentUser);

      await request(app)
        .post('/api/communication/announcements')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          title: 'Test Announcement',
          content: 'Test content'
        })
        .expect(403);
    });
  });
});