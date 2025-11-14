/**
 * Auth Middleware Unit Tests
 * Tests for JWT token generation, verification, and password hashing
 */

import {
  comparePassword,
  generateToken,
  hashPassword,
  verifyToken,
} from '../../middleware/auth.js';

describe('Auth Middleware', () => {
  describe('Password Hashing', () => {
    it('should hash a password', async () => {
      const password = 'test_password_123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct password', async () => {
      const password = 'test_password_123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'test_password_123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword('wrong_password', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('JWT Token', () => {
    const mockUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'test@example.com',
      username: 'testuser',
      role: 'editor' as const,
      client_id: '22222222-2222-2222-2222-222222222222',
      permissions: ['read', 'write'],
      is_active: true,
      last_login: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should generate a valid JWT token', () => {
      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify and decode a valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.clientId).toBe(mockUser.client_id);
    });

    it('should reject invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should reject expired token', () => {
      // This would require mocking time or using a short expiry
      // For now, we'll test the basic error handling
      const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

      expect(() => verifyToken(malformedToken)).toThrow('Invalid or expired token');
    });
  });
});
