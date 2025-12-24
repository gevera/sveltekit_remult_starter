import { ScalarApiReference } from '@scalar/sveltekit';
import type { RequestHandler } from './$types';

const render = ScalarApiReference({
	pageTitle: 'API Documentation',
	sources: [
		{ url: '/api/openapi.json', title: 'Remult API' },
		{ url: '/api/auth/open-api/generate-schema', title: 'Authentication' }
	]
});

export const GET: RequestHandler = () => {
	return render();
};
