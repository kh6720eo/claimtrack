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

describe('claims access control', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/claims');
    expect(res.status).toBe(401);
  });

  it('lets an employee create and view only their own claims', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });
    const otherEmployee = await registerUser({ email: 'other@example.com' });

    await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${otherEmployee.token}`)
      .send({ description: 'Water damage', amount: 2000 });

    const res = await request(app)
      .get('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe('Fender bender');
  });

  it('lets an adjuster view all claims', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });
    const adjuster = await registerUser({ email: 'adjuster@example.com', role: 'adjuster' });

    await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    const res = await request(app)
      .get('/api/claims')
      .set('Authorization', `Bearer ${adjuster.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('forbids an employee from updating claim status', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });

    const created = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    const res = await request(app)
      .put(`/api/claims/${created.body._id}/status`)
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(403);
  });

  it('lets an adjuster update claim status', async () => {
    const employee = await registerUser({ email: 'employee@example.com' });
    const adjuster = await registerUser({ email: 'adjuster@example.com', role: 'adjuster' });

    const created = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    const res = await request(app)
      .put(`/api/claims/${created.body._id}/status`)
      .set('Authorization', `Bearer ${adjuster.token}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it("hides other employees' claims from getClaimById with a 404", async () => {
    const employee = await registerUser({ email: 'employee@example.com' });
    const otherEmployee = await registerUser({ email: 'other@example.com' });

    const created = await request(app)
      .post('/api/claims')
      .set('Authorization', `Bearer ${employee.token}`)
      .send({ description: 'Fender bender', amount: 500 });

    const res = await request(app)
      .get(`/api/claims/${created.body._id}`)
      .set('Authorization', `Bearer ${otherEmployee.token}`);

    expect(res.status).toBe(404);
  });
});
