import { Planet } from '$lib/entites/planets';
import { SqlDatabase } from 'remult';
import { remultApi } from 'remult/remult-sveltekit';
import { TursoDataProvider } from 'remult/remult-turso';
import { createClient } from '@libsql/client';
import { env } from '$env/dynamic/private';

export const api = remultApi({
	entities: [Planet],
	admin: true,
	dataProvider: new SqlDatabase(
		new TursoDataProvider(
			createClient({
				url: env.TURSO_DATABASE_URL,
				authToken: env.TURSO_AUTH_TOKEN
			})
		)
	)
});

export const openApiDocument = api.openApiDoc({ title: 'remult-planets' });
