import { z } from 'zod'
import { s } from './fields.js'

// ─── Schema Validation Error ───────────────────────────────────────────────────

export class SchemaValidationError extends Error {
  constructor(collectionName, zodError) {
    const issues = zodError.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    super(`[${collectionName}] Schema validation failed:\n${issues}`)
    this.name       = 'SchemaValidationError'
    this.collection = collectionName
    this.issues     = zodError.issues
  }
}

// ─── defineCollection ─────────────────────────────────────────────────────────

/**
 * Define a typed Firestore collection with schema validation.
 *
 * @param {string} collectionName - Firestore collection path (e.g. 'users', 'posts/comments')
 * @param {(s: SchemaBuilder) => Record<string, BaseField>} builder - Field definition callback
 * @returns {CollectionSchema}
 *
 * @example
 * export const usersSchema = defineCollection('users', (s) => ({
 *   name:      s.string().min(1),
 *   email:     s.string().email(),
 *   age:       s.number().optional(),
 *   role:      s.enum(['admin', 'user']).default('user'),
 *   createdAt: s.timestamp(),
 * }))
 */
export function defineCollection(collectionName, builder) {
  if (typeof collectionName !== 'string' || !collectionName.trim()) {
    throw new Error('defineCollection: collectionName must be a non-empty string')
  }
  if (typeof builder !== 'function') {
    throw new Error('defineCollection: builder must be a function')
  }

  // Call builder with the schema builder (s)
  const fieldDefs = builder(s)

  if (!fieldDefs || typeof fieldDefs !== 'object') {
    throw new Error('defineCollection: builder must return an object of field definitions')
  }

  // Convert field definitions → Zod schema shape
  const zodShape = {}
  for (const [key, field] of Object.entries(fieldDefs)) {
    if (typeof field?.toZod !== 'function') {
      throw new Error(
        `defineCollection [${collectionName}]: field "${key}" is not a valid schema field. ` +
        `Use s.string(), s.number(), etc.`
      )
    }
    zodShape[key] = field.toZod()
  }

  const zodSchema        = z.object(zodShape)
  const zodPartialSchema = zodSchema.partial()

  return {
    // ── Metadata ────────────────────────────────────────────────────────────
    _name:      collectionName,
    _fieldDefs: fieldDefs,
    _type:      'CollectionSchema',

    // ── Validation ──────────────────────────────────────────────────────────

    /** Full validation — use for createDoc / setDoc */
    validate(data) {
      const result = zodSchema.safeParse(data)
      if (!result.success) throw new SchemaValidationError(collectionName, result.error)
      return result.data
    },

    /** Partial validation — use for updateDoc (only validates fields present in data) */
    validatePartial(data) {
      const result = zodPartialSchema.safeParse(data)
      if (!result.success) throw new SchemaValidationError(collectionName, result.error)
      return result.data
    },

    /** Safe (non-throwing) full validation */
    safeParse(data) {
      const result = zodSchema.safeParse(data)
      if (!result.success) {
        return { success: false, error: new SchemaValidationError(collectionName, result.error) }
      }
      return { success: true, data: result.data }
    },
  }
}