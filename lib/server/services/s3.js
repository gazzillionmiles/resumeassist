import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
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

export async function deleteUserS3Objects({ userId, specificKey }) {
  try {
    if (specificKey) {
      await s3.send(new DeleteObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: specificKey,
      }));
    }

    // Also list and delete everything under resumes/${userId}/
    const prefix = `resumes/${userId}/`;
    const listRes = await s3.send(new ListObjectsV2Command({
      Bucket: config.aws.s3Bucket,
      Prefix: prefix,
    }));

    if (listRes.Contents && listRes.Contents.length > 0) {
      const objectsToDelete = listRes.Contents.map((obj) => ({ Key: obj.Key }));
      await s3.send(new DeleteObjectsCommand({
        Bucket: config.aws.s3Bucket,
        Delete: { Objects: objectsToDelete },
      }));
    }
  } catch (err) {
    console.error(`[s3] Error deleting S3 objects for user ${userId}:`, err.message);
    // Don't crash caller on S3 deletion error, but log it
  }
}
