import type { ClassType } from 'remult';
import { getFields } from 'remult';
import type { RemultSveltekitServer } from 'remult/remult-sveltekit';

// Remult internal symbols for accessing BackendMethod metadata
const classBackendMethodsArray = Symbol.for('classBackendMethodsArray');
const serverActionField = Symbol.for('serverActionField');
const returnTypeSymbol = Symbol.for('returnType');
const controllerReturnTypesMap = Symbol.for('controllerReturnTypesMap');
const parameterTypeSymbol = Symbol.for('parameterType');
const controllerParameterTypesMap = Symbol.for('controllerParameterTypesMap');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string | symbol, any>;

/**
 * Convert a Remult class schema to OpenAPI schema
 */
function classToOpenApiSchema(schemaClass: ClassType<unknown>) {
	try {
		const instance = new schemaClass();
		const fieldsRef = getFields(instance);
		const properties: Record<string, { type: string; format?: string }> = {};
		const required: string[] = [];

		for (const fieldRef of fieldsRef) {
			const fieldMeta = fieldRef.metadata;
			const fieldKey = fieldMeta.key as string;
			let type = 'string';
			let format: string | undefined;

			// Map Remult field types to OpenAPI types
			if (fieldMeta.valueType === Number) {
				type = 'number';
			} else if (fieldMeta.valueType === Boolean) {
				type = 'boolean';
			} else if (fieldMeta.valueType === Date) {
				type = 'string';
				format = 'date-time';
			}

			properties[fieldKey] = { type, ...(format && { format }) };

			// Check if field is required
			if (fieldMeta.options.required) {
				required.push(fieldKey);
			}
		}

		return {
			type: 'object',
			properties,
			...(required.length > 0 && { required })
		};
	} catch {
		// If schema introspection fails, return generic object
		return { type: 'object' };
	}
}

/**
 * Automatically infer OpenAPI response schema from backend method return type
 */
function inferResponseSchema(
	method: unknown,
	controller: ClassType<unknown>,
	methodName: string
): { type: string; items?: unknown; properties?: unknown; required?: string[] } {
	// First, try to get metadata from the controller's return types map
	// This is the most reliable way since we store it there explicitly
	const returnTypesMap = (controller as AnyObj)[controllerReturnTypesMap] as
		| Map<string, unknown>
		| undefined;
	let methodMetadata = returnTypesMap?.get(methodName) as
		| { type?: string; schema?: ClassType<unknown>; isArray?: boolean }
		| undefined;

	// If not found in map, try to get metadata from the method object (might be a wrapper)
	if (!methodMetadata) {
		methodMetadata = (method as AnyObj)[returnTypeSymbol];
	}

	// If still not found, try to get it from the controller's static method
	if (!methodMetadata) {
		const controllerMethod = (controller as AnyObj)[methodName];
		if (controllerMethod) {
			methodMetadata = (controllerMethod as AnyObj)[returnTypeSymbol];
		}
	}

	// Also check if the method has a 'fn' property (common in wrappers)
	if (!methodMetadata && (method as AnyObj).fn) {
		methodMetadata = ((method as AnyObj).fn as AnyObj)[returnTypeSymbol];
	}

	if (methodMetadata) {
		if (methodMetadata.isArray && methodMetadata.schema) {
			return {
				type: 'array',
				items: classToOpenApiSchema(methodMetadata.schema)
			};
		}
		if (methodMetadata.schema) {
			return classToOpenApiSchema(methodMetadata.schema);
		}
		if (methodMetadata.type === 'string') {
			return { type: 'string' };
		}
		if (methodMetadata.type === 'number') {
			return { type: 'number' };
		}
		if (methodMetadata.type === 'boolean') {
			return { type: 'boolean' };
		}
	}

	// Default to generic object for unknown types
	return { type: 'object' };
}

/**
 * Convert a parameter type definition to OpenAPI schema
 * Always uses the full schema object structure for schema parameters
 */
function parameterTypeToSchema(
	paramType: { type?: string; schema?: ClassType<unknown>; isArray?: boolean; optional?: boolean }
): { type?: string; items?: unknown; properties?: unknown; required?: string[]; oneOf?: unknown[] } {
	if (paramType.isArray && paramType.schema) {
		// For arrays of schemas, always use the full schema object
		return {
			type: 'array',
			items: classToOpenApiSchema(paramType.schema)
		};
	}
	if (paramType.schema) {
		// For schema parameters, always use the full schema object structure
		// This ensures the request body matches the schema definition exactly
		return classToOpenApiSchema(paramType.schema);
	}
	if (paramType.type === 'string') {
		return { type: 'string' };
	}
	if (paramType.type === 'number') {
		return { type: 'number' };
	}
	if (paramType.type === 'boolean') {
		return { type: 'boolean' };
	}
	if (paramType.type === 'object') {
		return { type: 'object' };
	}
	return { type: 'object' };
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
	// First, try to get metadata from the controller's parameter types map
	// This is the most reliable way since we store it there explicitly
	const parameterTypesMap = (controller as AnyObj)[controllerParameterTypesMap] as
		| Map<string, unknown>
		| undefined;
	let methodMetadata = parameterTypesMap?.get(methodName) as
		| Array<{ type?: string; schema?: ClassType<unknown>; isArray?: boolean; optional?: boolean }>
		| { type?: string; schema?: ClassType<unknown>; isArray?: boolean; optional?: boolean }
		| undefined;

	// If not found in map, try to get metadata from the method object (might be a wrapper)
	if (!methodMetadata) {
		methodMetadata = (method as AnyObj)[parameterTypeSymbol];
	}

	// If still not found, try to get it from the controller's static method
	if (!methodMetadata) {
		const controllerMethod = (controller as AnyObj)[methodName];
		if (controllerMethod) {
			methodMetadata = (controllerMethod as AnyObj)[parameterTypeSymbol];
		}
	}

	// Also check if the method has a 'fn' property (common in wrappers)
	if (!methodMetadata && (method as AnyObj).fn) {
		methodMetadata = ((method as AnyObj).fn as AnyObj)[parameterTypeSymbol];
	}

	// Remult backend methods always use { "args": [...] } format
	// Even with no arguments, args must be present as an empty array
	
	// If we have parameter metadata, build the args array schema
	if (methodMetadata) {
		// Check if it's an array (multiple parameters) or single parameter
		const paramTypes = Array.isArray(methodMetadata) ? methodMetadata : [methodMetadata];
		
		// Count required parameters (non-optional ones)
		const requiredCount = paramTypes.filter((p) => !p.optional).length;
		
		// Convert each parameter type to a schema
		const argSchemas = paramTypes.map((paramType) => parameterTypeToSchema(paramType));
		
		// Build description showing the expected argument structure
		const argDescriptions = paramTypes.map((p, i) => {
			const typeDesc = p.schema ? p.schema.name : p.type || 'object';
			return `arg${i}: ${typeDesc}${p.optional ? ' (optional)' : ''}`;
		});
		
		// Determine the items schema for the args array
		let itemsSchema: { type?: string; items?: unknown; properties?: unknown; oneOf?: unknown[]; description?: string };
		
		if (argSchemas.length === 0) {
			// No arguments - empty array
			itemsSchema = {};
		} else if (argSchemas.length === 1) {
			// Single argument - use its schema directly
			itemsSchema = argSchemas[0];
		} else {
			// Multiple arguments - check if all are the same type
			const firstSchema = argSchemas[0];
			const allSameType = argSchemas.every((schema) => 
				JSON.stringify(schema) === JSON.stringify(firstSchema)
			);
			
			if (allSameType) {
				// All arguments are the same type - use that type directly
				itemsSchema = firstSchema;
			} else {
				// Mixed types - use oneOf to allow any of the argument types
				// Note: OpenAPI 3.0 doesn't support tuples perfectly, so we use oneOf
				// The description will clarify the expected order
				itemsSchema = {
					oneOf: argSchemas,
					description: `Arguments in order: ${argDescriptions.join(', ')}`
				};
			}
		}

		return {
			type: 'object',
			properties: {
				args: {
					type: 'array',
					items: itemsSchema,
					...(requiredCount > 0 && { minItems: requiredCount }),
					...(argSchemas.length > 0 && { maxItems: argSchemas.length }),
					description: argSchemas.length === 0
						? 'No arguments required (empty array)'
						: argSchemas.length === 1
							? `Method argument: ${argDescriptions[0]}`
							: `Method arguments array. Expected order: ${argDescriptions.join(', ')}`
				}
			},
			required: ['args']
		};
	}

	// Default to empty args array for methods without Accepts decorator
	// Remult always requires { "args": [] } even when no arguments
	return {
		type: 'object',
		properties: {
			args: {
				type: 'array',
				items: {},
				description: 'No arguments required (empty array)'
			}
		},
		required: ['args']
	};
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
	returnType:
		| { type: 'string' | 'number' | 'boolean' | 'object' }
		| { schema: ClassType<unknown>; isArray?: boolean }
) {
	return function (target: unknown, propertyKey: string, descriptor?: PropertyDescriptor) {
		// Store metadata on the target's method property
		// For static methods, target is the class constructor
		const method = (target as AnyObj)[propertyKey];
		if (method) {
			(method as AnyObj)[returnTypeSymbol] = returnType;
		}

		// Also store on descriptor value if available
		if (descriptor && descriptor.value) {
			(descriptor.value as AnyObj)[returnTypeSymbol] = returnType;
		}

		// Store in a map on the controller class for reliable lookup
		// This ensures we can find it even if the method is wrapped
		if (!(target as AnyObj)[controllerReturnTypesMap]) {
			(target as AnyObj)[controllerReturnTypesMap] = new Map<string, unknown>();
		}
		((target as AnyObj)[controllerReturnTypesMap] as Map<string, unknown>).set(
			propertyKey,
			returnType
		);

		return descriptor;
	};
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
	parameterTypes:
		| { type: 'string' | 'number' | 'boolean' | 'object'; optional?: boolean }
		| { schema: ClassType<unknown>; isArray?: boolean; optional?: boolean }
		| Array<
				| { type: 'string' | 'number' | 'boolean' | 'object'; optional?: boolean }
				| { schema: ClassType<unknown>; isArray?: boolean; optional?: boolean }
			>
) {
	return function (target: unknown, propertyKey: string, descriptor?: PropertyDescriptor) {
		// Normalize to array format
		const paramTypesArray = Array.isArray(parameterTypes) ? parameterTypes : [parameterTypes];

		// Store metadata on the target's method property
		// For static methods, target is the class constructor
		const method = (target as AnyObj)[propertyKey];
		if (method) {
			(method as AnyObj)[parameterTypeSymbol] = paramTypesArray;
		}

		// Also store on descriptor value if available
		if (descriptor && descriptor.value) {
			(descriptor.value as AnyObj)[parameterTypeSymbol] = paramTypesArray;
		}

		// Store in a map on the controller class for reliable lookup
		// This ensures we can find it even if the method is wrapped
		if (!(target as AnyObj)[controllerParameterTypesMap]) {
			(target as AnyObj)[controllerParameterTypesMap] = new Map<string, unknown>();
		}
		((target as AnyObj)[controllerParameterTypesMap] as Map<string, unknown>).set(
			propertyKey,
			paramTypesArray
		);

		return descriptor;
	};
}

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
					const methodName = action.actionUrl.split('/').pop();

					// Infer the response schema from the method
					// Try multiple approaches to find the metadata
					const responseSchema = inferResponseSchema(method, controller, methodName);

					// Infer the request schema from the method parameters
					const requestSchema = inferRequestSchema(method, controller, methodName);

					spec.paths[path] = {
						post: {
							tags: [controller.name],
							summary: methodName,
							description: `Backend method: ${action.actionUrl}`,
							requestBody: {
								content: {
									'application/json': {
										schema: requestSchema
									}
								}
							},
							responses: {
								'200': {
									description: 'Successful response',
									content: {
										'application/json': {
											schema: responseSchema
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
