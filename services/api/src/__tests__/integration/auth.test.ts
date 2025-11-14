/**
 * Auth Routes Integration Tests
 * Tests for authentication endpoints with database interaction
 */

import express from 'express';
import request from 'supertest';
import { pool } from '../../config/database.js';
import authRoutes from '../../routes/auth.js';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes Integration', () => {
  // Clean up test data after tests
  afterAll(async () => {
    await pool.end();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'not-an-email',
        password: 'password123',
      });

      expect(response.status).toBe(400);
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid/i);
    });

    // Note: This test requires seeded test data
    it.skip('should return token for valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: 'admin@paragon.local',
        password: 'password',
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('admin@paragon.local');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });
});
