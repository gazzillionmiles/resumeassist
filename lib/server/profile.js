/**
 * Helper utilities for Profile completeness and validation.
 */

/**
 * Checks if a profile document is complete.
 * A complete profile requires:
 * 1. An uploaded & parsed resume (resume_structured or resume_s3_key or resume_filename)
 * 2. Current title (non-empty)
 * 3. Location (non-empty)
 * 4. Current CTC (non-empty)
 * 5. Expected CTC (non-empty)
 * 6. Notice period (non-empty)
 * Note: Work authorization has been removed.
 *
 * @param {object|null} profile
 * @returns {boolean}
 */
export function isProfileComplete(profile) {
  if (!profile) return false;

  const hasResume = Boolean(
    profile.resume_structured ||
    profile.resume_s3_key ||
    profile.resume_filename
  );

  const currentTitle = (profile.current_title ?? profile.currentTitle ?? '').trim();
  const location = (profile.location ?? '').trim();
  const currentCtc = (profile.current_ctc ?? profile.currentCtc ?? '').trim();
  const expectedCtc = (profile.expected_ctc ?? profile.expectedCtc ?? '').trim();
  const noticePeriod = (profile.notice_period ?? profile.noticePeriod ?? '').trim();

  return Boolean(
    hasResume &&
    currentTitle &&
    location &&
    currentCtc &&
    expectedCtc &&
    noticePeriod
  );
}

/**
 * Returns a list of missing required fields for an incomplete profile.
 *
 * @param {object|null} profile
 * @returns {string[]}
 */
export function getMissingProfileFields(profile) {
  const missing = [];
  if (!profile) {
    return ['resume', 'current_title', 'location', 'current_ctc', 'expected_ctc', 'notice_period'];
  }

  if (!profile.resume_structured && !profile.resume_s3_key && !profile.resume_filename) {
    missing.push('resume');
  }
  if (!(profile.current_title ?? profile.currentTitle ?? '').trim()) {
    missing.push('current_title');
  }
  if (!(profile.location ?? '').trim()) {
    missing.push('location');
  }
  if (!(profile.current_ctc ?? profile.currentCtc ?? '').trim()) {
    missing.push('current_ctc');
  }
  if (!(profile.expected_ctc ?? profile.expectedCtc ?? '').trim()) {
    missing.push('expected_ctc');
  }
  if (!(profile.notice_period ?? profile.noticePeriod ?? '').trim()) {
    missing.push('notice_period');
  }

  return missing;
}
