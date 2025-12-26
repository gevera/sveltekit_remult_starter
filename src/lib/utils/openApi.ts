import type { ClassType } from 'remult';
import { getFields } from 'remult';
import type { RemultSveltekitServer } from 'remult/remult-sveltekit';
import { match } from 'ts-pattern';
import { pipe, filter, map, find, flatMap } from 'remeda';

// Remult internal symbols for accessing BackendMethod metadata
const classBackendMethodsArray = Symbol.for('classBackendMethodsArray');
const serverActionField = Symbol.for('serverActionField');
const returnTypeSymbol = Symbol.for('returnType');
const controllerReturnTypesMap = Symbol.for('controllerReturnTypesMap');
const parameterTypeSymbol = Symbol.for('parameterType');
const controllerParameterTypesMap = Symbol.for('controllerParameterTypesMap');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string | symbol, any>;

type PrimitiveType = 'string' | 'number' | 'boolean' | 'object';
type TypeMetadata = { type?: PrimitiveType; schema?: ClassType<unknown>; isArray?: boolean; optional?: boolean };
type OpenApiSchema = { type?: string; items?: unknown; properties?: unknown; required?: string[]; oneOf?: unknown[]; description?: string; format?: string };

/**
 * Convert a Remult class schema to OpenAPI schema
 */
function classToOpenApiSchema(schemaClass: ClassType<unknown>): OpenApiSchema {
	try {
		const instance = new schemaClass();
		const fieldsRef = getFields(instance);
		const fieldsArray = Array.from(fieldsRef);
		
		const fieldSchemas = pipe(
			fieldsArray,
			map((fieldRef) => {
				const { metadata } = fieldRef;
				const fieldKey = metadata.key as string;
				const valueType = metadata.valueType;
				
				const { type, format } = match(valueType)
					.when((v) => v === Number, () => ({ type: 'number' as const, format: undefined as string | undefined }))
					.when((v) => v === Boolean, () => ({ type: 'boolean' as const, format: undefined as string | undefined }))
					.when((v) => v === Date, () => ({ type: 'string' as const, format: 'date-time' as string }))
					.otherwise(() => ({ type: 'string' as const, format: undefined as string | undefined }));

				const schema = match(format)
					.with(undefined, () => ({ type }))
					.otherwise(() => ({ type, format }));

				return {
					key: fieldKey,
					schema,
					required: metadata.options.required ?? false
				};
			})
		);

		const properties = Object.fromEntries(
			fieldSchemas.map(({ key, schema }) => [key, schema])
		);

		const required = pipe(
			fieldSchemas,
			filter((f) => f.required),
			map((f) => f.key)
		);

		return match(required.length > 0)
			.with(true, () => ({
				type: 'object',
				properties,
				required
			}))
			.otherwise(() => ({
				type: 'object',
				properties
			}));
	} catch {
		return { type: 'object' };
	}
}

/**
 * Generic helper to get metadata from various sources
 */
function getMetadata(
	method: unknown,
	controller: ClassType<unknown>,
	methodName: string,
	symbol: symbol,
	mapSymbol: symbol
): unknown {
	const map = (controller as AnyObj)[mapSymbol] as Map<string, unknown> | undefined;
	const controllerMethod = (controller as AnyObj)[methodName];
	const methodFn = (method as AnyObj).fn;

	const sources = [
		map?.get(methodName),
		(method as AnyObj)[symbol],
		controllerMethod ? (controllerMethod as AnyObj)[symbol] : undefined,
		methodFn ? (methodFn as AnyObj)[symbol] : undefined
	];

	return find(sources, (v) => v !== undefined) ?? undefined;
}

/**
 * Convert type metadata to OpenAPI schema
 */
function typeToSchema(metadata: TypeMetadata): OpenApiSchema {
	return match(metadata)
		.when((m) => Boolean(m.isArray && m.schema), (m) => ({ type: 'array', items: classToOpenApiSchema(m.schema!) }))
		.when((m) => Boolean(m.schema), (m) => classToOpenApiSchema(m.schema!))
		.when((m) => Boolean(m.type), (m) => ({ type: m.type! }))
		.otherwise(() => ({ type: 'object' }));
}

/**
 * Automatically infer OpenAPI response schema from backend method return type
 */
function inferResponseSchema(
	method: unknown,
	controller: ClassType<unknown>,
	methodName: string
): OpenApiSchema {
	const methodMetadata = getMetadata(
		method,
		controller,
		methodName,
		returnTypeSymbol,
		controllerReturnTypesMap
	) as TypeMetadata | undefined;

	return match(methodMetadata)
		.with(undefined, () => ({ type: 'object' }))
		.when((m) => Boolean(m.isArray && m.schema), (m) => ({ type: 'array', items: classToOpenApiSchema(m.schema!) }))
		.when((m) => Boolean(m.schema), (m) => classToOpenApiSchema(m.schema!))
		.when((m) => Boolean(m.type), (m) => ({ type: m.type! }))
		.otherwise(() => ({ type: 'object' }));
}

/**
 * Automatically infer OpenAPI request schema from backend method parameter types
 * Remult backend methods receive arguments in the format: { "args": [...] }
 */
function inferRequestSchema(
	method: unknown,
	controller: ClassType<unknown>,
	methodName: string
): { type: string; properties?: unknown; required?: string[] } {
	const methodMetadata = getMetadata(
		method,
		controller,
		methodName,
		parameterTypeSymbol,
		controllerParameterTypesMap
	) as TypeMetadata | TypeMetadata[] | undefined;

	return match(methodMetadata)
		.with(undefined, () => ({
			type: 'object',
			properties: {
				args: {
					type: 'array',
					items: {},
					description: 'No arguments required (empty array)'
				}
			},
			required: ['args']
		}))
		.otherwise((metadata) => {
			const paramTypes = match(metadata)
				.when((m): m is TypeMetadata[] => Array.isArray(m), (m) => m)
				.otherwise((m) => [m]);
			
			const requiredCount = pipe(
				paramTypes,
				filter((p) => !p.optional),
				(x) => x.length
			);
			
			const argSchemas = map(paramTypes, typeToSchema);
			const argDescriptions = paramTypes.map((p, i) => {
				const typeDesc = p.schema?.name || p.type || 'object';
				return `arg${i}: ${typeDesc}${p.optional ? ' (optional)' : ''}`;
			});

			const itemsSchema = match(argSchemas.length)
				.with(0, () => ({} as OpenApiSchema))
				.with(1, () => argSchemas[0])
				.otherwise(() => {
					const firstSchema = argSchemas[0];
					const allSameType = argSchemas.every((s) => JSON.stringify(s) === JSON.stringify(firstSchema));
					return match(allSameType)
						.with(true, () => firstSchema)
						.otherwise(() => ({
							oneOf: argSchemas,
							description: `Arguments in order: ${argDescriptions.join(', ')}`
						}));
				});

			const description = match(argSchemas.length)
				.with(0, () => 'No arguments required (empty array)')
				.with(1, () => `Method argument: ${argDescriptions[0]}`)
				.otherwise(() => `Method arguments array. Expected order: ${argDescriptions.join(', ')}`);

			return {
				type: 'object',
				properties: {
					args: {
						type: 'array',
						items: itemsSchema,
						...(requiredCount > 0 && { minItems: requiredCount }),
						...(argSchemas.length > 0 && { maxItems: argSchemas.length }),
						description
					}
				},
				required: ['args']
			};
		});
}

/**
 * Helper to store metadata in multiple places for reliable lookup
 */
function storeMetadata(
	target: unknown,
	propertyKey: string,
	descriptor: PropertyDescriptor | undefined,
	metadata: unknown,
	symbol: symbol,
	mapSymbol: symbol
): PropertyDescriptor | undefined {
	const obj = target as AnyObj;
	const method = obj[propertyKey];
	
	match(method)
		.when((m) => Boolean(m), (m) => ((m as AnyObj)[symbol] = metadata))
		.otherwise(() => {});

	match(descriptor?.value)
		.when((v) => Boolean(v), (v) => ((v as AnyObj)[symbol] = metadata))
		.otherwise(() => {});

	match(obj[mapSymbol])
		.with(undefined, () => {
			obj[mapSymbol] = new Map<string, unknown>();
		})
		.otherwise(() => {});
	
	(obj[mapSymbol] as Map<string, unknown>).set(propertyKey, metadata);
	return descriptor;
}

/**
 * Decorator to declare the return type of a backend method for OpenAPI generation
 * Use this decorator on backend methods to automatically generate correct OpenAPI schemas
 *
 * @example
 * class MyController {
 *   @BackendMethod({ allowed: true })
 *   @Returns({ type: 'string' })
 *   static async getString() { return 'hello'; }
 *
 *   @BackendMethod({ allowed: true })
 *   @Returns({ schema: MySchema })
 *   static async getData() { return new MySchema(); }
 *
 *   @BackendMethod({ allowed: true })
 *   @Returns({ schema: MySchema, isArray: true })
 *   static async getList() { return [new MySchema()]; }
 * }
 */
export function Returns(
	returnType: { type: PrimitiveType } | { schema: ClassType<unknown>; isArray?: boolean }
) {
	return (target: unknown, propertyKey: string, descriptor?: PropertyDescriptor) =>
		storeMetadata(target, propertyKey, descriptor, returnType, returnTypeSymbol, controllerReturnTypesMap);
}

/**
 * Decorator to declare the parameter/request body type of a backend method for OpenAPI generation
 * Use this decorator on backend methods to automatically generate correct OpenAPI request schemas
 * 
 * Remult backend methods receive arguments in the format: { "args": [...] }
 * 
 * @example
 * // Single parameter
 * class MyController {
 *   @BackendMethod({ allowed: true })
 *   @Accepts({ type: 'string' })
 *   static async processString(data: string) { return 'processed'; }
 *
 *   @BackendMethod({ allowed: true })
 *   @Accepts({ schema: MySchema })
 *   static async processData(data: MySchema) { return new MySchema(); }
 * }
 * 
 * @example
 * // Multiple parameters
 * class MyController {
 *   @BackendMethod({ allowed: true })
 *   @Accepts([
 *     { schema: FileDataSchema },
 *     { type: 'string', optional: true }
 *   ])
 *   static async uploadFile(fileData: FileDataSchema, path?: string) { ... }
 * }
 */
export function Accepts(
	parameterTypes: TypeMetadata | TypeMetadata[]
) {
	return (target: unknown, propertyKey: string, descriptor?: PropertyDescriptor) => {
		const paramTypesArray = match(parameterTypes)
			.when((p): p is TypeMetadata[] => Array.isArray(p), (p) => p)
			.otherwise((p) => [p]);
		return storeMetadata(target, propertyKey, descriptor, paramTypesArray, parameterTypeSymbol, controllerParameterTypesMap);
	};
}

/**
 * Generate OpenAPI doc with controller methods included
 */
export function getOpenApiDoc(api: RemultSveltekitServer, controllers: ClassType<unknown>[]) {
	const spec = api.openApiDoc({ title: 'remult-planets', version: '1.0.0' });

	const methodsWithActions = pipe(
		controllers,
		flatMap((controller) => {
			const methods = (controller as AnyObj)[classBackendMethodsArray] as unknown[] | undefined;
			if (!methods) return [];
			return methods.map((method) => ({
				controller,
				method,
				action: (method as AnyObj)[serverActionField] as { actionUrl?: string } | undefined
			}));
		}),
		filter((item) => item.action?.actionUrl !== undefined)
	);

	for (const { controller, method, action } of methodsWithActions) {
		const actionUrl = action!.actionUrl!;
		const path = `/api/${actionUrl}`;
		const methodName = actionUrl.split('/').pop() || '';
		const inferredSchema = inferResponseSchema(method, controller, methodName);
		const requestSchema = inferRequestSchema(method, controller, methodName);

		spec.paths[path] = {
			post: {
				tags: [controller.name],
				summary: methodName,
				description: `Backend method: ${actionUrl}`,
				requestBody: {
					content: { 'application/json': { schema: requestSchema } }
				},
				responses: {
					'200': {
						description: 'Successful response',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: { data: inferredSchema },
									required: ['data']
								}
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

	return spec;
}
