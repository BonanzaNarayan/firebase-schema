import { z } from 'zod';
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function hasToDate(value) {
    return isRecord(value) && typeof value.toDate === 'function';
}
function isServerTimestampSentinel(value) {
    return isRecord(value) && '_methodName' in value;
}
export class BaseField {
    _optional = false;
    _nullable = false;
    _hasDefault = false;
    _defaultVal = undefined;
    optional() {
        this._optional = true;
        return this;
    }
    nullable() {
        this._nullable = true;
        return this;
    }
    default(val) {
        this._hasDefault = true;
        this._defaultVal = val;
        return this;
    }
    toZod() {
        let schema = this._baseZod();
        if (this._nullable)
            schema = schema.nullable();
        if (this._hasDefault)
            schema = schema.default(this._defaultVal);
        if (this._optional)
            schema = schema.optional();
        return schema;
    }
}
export class StringField extends BaseField {
    _min = null;
    _max = null;
    _email = false;
    _url = false;
    _uuid = false;
    _regex = null;
    min(n) {
        this._min = n;
        return this;
    }
    max(n) {
        this._max = n;
        return this;
    }
    email() {
        this._email = true;
        return this;
    }
    url() {
        this._url = true;
        return this;
    }
    uuid() {
        this._uuid = true;
        return this;
    }
    regex(r) {
        this._regex = r;
        return this;
    }
    _baseZod() {
        let schema = z.string();
        if (this._min !== null)
            schema = schema.min(this._min);
        if (this._max !== null)
            schema = schema.max(this._max);
        if (this._email)
            schema = schema.email();
        if (this._url)
            schema = schema.url();
        if (this._uuid)
            schema = schema.uuid();
        if (this._regex !== null)
            schema = schema.regex(this._regex);
        return schema;
    }
}
export class NumberField extends BaseField {
    _min = null;
    _max = null;
    _int = false;
    _positive = false;
    _negative = false;
    min(n) {
        this._min = n;
        return this;
    }
    max(n) {
        this._max = n;
        return this;
    }
    int() {
        this._int = true;
        return this;
    }
    positive() {
        this._positive = true;
        return this;
    }
    negative() {
        this._negative = true;
        return this;
    }
    _baseZod() {
        let schema = this._int ? z.number().int() : z.number();
        if (this._min !== null)
            schema = schema.min(this._min);
        if (this._max !== null)
            schema = schema.max(this._max);
        if (this._positive)
            schema = schema.positive();
        if (this._negative)
            schema = schema.negative();
        return schema;
    }
}
export class BooleanField extends BaseField {
    _baseZod() {
        return z.boolean();
    }
}
export class TimestampField extends BaseField {
    _baseZod() {
        return z.custom((val) => {
            if (!val)
                return false;
            if (val instanceof Date)
                return true;
            if (hasToDate(val))
                return true;
            if (isServerTimestampSentinel(val))
                return true;
            return false;
        }, { message: 'Expected a Date, Firestore Timestamp, or serverTimestamp()' });
    }
}
export class ArrayField extends BaseField {
    _itemField;
    _min = null;
    _max = null;
    constructor(itemField) {
        super();
        this._itemField = itemField;
    }
    min(n) {
        this._min = n;
        return this;
    }
    max(n) {
        this._max = n;
        return this;
    }
    _baseZod() {
        let schema = z.array(this._itemField.toZod());
        if (this._min !== null)
            schema = schema.min(this._min);
        if (this._max !== null)
            schema = schema.max(this._max);
        return schema;
    }
}
export class MapField extends BaseField {
    _shape;
    constructor(shape) {
        super();
        this._shape = shape;
    }
    _baseZod() {
        const zodShape = {};
        for (const [key, field] of Object.entries(this._shape)) {
            zodShape[key] = field.toZod();
        }
        return z.object(zodShape);
    }
}
export class EnumField extends BaseField {
    _values;
    constructor(values) {
        super();
        this._values = values;
    }
    _baseZod() {
        return z.enum(this._values);
    }
}
export class LiteralField extends BaseField {
    _value;
    constructor(value) {
        super();
        this._value = value;
    }
    _baseZod() {
        return z.literal(this._value);
    }
}
export class ReferenceField extends BaseField {
    _baseZod() {
        return z.custom((val) => isRecord(val) &&
            typeof val.path === 'string' &&
            typeof val.id === 'string', { message: 'Expected a Firestore DocumentReference' });
    }
}
export class UnionField extends BaseField {
    _fields;
    constructor(fields) {
        super();
        this._fields = fields;
    }
    _baseZod() {
        const schemas = this._fields.map((field) => field.toZod());
        return z.union(schemas);
    }
}
export class AnyField extends BaseField {
    _baseZod() {
        return z.any();
    }
}
export const s = {
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
};
//# sourceMappingURL=fields.js.map