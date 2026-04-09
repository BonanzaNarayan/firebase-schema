import { z } from 'zod';
import type { DocumentReference, FieldValue, Timestamp } from 'firebase/firestore';
export declare const fieldOutputSymbol: unique symbol;
export type FieldOutput<TField extends BaseField<any>> = TField[typeof fieldOutputSymbol];
export type FieldShape = Record<string, BaseField<any>>;
export type InferFields<TShape extends FieldShape> = {
    [K in keyof TShape]: FieldOutput<TShape[K]>;
};
type LiteralValue = string | number | bigint | boolean | null | undefined;
export type TimestampLike = Date | Timestamp | FieldValue;
export declare abstract class BaseField<TOutput = unknown> {
    readonly [fieldOutputSymbol]: TOutput;
    protected _optional: boolean;
    protected _nullable: boolean;
    protected _hasDefault: boolean;
    protected _defaultVal: unknown;
    optional(): this & BaseField<TOutput | undefined>;
    nullable(): this & BaseField<TOutput | null>;
    default<TValue>(val: TValue): this & BaseField<Exclude<TOutput, undefined>>;
    protected abstract _baseZod(): z.ZodTypeAny;
    toZod(): z.ZodType<TOutput>;
}
export declare class StringField extends BaseField<string> {
    private _min;
    private _max;
    private _email;
    private _url;
    private _uuid;
    private _regex;
    min(n: number): this;
    max(n: number): this;
    email(): this;
    url(): this;
    uuid(): this;
    regex(r: RegExp): this;
    protected _baseZod(): z.ZodString;
}
export declare class NumberField extends BaseField<number> {
    private _min;
    private _max;
    private _int;
    private _positive;
    private _negative;
    min(n: number): this;
    max(n: number): this;
    int(): this;
    positive(): this;
    negative(): this;
    protected _baseZod(): z.ZodNumber;
}
export declare class BooleanField extends BaseField<boolean> {
    protected _baseZod(): z.ZodBoolean;
}
export declare class TimestampField extends BaseField<TimestampLike> {
    protected _baseZod(): z.ZodType<TimestampLike>;
}
export declare class ArrayField<TItemField extends BaseField<any>> extends BaseField<Array<FieldOutput<TItemField>>> {
    private readonly _itemField;
    private _min;
    private _max;
    constructor(itemField: TItemField);
    min(n: number): this;
    max(n: number): this;
    protected _baseZod(): z.ZodType<Array<FieldOutput<TItemField>>>;
}
export declare class MapField<TShape extends FieldShape> extends BaseField<InferFields<TShape>> {
    private readonly _shape;
    constructor(shape: TShape);
    protected _baseZod(): z.ZodType<InferFields<TShape>>;
}
export declare class EnumField<TValues extends readonly [string, ...string[]]> extends BaseField<TValues[number]> {
    private readonly _values;
    constructor(values: TValues);
    protected _baseZod(): z.ZodType<TValues[number]>;
}
export declare class LiteralField<TValue extends LiteralValue> extends BaseField<TValue> {
    private readonly _value;
    constructor(value: TValue);
    protected _baseZod(): z.ZodLiteral<TValue>;
}
export declare class ReferenceField extends BaseField<DocumentReference> {
    protected _baseZod(): z.ZodType<DocumentReference>;
}
export declare class UnionField<TFields extends readonly [BaseField<any>, ...BaseField<any>[]]> extends BaseField<FieldOutput<TFields[number]>> {
    private readonly _fields;
    constructor(fields: TFields);
    protected _baseZod(): z.ZodType<FieldOutput<TFields[number]>>;
}
export declare class AnyField extends BaseField<any> {
    protected _baseZod(): z.ZodAny;
}
export interface SchemaBuilder {
    string: () => StringField;
    number: () => NumberField;
    boolean: () => BooleanField;
    timestamp: () => TimestampField;
    array: <TItemField extends BaseField<any>>(itemField: TItemField) => ArrayField<TItemField>;
    map: <TShape extends FieldShape>(shape: TShape) => MapField<TShape>;
    enum: <const TValues extends readonly [string, ...string[]]>(values: TValues) => EnumField<TValues>;
    literal: <TValue extends LiteralValue>(value: TValue) => LiteralField<TValue>;
    reference: () => ReferenceField;
    union: <TFields extends readonly [BaseField<any>, ...BaseField<any>[]]>(fields: TFields) => UnionField<TFields>;
    any: () => AnyField;
}
export declare const s: SchemaBuilder;
export {};
//# sourceMappingURL=fields.d.ts.map