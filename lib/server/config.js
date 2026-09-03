import 'dotenv/config';

export const config = {
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
    dbName: process.env.MONGODB_DB || 'jd_outreach',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    s3Bucket: process.env.S3_BUCKET_RESUMES || 'jd-outreach-resumes',
  },
  bedrock: {
    modelId: process.env.BEDROCK_MODEL_ID || 'openai.gpt-oss-120b',
    mantleEndpoint: process.env.BEDROCK_MANTLE_ENDPOINT || 'https://bedrock-mantle.us-east-1.api.aws/v1',
  },
  tinyfish: {
    apiKey: process.env.TINYFISH_API_KEY || '',
    apiBase: process.env.TINYFISH_API_BASE || 'https://api.fetch.tinyfish.ai',
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
  },
  appUrl: (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  adminEmails: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  credits: {
    welcomeFreeCredits: process.env.WELCOME_FREE_CREDITS
      ? parseInt(process.env.WELCOME_FREE_CREDITS, 10)
      : 5,
    generationCreditCost: 1,
  },
  emailVerificationExpiryMinutes: process.env.EMAIL_VERIFICATION_EXPIRY_MINUTES
    ? parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_MINUTES, 10)
    : 30,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || 'Outreach <noreply@wavyai.in>',
  },
};
