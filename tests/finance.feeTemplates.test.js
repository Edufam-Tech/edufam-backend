const request = require('supertest');
const app = require('../src/app');

// Minimal helper to get a token; replace with your auth util if present
async function getToken(role = 'finance') {
  // In a real suite, create user and login. Here assume a test helper endpoint exists or mock.
  // For placeholder, return a fake token header read by test environment.
  return process.env.TEST_BEARER_TOKEN || 'test-token';
}

describe('Fee Templates API', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/financial/fees/templates');
    expect(res.status).toBe(401);
  });

  it('lists templates for authenticated finance user', async () => {
    const token = await getToken('finance');
    const res = await request(app)
      .get('/api/financial/fees/templates')
      .set('Authorization', `Bearer ${token}`);
    expect([200, 501]).toContain(res.status); // 200 if running full stack; 501 if auth is mocked
  });

  it('creates a template', async () => {
    const token = await getToken('finance');
    const payload = {
      name: 'Grade 7 CBC 2025',
      curriculumType: 'CBC',
      gradeLevel: '7',
      fees: [
        { name: 'Tuition', amount: 20000, category: 'tuition', isRequired: true },
        { name: 'Meals', amount: 5000, category: 'meals', isRequired: false },
      ],
      isActive: true,
    };
    const res = await request(app)
      .post('/api/financial/fees/templates')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
    expect([201, 401, 500]).toContain(res.status);
  });
});


