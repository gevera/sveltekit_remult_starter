import { FilesController } from '$controllers/files/FilesController';
import type { Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = (async () => {
	const files = await FilesController.listFiles();

	// Convert Remult entities to plain objects for SvelteKit serialization
	const plainFiles = files.map((file) => ({
		key: file.key,
		size: file.size,
		lastModified: file.lastModified,
		etag: file.etag
	}));

	return { files: plainFiles };
}) satisfies PageServerLoad;

export const actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const key = formData.get('key');

		if (typeof key !== 'string') {
			return { error: 'Invalid key' };
		}

		await FilesController.deleteFile(key);
		return { success: true };
	},
	upload: async ({ request }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file');

			if (!(file instanceof File)) {
				return { error: 'No file provided' };
			}

			// Convert file to base64
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			const base64 = buffer.toString('base64');
			const dataUrl = `data:${file.type};base64,${base64}`;

			const fileData = {
				name: file.name,
				type: file.type || 'application/octet-stream',
				data: dataUrl
			};

			await FilesController.uploadFile(fileData);
			return { success: true };
		} catch (error) {
			return { error: error instanceof Error ? error.message : 'Failed to upload file' };
		}
	}
} satisfies Actions;
