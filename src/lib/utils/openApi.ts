import type { ClassType } from "remult";
import type { RemultSveltekitServer } from "remult/remult-sveltekit";

// Remult internal symbols for accessing BackendMethod metadata
const classBackendMethodsArray = Symbol.for('classBackendMethodsArray');
const serverActionField = Symbol.for('serverActionField');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string | symbol, any>;

// Generate OpenAPI doc with controller methods included
export function getOpenApiDoc(api: RemultSveltekitServer, controllers: ClassType<unknown>[]) {
	const spec = api.openApiDoc({ title: 'remult-planets', version: '1.0.0' });

	// Add controller BackendMethods to the spec
	for (const controller of controllers) {
		const methods = (controller as AnyObj)[classBackendMethodsArray];
		if (methods) {
			for (const method of methods) {
				const action = (method as AnyObj)[serverActionField];
				if (action?.actionUrl) {
					const path = `/api/${action.actionUrl}`;
					spec.paths[path] = {
						post: {
							tags: [controller.name],
							summary: action.actionUrl.split('/').pop(),
							description: `Backend method: ${action.actionUrl}`,
							requestBody: {
								content: {
									'application/json': {
										schema: { type: 'object' }
									}
								}
							},
							responses: {
								'200': {
									description: 'Successful response',
									content: {
										'application/json': {
											schema: { type: 'object' }
										}
									}
								},
								'400': { description: 'Bad Request' },
								'401': { description: 'Unauthorized' },
								'403': { description: 'Forbidden' },
								'500': { description: 'Internal Server Error' }
							},
							security: [{ bearerAuth: [] }]
						}
					};
				}
			}
		}
	}

	return spec;
}