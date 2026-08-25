import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.js';

const globalForS3 = globalThis;
const s3 = globalForS3.__jdOutreachS3Client || new S3Client({ region: config.aws.region });
if (process.env.NODE_ENV !== 'production') globalForS3.__jdOutreachS3Client = s3;

export async function uploadResume({ userId, filename, contentType, buffer }) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `resumes/${userId}/${Date.now()}-${safeName}`;
  await s3.send(new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  }));
  return { key, bucket: config.aws.s3Bucket };
}
