import { getFields } from 'remult';

type ClassType<T = unknown> = new () => T;

/**
 * Validates and populates a Remult schema instance with data
 * @param schemaClass - The Remult schema class to instantiate
 * @param data - The data to validate and populate
 * @returns The validated and populated schema instance
 * @throws Error if validation fails
 */
export async function validateSchema<T extends object>(
	schemaClass: ClassType<T>,
	data: unknown
): Promise<T> {
	// Create an instance of the schema class
	const instance = new schemaClass();

	// Get Remult field references for the class
	const fieldsRef = getFields(instance);

	// Populate the instance with data
	Object.assign(instance, data);

	// Validate using Remult's validation
	const errors: string[] = [];

	// Iterate over field references
	for (const fieldRef of fieldsRef) {
		const fieldMeta = fieldRef.metadata;
		const key = fieldMeta.key as keyof T;
		const value = instance[key];

		try {
			// Check required fields
			if (fieldMeta.options.required && !value) {
				errors.push(`${fieldMeta.caption || fieldMeta.key} is required.`);
				continue;
			}

			// Run field validators by calling validate on the fieldRef
			try {
				await fieldRef.validate();
				if (fieldRef.error) {
					errors.push(fieldRef.error);
				}
			} catch (err) {
				const error = err as Error;
				errors.push(error.message || `Validation failed for ${fieldMeta.key}`);
			}
		} catch (err) {
			const error = err as Error;
			errors.push(error.message || `Error validating ${fieldMeta.key}`);
		}
	}

	if (errors.length > 0) {
		throw new Error(errors.join(', '));
	}

	return instance;
}

export default validateSchema;
