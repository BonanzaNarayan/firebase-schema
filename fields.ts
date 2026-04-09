import { z } from 'zod'
import type { DocumentReference, FieldValue, Timestamp } from 'firebase/firestore'

export declare const fieldOutputSymbol: unique symbol

export type FieldOutput<TField extends BaseField<any>> = TField[typeof fieldOutputSymbol]
export type FieldShape = Record<string, BaseField<any>>
export type InferFields<TShape extends FieldShape> = {
  [K in keyof TShape]: FieldOutput<TShape[K]>
}

type LiteralValue = string | number | bigint | boolean | null | undefined
export type TimestampLike = Date | Timestamp | FieldValue

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasToDate(value: unknown): value is { toDate: () => Date } {
  return isRecord(value) && typeof value.toDate === 'function'
}

function isServerTimestampSentinel(value: unknown): value is FieldValue {
  return isRecord(value) && '_methodName' in value
}

export abstract class BaseField<TOutput = unknown> {
  declare readonly [fieldOutputSymbol]: TOutput

  protected _optional = false
  protected _nullable = false
  protected _hasDefault = false
  protected _defaultVal: unknown = undefined

  optional(): this & BaseField<TOutput | undefined> {
    this._optional = true
    return this as this & BaseField<TOutput | undefined>
  }

  nullable(): this & BaseField<TOutput | null> {
    this._nullable = true
    return this as this & BaseField<TOutput | null>
  }

  default<TValue>(val: TValue): this & BaseField<Exclude<TOutput, undefined>> {
    this._hasDefault = true
    this._defaultVal = val
    return this as this & BaseField<Exclude<TOutput, undefined>>
  }

  protected abstract _baseZod(): z.ZodTypeAny

  toZod(): z.ZodType<TOutput> {
    let schema: z.ZodTypeAny = this._baseZod()
    if (this._nullable) schema = schema.nullable()
    if (this._hasDefault) schema = schema.default(this._defaultVal as never)
    if (this._optional) schema = schema.optional()
    return schema as z.ZodType<TOutput>
  }
}

export class StringField extends BaseField<string> {
  private _min: number | null = null
  private _max: number | null = null
  private _email = false
  private _url = false
  private _uuid = false
  private _regex: RegExp | null = null

  min(n: number): this {
    this._min = n
    return this
  }

  max(n: number): this {
    this._max = n
    return this
  }

  email(): this {
    this._email = true
    return this
  }

  url(): this {
    this._url = true
    return this
  }

  uuid(): this {
    this._uuid = true
    return this
  }

  regex(r: RegExp): this {
    this._regex = r
    return this
  }

  protected _baseZod(): z.ZodString {
    let schema = z.string()
    if (this._min !== null) schema = schema.min(this._min)
    if (this._max !== null) schema = schema.max(this._max)
    if (this._email) schema = schema.email()
    if (this._url) schema = schema.url()
    if (this._uuid) schema = schema.uuid()
    if (this._regex !== null) schema = schema.regex(this._regex)
    return schema
  }
}

export class NumberField extends BaseField<number> {
  private _min: number | null = null
  private _max: number | null = null
  private _int = false
  private _positive = false
  private _negative = false

  min(n: number): this {
    this._min = n
    return this
  }

  max(n: number): this {
    this._max = n
    return this
  }

  int(): this {
    this._int = true
    return this
  }

  positive(): this {
    this._positive = true
    return this
  }

  negative(): this {
    this._negative = true
    return this
  }

  protected _baseZod(): z.ZodNumber {
    let schema = this._int ? z.number().int() : z.number()
    if (this._min !== null) schema = schema.min(this._min)
    if (this._max !== null) schema = schema.max(this._max)
    if (this._positive) schema = schema.positive()
    if (this._negative) schema = schema.negative()
    return schema
  }
}

export class BooleanField extends BaseField<boolean> {
  protected _baseZod(): z.ZodBoolean {
    return z.boolean()
  }
}

export class TimestampField extends BaseField<TimestampLike> {
  protected _baseZod(): z.ZodType<TimestampLike> {
    return z.custom<TimestampLike>(
      (val) => {
        if (!val) return false
        if (val instanceof Date) return true
        if (hasToDate(val)) return true
        if (isServerTimestampSentinel(val)) return true
        return false
      },
      { message: 'Expected a Date, Firestore Timestamp, or serverTimestamp()' },
    )
  }
}

export class ArrayField<TItemField extends BaseField<any>> extends BaseField<Array<FieldOutput<TItemField>>> {
  private readonly _itemField: TItemField
  private _min: number | null = null
  private _max: number | null = null

  constructor(itemField: TItemField) {
    super()
    this._itemField = itemField
  }

  min(n: number): this {
    this._min = n
    return this
  }

  max(n: number): this {
    this._max = n
    return this
  }

  protected _baseZod(): z.ZodType<Array<FieldOutput<TItemField>>> {
    let schema = z.array(this._itemField.toZod())
    if (this._min !== null) schema = schema.min(this._min)
    if (this._max !== null) schema = schema.max(this._max)
    return schema as z.ZodType<Array<FieldOutput<TItemField>>>
  }
}

export class MapField<TShape extends FieldShape> extends BaseField<InferFields<TShape>> {
  private readonly _shape: TShape

  constructor(shape: TShape) {
    super()
    this._shape = shape
  }

  protected _baseZod(): z.ZodType<InferFields<TShape>> {
    const zodShape: Record<string, z.ZodTypeAny> = {}
    for (const [key, field] of Object.entries(this._shape)) {
      zodShape[key] = field.toZod()
    }
    return z.object(zodShape) as z.ZodType<InferFields<TShape>>
  }
}

export class EnumField<TValues extends readonly [string, ...string[]]> extends BaseField<TValues[number]> {
  private readonly _values: TValues

  constructor(values: TValues) {
    super()
    this._values = values
  }

  protected _baseZod(): z.ZodType<TValues[number]> {
    return z.enum(this._values) as z.ZodType<TValues[number]>
  }
}

export class LiteralField<TValue extends LiteralValue> extends BaseField<TValue> {
  private readonly _value: TValue

  constructor(value: TValue) {
    super()
    this._value = value
  }

  protected _baseZod(): z.ZodLiteral<TValue> {
    return z.literal(this._value)
  }
}

export class ReferenceField extends BaseField<DocumentReference> {
  protected _baseZod(): z.ZodType<DocumentReference> {
    return z.custom<DocumentReference>(
      (val) =>
        isRecord(val) &&
        typeof val.path === 'string' &&
        typeof val.id === 'string',
      { message: 'Expected a Firestore DocumentReference' },
    )
  }
}

export class UnionField<TFields extends readonly [BaseField<any>, ...BaseField<any>[]]> extends BaseField<FieldOutput<TFields[number]>> {
  private readonly _fields: TFields

  constructor(fields: TFields) {
    super()
    this._fields = fields
  }

  protected _baseZod(): z.ZodType<FieldOutput<TFields[number]>> {
    const schemas = this._fields.map((field) => field.toZod()) as [z.ZodTypeAny, ...z.ZodTypeAny[]]
    return z.union(schemas) as z.ZodType<FieldOutput<TFields[number]>>
  }
}

export class AnyField extends BaseField<any> {
  protected _baseZod(): z.ZodAny {
    return z.any()
  }
}

export interface SchemaBuilder {
  string: () => StringField
  number: () => NumberField
  boolean: () => BooleanField
  timestamp: () => TimestampField
  array: <TItemField extends BaseField<any>>(itemField: TItemField) => ArrayField<TItemField>
  map: <TShape extends FieldShape>(shape: TShape) => MapField<TShape>
  enum: <const TValues extends readonly [string, ...string[]]>(values: TValues) => EnumField<TValues>
  literal: <TValue extends LiteralValue>(value: TValue) => LiteralField<TValue>
  reference: () => ReferenceField
  union: <TFields extends readonly [BaseField<any>, ...BaseField<any>[]]>(fields: TFields) => UnionField<TFields>
  any: () => AnyField
}

export const s: SchemaBuilder = {
  string: () => new StringField(),
  number: () => new NumberField(),
  boolean: () => new BooleanField(),
  timestamp: () => new TimestampField(),
  array: (itemField) => new ArrayField(itemField),
  map: (shape) => new MapField(shape),
  enum: (values) => new EnumField(values),
  literal: (value) => new LiteralField(value),
  reference: () => new ReferenceField(),
  union: (fields) => new UnionField(fields),
  any: () => new AnyField(),
}
