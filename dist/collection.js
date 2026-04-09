import { z } from 'zod';
import { s } from './fields.js';
export class SchemaValidationError extends Error {
    collection;
    issues;
    constructor(collectionName, zodError) {
        const issues = zodError.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');
        super(`[${collectionName}] Schema validation failed:\n${issues}`);
        this.name = 'SchemaValidationError';
        this.collection = collectionName;
        this.issues = zodError.issues;
    }
}
export function defineCollection(collectionName, builder) {
    if (typeof collectionName !== 'string' || !collectionName.trim()) {
        throw new Error('defineCollection: collectionName must be a non-empty string');
    }
    if (typeof builder !== 'function') {
        throw new Error('defineCollection: builder must be a function');
    }
    const fieldDefs = builder(s);
    if (!fieldDefs || typeof fieldDefs !== 'object') {
        throw new Error('defineCollection: builder must return an object of field definitions');
    }
    const zodShape = {};
    for (const [key, field] of Object.entries(fieldDefs)) {
        if (!field || typeof field !== 'object' || typeof field.toZod !== 'function') {
            throw new Error(`defineCollection [${collectionName}]: field "${key}" is not a valid schema field. ` +
                'Use s.string(), s.number(), etc.');
        }
        zodShape[key] = field.toZod();
    }
    const zodSchema = z.object(zodShape);
    const zodPartialSchema = zodSchema.partial();
    return {
        _name: collectionName,
        _fieldDefs: fieldDefs,
        _type: 'CollectionSchema',
        validate(data) {
            const result = zodSchema.safeParse(data);
            if (!result.success)
                throw new SchemaValidationError(collectionName, result.error);
            return result.data;
        },
        validatePartial(data) {
            const result = zodPartialSchema.safeParse(data);
            if (!result.success)
                throw new SchemaValidationError(collectionName, result.error);
            return result.data;
        },
        safeParse(data) {
            const result = zodSchema.safeParse(data);
            if (!result.success) {
                return { success: false, error: new SchemaValidationError(collectionName, result.error) };
            }
            return { success: true, data: result.data };
        },
    };
}
//# sourceMappingURL=collection.js.map