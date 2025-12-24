import { betterAuth } from 'better-auth';
import { openAPI } from 'better-auth/plugins';
import { remultAdapter } from '@nerdfolio/remult-better-auth';
import { authEntities } from '../authEntities';

export const auth = betterAuth({
	database: remultAdapter({
		authEntities,
		usePlural: true
	}),

	user: {
		additionalFields: {
			roles: { type: 'string[]' }
		}
	},

	// config example:
	emailAndPassword: {
		enabled: true
	},

	plugins: [
		openAPI({
			path: '/api/auth/reference',
			disableDefaultReference: true
		})
	]
});
