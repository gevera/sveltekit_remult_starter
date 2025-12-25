import { S3mini } from 's3mini';
import { env } from '$env/dynamic/private';

if (!env.R2_ENDPOINT) {
	throw new Error('R2_ENDPOINT environment variable is required');
}

if (!env.R2_ACCESS_KEY_ID) {
	throw new Error('R2_ACCESS_KEY_ID environment variable is required');
}

if (!env.R2_SECRET_ACCESS_KEY) {
	throw new Error('R2_SECRET_ACCESS_KEY environment variable is required');
}

if (!env.R2_BUCKET_NAME) {
	throw new Error('R2_BUCKET_NAME environment variable is required');
}

// Construct endpoint URL with bucket name
// For Cloudflare R2: https://<account-id>.r2.cloudflarestorage.com/<bucket-name>
// s3mini expects the endpoint to include the bucket name in the path
const baseEndpoint = env.R2_ENDPOINT.trim().replace(/\/$/, ''); // Remove trailing slash
const endpointUrl = `${baseEndpoint}/${env.R2_BUCKET_NAME}`;

export const s3Client = new S3mini({
	endpoint: endpointUrl,
	accessKeyId: env.R2_ACCESS_KEY_ID,
	secretAccessKey: env.R2_SECRET_ACCESS_KEY,
	region: env.R2_REGION || 'auto'
});

export const s3BucketName = env.R2_BUCKET_NAME;

