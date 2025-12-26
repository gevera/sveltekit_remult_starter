import { getOpenApiDoc } from '$lib/utils/openApi';
import { api, controllers } from '$server/api.js';
import { json } from '@sveltejs/kit';

export const GET = ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	return json(getOpenApiDoc(api, controllers));
};
