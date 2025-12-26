import { FilesController, SampleController } from '$controllers';
import { Planet } from '$entities/planets';
import { env } from '$env/dynamic/private';
import { auth } from '$modules/auth/server/index';
import { createClient } from '@libsql/client';
import { SqlDatabase } from 'remult';
import { remultApi } from 'remult/remult-sveltekit';
import { TursoDataProvider } from 'remult/remult-turso';

// List of controllers to include in OpenAPI
export const controllers = [FilesController, SampleController];

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
	),
	controllers,
	modules: [
		auth({
			// Add some roles to some users with env variable.
			// SUPER_ADMIN_EMAILS
		})
	]
});
