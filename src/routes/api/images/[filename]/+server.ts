import { s3Client } from '$controllers/files/s3Client';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename;

	if (!filename) {
		throw error(400, 'Filename is required');
	}

	try {
		// Get the object response from R2
		const response = await s3Client.getObjectResponse(filename);

		if (!response || !response.ok) {
			throw error(404, 'Image not found');
		}

		// Get content type from response headers or infer from filename
		let contentType = response.headers.get('content-type');
		if (!contentType) {
			const extension = filename.split('.').pop()?.toLowerCase();
			const mimeTypes: Record<string, string> = {
				png: 'image/png',
				jpg: 'image/jpeg',
				jpeg: 'image/jpeg',
				gif: 'image/gif',
				webp: 'image/webp',
				svg: 'image/svg+xml',
				ico: 'image/x-icon'
			};
			contentType = mimeTypes[extension || ''] || 'application/octet-stream';
		}

		// Get the body as a readable stream
		const body = response.body;
		if (!body) {
			throw error(404, 'Image not found');
		}

		// Return the response with proper headers
		return new Response(body, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		// If it's already a SvelteKit error, rethrow it
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(404, 'Image not found');
	}
};

