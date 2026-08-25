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
};
