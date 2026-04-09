import { type ZodError, type ZodIssue } from 'zod';
import { type FieldShape, type InferFields, type SchemaBuilder } from './fields.js';
export declare class SchemaValidationError extends Error {
    readonly collection: string;
    readonly issues: ZodIssue[];
    constructor(collectionName: string, zodError: ZodError);
}
export type CollectionSafeParseResult<TData extends Record<string, unknown>> = {
    success: true;
    data: TData;
} | {
    success: false;
    error: SchemaValidationError;
};
export interface CollectionSchema<TData extends Record<string, unknown>, TShape extends FieldShape = FieldShape> {
    _name: string;
    _fieldDefs: TShape;
    _type: 'CollectionSchema';
    validate: (data: unknown) => TData;
    validatePartial: (data: unknown) => Partial<TData>;
    safeParse: (data: unknown) => CollectionSafeParseResult<TData>;
}
export declare function defineCollection<const TShape extends FieldShape>(collectionName: string, builder: (s: SchemaBuilder) => TShape): CollectionSchema<InferFields<TShape>, TShape>;
//# sourceMappingURL=collection.d.ts.map