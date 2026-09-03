import { getCollections } from './db/mongodb.js';
import { toObjectId } from './db/ids.js';

export const TERMS_CONSENT_EVENT_TYPE = 'terms_accepted';
export const TERMS_CONSENT_VERSION = process.env.TERMS_CONSENT_VERSION || '2026-v1';

export function getConsentEventMetadata(headers) {
  if (!headers) return { ipAddress: 'unknown', userAgent: 'unknown' };
  const getHeader = (name) => {
    if (typeof headers.get === 'function') return headers.get(name);
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  const forwardedFor = getHeader('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || getHeader('x-real-ip') || 'unknown';
  const userAgent = getHeader('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

export function isTermsConsentCurrent(consent) {
  return Boolean(consent && consent.consent_version === TERMS_CONSENT_VERSION);
}

export async function findLatestTermsConsentEvent(userId) {
  const { consentEvents } = await getCollections();
  const event = await consentEvents.findOne(
    {
      user_id: userId.toString(),
      event_type: TERMS_CONSENT_EVENT_TYPE,
    },
    {
      sort: { created_at: -1 },
    }
  );
  return event;
}

export async function hasUserAcceptedTerms(userId) {
  const latest = await findLatestTermsConsentEvent(userId);
  return isTermsConsentCurrent(latest);
}

export async function insertTermsConsentEvent({
  userId,
  provider = 'email',
  headers,
  ipAddress: explicitIp,
  userAgent: explicitUa,
}) {
  const { users, consentEvents } = await getCollections();
  const metadata = getConsentEventMetadata(headers);
  const ipAddress = explicitIp || metadata.ipAddress;
  const userAgent = explicitUa || metadata.userAgent;

  const now = new Date();
  const eventDoc = {
    user_id: userId.toString(),
    event_type: TERMS_CONSENT_EVENT_TYPE,
    consent_version: TERMS_CONSENT_VERSION,
    ip_address: ipAddress,
    user_agent: userAgent,
    auth_provider: provider || 'email',
    created_at: now,
  };

  await consentEvents.insertOne(eventDoc);

  // Also update user document flags for fast checking
  await users.updateOne(
    { _id: toObjectId(userId) },
    {
      $set: {
        has_terms_consent: true,
        terms_consent_version: TERMS_CONSENT_VERSION,
        terms_consented_at: now,
        updated_at: now,
      },
    }
  );

  return eventDoc;
}
