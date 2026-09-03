import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, passwordSchema, PASSWORD_CRITERIA } from '../lib/password.js';

describe('Password Complexity & Validation Suite', () => {
  describe('1. Frontend/Shared Helper: validatePassword', () => {
    it('rejects passwords shorter than 8 characters', () => {
      const res = validatePassword('Ab1!xyz');
      assert.equal(res.valid, false);
      assert.equal(res.checks.minLength, false);
      assert.ok(res.errors.includes('At least 8 characters'));
    });

    it('rejects passwords missing an uppercase letter', () => {
      const res = validatePassword('password123!');
      assert.equal(res.valid, false);
      assert.equal(res.checks.uppercase, false);
      assert.ok(res.errors.includes('One uppercase letter (A-Z)'));
    });

    it('rejects passwords missing a lowercase letter', () => {
      const res = validatePassword('PASSWORD123!');
      assert.equal(res.valid, false);
      assert.equal(res.checks.lowercase, false);
      assert.ok(res.errors.includes('One lowercase letter (a-z)'));
    });

    it('rejects passwords missing a numeric digit', () => {
      const res = validatePassword('Password!@#');
      assert.equal(res.valid, false);
      assert.equal(res.checks.number, false);
      assert.ok(res.errors.includes('One number (0-9)'));
    });

    it('rejects passwords missing a special character', () => {
      const res = validatePassword('Password123');
      assert.equal(res.valid, false);
      assert.equal(res.checks.specialChar, false);
      assert.ok(res.errors.includes('One special character (!@#$%^&*...)'));
    });

    it('accepts compliant passwords meeting all 5 criteria and reports strong strength', () => {
      const res = validatePassword('SecureP@ssw0rd2026!');
      assert.equal(res.valid, true);
      assert.deepEqual(res.errors, []);
      assert.equal(res.checks.minLength, true);
      assert.equal(res.checks.uppercase, true);
      assert.equal(res.checks.lowercase, true);
      assert.equal(res.checks.number, true);
      assert.equal(res.checks.specialChar, true);
      assert.equal(res.strength, 'strong');
      assert.equal(res.score, 100);
    });
  });

  describe('2. Backend Schema: passwordSchema (Zod)', () => {
    it('throws validation error for simple 8-char password with no numbers or symbols', () => {
      assert.throws(() => {
        passwordSchema.parse('password');
      });
    });

    it('throws validation error for password without special character', () => {
      assert.throws(() => {
        passwordSchema.parse('AdminPass123');
      });
    });

    it('successfully parses valid complex password', () => {
      const valid = 'Stron9#Pass!2026';
      const parsed = passwordSchema.parse(valid);
      assert.equal(parsed, valid);
    });
  });
});
