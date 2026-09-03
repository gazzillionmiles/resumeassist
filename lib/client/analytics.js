'use client';

import posthog from 'posthog-js';

let initialized = false;

/**
 * Initializes PostHog client-side telemetry.
 */
export function initAnalytics() {
  if (typeof window === 'undefined' || initialized) return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (posthogKey) {
    try {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        autocapture: false,
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: true,
        mask_all_element_attributes: true,
        mask_all_text: true,
        sanitize_properties: (properties) => {
          // Privacy boundary: strip any accidental resume content, prompt, or sensitive keys
          const forbiddenKeys = [
            'password',
            'token',
            'rawtext',
            'jd_raw_text',
            'resume_raw_text',
            'resumetext',
            'emailbody',
            'prompt',
            'messages',
          ];
          for (const key of Object.keys(properties)) {
            if (forbiddenKeys.some((f) => key.toLowerCase().includes(f))) {
              delete properties[key];
            }
          }
          return properties;
        },
      });
      initialized = true;
    } catch (err) {
      console.warn('[Analytics] Failed to initialize PostHog:', err);
    }
  }
}

function canTrack() {
  if (typeof window === 'undefined') return false;
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}

/**
 * Safely capture an analytics event.
 *
 * @param {string} eventName
 * @param {object} [properties]
 */
export function captureEvent(eventName, properties = {}) {
  if (!canTrack()) return;
  try {
    posthog.capture(eventName, properties);
  } catch (err) {
    console.warn(`[Analytics] Error capturing ${eventName}:`, err);
  }
}

/**
 * Identify user on signup/login.
 *
 * @param {string} userId
 */
export function identifyUser(userId) {
  if (!canTrack() || !userId) return;
  try {
    posthog.identify(userId);
  } catch (err) {
    console.warn('[Analytics] identify error:', err);
  }
}

/**
 * Reset user identity on logout.
 */
export function resetUser() {
  if (!canTrack()) return;
  try {
    posthog.reset();
  } catch (err) {
    console.warn('[Analytics] reset error:', err);
  }
}

// ----------------------------------------------------------------------
// Dedicated Product Event Helpers
// ----------------------------------------------------------------------

export const analytics = {
  signup: (method = 'email') => captureEvent('signup_completed', { auth_method: method }),
  login: (method = 'email') => captureEvent('login_completed', { auth_method: method }),
  generationStarted: (props = {}) => captureEvent('generation_started', props),
  generationCompleted: (props = {}) => captureEvent('generation_completed', props),
  generationFailed: (props = {}) => captureEvent('generation_failed', props),
  companyOutreachStarted: (props = {}) => captureEvent('company_outreach_started', props),
  companyOutreachCompleted: (props = {}) => captureEvent('company_outreach_completed', props),
  paymentWallViewed: (props = {}) => captureEvent('payment_wall_viewed', props),
  paymentWallClicked: (props = {}) => captureEvent('payment_wall_clicked', props),
  creditExhausted: (props = {}) => captureEvent('credit_exhausted', props),
  resumeUploaded: (props = {}) => captureEvent('resume_uploaded', props),
  jobUrlSubmitted: (props = {}) => captureEvent('job_url_submitted', props),
  contactSearchStarted: (props = {}) => captureEvent('contact_search_started', props),
  contactSelected: (props = {}) => captureEvent('contact_selected', props),
};
