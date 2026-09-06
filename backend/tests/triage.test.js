jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Minor rear-end collision with bumper damage.',
              category: 'auto',
              priority: 'low',
            }),
          },
        ],
      }),
    },
  }))
);

const request = require('supertest');
const app = require('../src/app');
const { connect, clearDB, disconnect } = require('./helpers/db');

beforeAll(connect);
afterEach(clearDB);
afterAll(disconnect);

async function registerUser(overrides = {}) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    email: 'user@example.com',
    password: 'password123',
    ...overrides,
  });
  return { token: res.body.token, user: res.body.user };
}

describe('POST /api/claims/:id/triage', () => {
  it('rejects an employee (adjuster-only)', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });

    const created = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    const res = await request(app)
      .post(`/api/claims/${created.body._id}/triage`)
      .set('Authorization', `Bearer ${employee.token}`);

    expect(res.status).toBe(403);
  });

  it('lets an adjuster triage a claim and stores the AI summary', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });
    const adjuster = await registerUser({ email: 'adjuster@example.com', role: 'adjuster' });

    const created = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Rear-ended at a stoplight', amount: 1200 });

    const res = await request(app)
      .post(`/api/claims/${created.body._id}/triage`)
      .set('Authorization', `Bearer ${adjuster.token}`);

    expect(res.status).toBe(200);
    expect(res.body.aiSummary).toBe('Minor rear-end collision with bumper damage.');
    expect(res.body.aiCategory).toBe('auto');
    expect(res.body.aiPriority).toBe('low');
  });

  it('returns 404 for a nonexistent claim', async () => {
    const adjuster = await registerUser({ email: 'adjuster@example.com', role: 'adjuster' });

    const res = await request(app)
      .post('/api/claims/64b64b64b64b64b64b64b64b/triage')
      .set('Authorization', `Bearer ${adjuster.token}`);

    expect(res.status).toBe(404);
  });
});
