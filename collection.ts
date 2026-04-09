import { z, type ZodError, type ZodIssue } from 'zod'
import { s, type FieldShape, type InferFields, type SchemaBuilder } from './fields.js'

export class SchemaValidationError extends Error {
  public readonly collection: string
  public readonly issues: ZodIssue[]

  constructor(collectionName: string, zodError: ZodError) {
    const issues = zodError.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    super(`[${collectionName}] Schema validation failed:\n${issues}`)
    this.name = 'SchemaValidationError'
    this.collection = collectionName
    this.issues = zodError.issues
  }
}

export type CollectionSafeParseResult<TData extends Record<string, unknown>> =
  | { success: true; data: TData }
  | { success: false; error: SchemaValidationError }

export interface CollectionSchema<
  TData extends Record<string, unknown>,
  TShape extends FieldShape = FieldShape,
> {
  _name: string
  _fieldDefs: TShape
  _type: 'CollectionSchema'
  validate: (data: unknown) => TData
  validatePartial: (data: unknown) => Partial<TData>
  safeParse: (data: unknown) => CollectionSafeParseResult<TData>
}

export function defineCollection<const TShape extends FieldShape>(
  collectionName: string,
  builder: (s: SchemaBuilder) => TShape,
): CollectionSchema<InferFields<TShape>, TShape> {
  if (typeof collectionName !== 'string' || !collectionName.trim()) {
    throw new Error('defineCollection: collectionName must be a non-empty string')
  }
  if (typeof builder !== 'function') {
    throw new Error('defineCollection: builder must be a function')
  }

  const fieldDefs = builder(s)
  if (!fieldDefs || typeof fieldDefs !== 'object') {
    throw new Error('defineCollection: builder must return an object of field definitions')
  }

  const zodShape: Record<string, z.ZodTypeAny> = {}
  for (const [key, field] of Object.entries(fieldDefs)) {
    if (!field || typeof field !== 'object' || typeof field.toZod !== 'function') {
      throw new Error(
        `defineCollection [${collectionName}]: field "${key}" is not a valid schema field. ` +
          'Use s.string(), s.number(), etc.',
      )
    }
    zodShape[key] = field.toZod()
  }

  const zodSchema = z.object(zodShape)
  const zodPartialSchema = zodSchema.partial()
  type CollectionData = InferFields<TShape>

  return {
    _name: collectionName,
    _fieldDefs: fieldDefs,
    _type: 'CollectionSchema',

    validate(data: unknown): CollectionData {
      const result = zodSchema.safeParse(data)
      if (!result.success) throw new SchemaValidationError(collectionName, result.error)
      return result.data as CollectionData
    },

    validatePartial(data: unknown): Partial<CollectionData> {
      const result = zodPartialSchema.safeParse(data)
      if (!result.success) throw new SchemaValidationError(collectionName, result.error)
      return result.data as Partial<CollectionData>
    },

    safeParse(data: unknown): CollectionSafeParseResult<CollectionData> {
      const result = zodSchema.safeParse(data)
      if (!result.success) {
        return { success: false, error: new SchemaValidationError(collectionName, result.error) }
      }
      return { success: true, data: result.data as CollectionData }
    },
  }
}
