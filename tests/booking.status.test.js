process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const request = require('supertest');
const createApp = require('../src/app');

// Isolate this test from real MySQL/Mongo connections by mocking the model
// layer directly: we're verifying the status-transition business rule
// (service + controller + route wiring), not the database itself.
jest.mock('../src/models/mysql/bookingModel');
jest.mock('../src/models/mysql/artistModel');

const bookingModel = require('../src/models/mysql/bookingModel');
const artistModel = require('../src/models/mysql/artistModel');
const { signToken } = require('../src/utils/jwt');

describe('PATCH /bookings/:id/status', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 422 with a descriptive error for an invalid transition', async () => {
    // Booking is already 'completed' — a terminal state — so any further
    // transition (e.g. back to 'confirmed') must be rejected.
    bookingModel.findById.mockResolvedValue({
      id: 1,
      client_id: 10,
      artist_id: 99,
      status: 'completed',
    });
    artistModel.findByUserId.mockResolvedValue({ id: 99, user_id: 42 });

    const artistToken = signToken({ userId: 42, role: 'artist' });

    const res = await request(app)
      .patch('/bookings/1/status')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
    expect(bookingModel.updateStatus).not.toHaveBeenCalled();
  });

  it('allows a valid transition and returns the updated booking', async () => {
    bookingModel.findById.mockResolvedValue({
      id: 2,
      client_id: 10,
      artist_id: 99,
      status: 'pending',
    });
    artistModel.findByUserId.mockResolvedValue({ id: 99, user_id: 42 });
    bookingModel.updateStatus.mockResolvedValue({
      id: 2,
      client_id: 10,
      artist_id: 99,
      status: 'confirmed',
    });

    const artistToken = signToken({ userId: 42, role: 'artist' });

    const res = await request(app)
      .patch('/bookings/2/status')
      .set('Authorization', `Bearer ${artistToken}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('confirmed');
  });
});
