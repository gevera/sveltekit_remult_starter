import { ScalarApiReference } from '@scalar/sveltekit';
import type { RequestHandler } from './$types';
const render = ScalarApiReference({
	url: '/api/openapi.json'
});
export const GET: RequestHandler = () => {
	return render();
};
