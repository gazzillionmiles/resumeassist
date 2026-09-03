import { z } from 'zod';

export const PASSWORD_CRITERIA = [
  { id: 'minLength', label: 'At least 8 characters', test: (p) => (p || '').length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p || '') },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/.test(p || '') },
  { id: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/.test(p || '') },
  { id: 'specialChar', label: 'One special character (!@#$%^&*...)', test: (p) => /[^A-Za-z0-9]/.test(p || '') },
];

/**
 * Validates a password against complexity rules and calculates a strength score (0 to 100).
 *
 * @param {string} password
 * @returns {{
 *   valid: boolean,
 *   score: number,
 *   strength: 'weak' | 'fair' | 'good' | 'strong',
 *   checks: Record<string, boolean>,
 *   errors: string[]
 * }}
 */
export function validatePassword(password = '') {
  const pwd = String(password || '');
  const checks = {};
  const errors = [];
  let passedCount = 0;

  for (const criterion of PASSWORD_CRITERIA) {
    const passed = criterion.test(pwd);
    checks[criterion.id] = passed;
    if (passed) {
      passedCount += 1;
    } else {
      errors.push(criterion.label);
    }
  }

  // Length bonus for score
  let score = passedCount * 20;
  if (pwd.length >= 12 && passedCount === 5) score = 100;
  else if (pwd.length >= 10 && passedCount >= 4) score = Math.min(score + 10, 95);

  let strength = 'weak';
  if (score >= 80) strength = 'strong';
  else if (score >= 60) strength = 'good';
  else if (score >= 40) strength = 'fair';

  return {
    valid: passedCount === PASSWORD_CRITERIA.length && pwd.length <= 100,
    score,
    strength,
    checks,
    errors,
  };
}

/**
 * Robust Zod schema for backend password validation.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password cannot exceed 100 characters')
  .refine((p) => /[A-Z]/.test(p), { message: 'Password must contain at least one uppercase letter (A-Z)' })
  .refine((p) => /[a-z]/.test(p), { message: 'Password must contain at least one lowercase letter (a-z)' })
  .refine((p) => /[0-9]/.test(p), { message: 'Password must contain at least one number (0-9)' })
  .refine((p) => /[^A-Za-z0-9]/.test(p), { message: 'Password must contain at least one special character (!@#$%^&*...)' });
