import { z } from 'zod'

// ─── Base Field ───────────────────────────────────────────────────────────────

class BaseField {
  constructor() {
    this._optional   = false
    this._nullable   = false
    this._hasDefault = false
    this._defaultVal = undefined
  }

  optional() {
    this._optional = true
    return this
  }

  nullable() {
    this._nullable = true
    return this
  }

  default(val) {
    this._hasDefault = true
    this._defaultVal = val
    return this
  }

  // Subclasses implement this — returns a raw Zod schema with no optional/default wrapping
  _baseZod() {
    throw new Error(`_baseZod() not implemented on ${this.constructor.name}`)
  }

  // Builds the final Zod schema, applying nullable → default → optional in the correct order
  toZod() {
    let schema = this._baseZod()
    if (this._nullable)   schema = schema.nullable()
    if (this._hasDefault) schema = schema.default(this._defaultVal)
    if (this._optional)   schema = schema.optional()
    return schema
  }
}

// ─── String ───────────────────────────────────────────────────────────────────

export class StringField extends BaseField {
  constructor() {
    super()
    this._min   = null
    this._max   = null
    this._email = false
    this._url   = false
    this._uuid  = false
    this._regex = null
  }

  min(n)      { this._min   = n; return this }
  max(n)      { this._max   = n; return this }
  email()     { this._email = true; return this }
  url()       { this._url   = true; return this }
  uuid()      { this._uuid  = true; return this }
  regex(r)    { this._regex = r; return this }

  _baseZod() {
    let schema = z.string()
    if (this._min   !== null) schema = schema.min(this._min)
    if (this._max   !== null) schema = schema.max(this._max)
    if (this._email)          schema = schema.email()
    if (this._url)            schema = schema.url()
    if (this._uuid)           schema = schema.uuid()
    if (this._regex !== null) schema = schema.regex(this._regex)
    return schema
  }
}

// ─── Number ───────────────────────────────────────────────────────────────────

export class NumberField extends BaseField {
  constructor() {
    super()
    this._min      = null
    this._max      = null
    this._int      = false
    this._positive = false
    this._negative = false
  }

  min(n)      { this._min      = n;    return this }
  max(n)      { this._max      = n;    return this }
  int()       { this._int      = true; return this }
  positive()  { this._positive = true; return this }
  negative()  { this._negative = true; return this }

  _baseZod() {
    let schema = this._int ? z.number().int() : z.number()
    if (this._min      !== null) schema = schema.min(this._min)
    if (this._max      !== null) schema = schema.max(this._max)
    if (this._positive)          schema = schema.positive()
    if (this._negative)          schema = schema.negative()
    return schema
  }
}

// ─── Boolean ──────────────────────────────────────────────────────────────────

export class BooleanField extends BaseField {
  _baseZod() {
    return z.boolean()
  }
}

// ─── Timestamp ────────────────────────────────────────────────────────────────
// Accepts: JS Date, Firestore Timestamp, serverTimestamp() sentinel

export class TimestampField extends BaseField {
  _baseZod() {
    return z.custom(
      (val) => {
        if (!val) return false
        // JS Date
        if (val instanceof Date) return true
        // Firestore Timestamp (has toDate method)
        if (typeof val.toDate === 'function') return true
        // serverTimestamp() sentinel — has _methodName internally
        if (typeof val === 'object' && '_methodName' in val) return true
        return false
      },
      { message: 'Expected a Date, Firestore Timestamp, or serverTimestamp()' }
    )
  }
}

// ─── Array ────────────────────────────────────────────────────────────────────

export class ArrayField extends BaseField {
  constructor(itemField) {
    super()
    this._itemField = itemField
    this._min       = null
    this._max       = null
  }

  min(n) { this._min = n; return this }
  max(n) { this._max = n; return this }

  _baseZod() {
    let schema = z.array(this._itemField.toZod())
    if (this._min !== null) schema = schema.min(this._min)
    if (this._max !== null) schema = schema.max(this._max)
    return schema
  }
}

// ─── Map (nested object) ──────────────────────────────────────────────────────

export class MapField extends BaseField {
  constructor(shape) {
    super()
    this._shape = shape
  }

  _baseZod() {
    const zodShape = {}
    for (const [key, field] of Object.entries(this._shape)) {
      zodShape[key] = field.toZod()
    }
    return z.object(zodShape)
  }
}

// ─── Enum ─────────────────────────────────────────────────────────────────────

export class EnumField extends BaseField {
  constructor(values) {
    super()
    this._values = values
  }

  _baseZod() {
    return z.enum(this._values)
  }
}

// ─── Literal ──────────────────────────────────────────────────────────────────

export class LiteralField extends BaseField {
  constructor(value) {
    super()
    this._value = value
  }

  _baseZod() {
    return z.literal(this._value)
  }
}

// ─── Reference (Firestore DocumentReference) ──────────────────────────────────

export class ReferenceField extends BaseField {
  _baseZod() {
    return z.custom(
      (val) => val && typeof val.path === 'string' && typeof val.id === 'string',
      { message: 'Expected a Firestore DocumentReference' }
    )
  }
}

// ─── Union ────────────────────────────────────────────────────────────────────

export class UnionField extends BaseField {
  constructor(fields) {
    super()
    this._fields = fields
  }

  _baseZod() {
    const schemas = this._fields.map((f) => f.toZod())
    return z.union(schemas)
  }
}

// ─── Any (escape hatch) ───────────────────────────────────────────────────────

export class AnyField extends BaseField {
  _baseZod() {
    return z.any()
  }
}

// ─── Schema Builder (s) ───────────────────────────────────────────────────────
// This is what gets passed into the defineCollection callback

export const s = {
  string:    ()           => new StringField(),
  number:    ()           => new NumberField(),
  boolean:   ()           => new BooleanField(),
  timestamp: ()           => new TimestampField(),
  array:     (itemField)  => new ArrayField(itemField),
  map:       (shape)      => new MapField(shape),
  enum:      (values)     => new EnumField(values),
  literal:   (value)      => new LiteralField(value),
  reference: ()           => new ReferenceField(),
  union:     (fields)     => new UnionField(fields),
  any:       ()           => new AnyField(),
}