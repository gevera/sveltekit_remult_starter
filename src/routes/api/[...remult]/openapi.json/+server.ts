import { json } from '@sveltejs/kit';
import { openApiDocument } from '$server/api';

export const GET = ({ locals }) => {
	if (!locals.user || !locals.session) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	} else {
		return json(openApiDocument);
	}
};
