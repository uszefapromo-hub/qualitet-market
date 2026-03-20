'use strict';

const request = require('supertest');

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

describe('production runtime config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('warns but does not crash production startup without JWT_SECRET', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: '',
      ALLOWED_ORIGINS: 'https://uszefaqualitet.pl',
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => require('../src/app')).not.toThrow();
      const warnMessages = warnSpy.mock.calls.flat().join(' ');
      expect(warnMessages).toContain('JWT_SECRET');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('warns but does not crash production startup without ALLOWED_ORIGINS', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-secret',
      ALLOWED_ORIGINS: '',
    };

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => require('../src/app')).not.toThrow();
      const warnMessages = warnSpy.mock.calls.flat().join(' ');
      expect(warnMessages).toContain('ALLOWED_ORIGINS');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects requests from origins outside the production allowlist', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-secret',
      ALLOWED_ORIGINS: 'https://uszefaqualitet.pl',
    };

    const app = require('../src/app');
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'CORS policy: origin not allowed' });
  });

  it('allows requests from configured production origins', async () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'super-secure-production-secret',
      ALLOWED_ORIGINS: 'https://uszefaqualitet.pl',
    };

    const app = require('../src/app');
    const res = await request(app)
      .get('/health')
      .set('Origin', 'https://uszefaqualitet.pl');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://uszefaqualitet.pl');
  });
});
