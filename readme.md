# firebase-schema

Drizzle-style schema validation for Firebase Firestore. Define your collections once, get validated reads and writes everywhere — with zero schema leaking to your app layer.

Zod handles validation internally. You never touch Zod directly.

---

## Install

```bash
npm install firestore-schema-kit
pnpm add firestore-schema-kit
bun add firestore-schema-kit
```

Copy `src/` into your project (e.g. `lib/firebase-schema/`).

---

## Quick start

### 1. Define your schemas

```js
// schema.js
import { defineCollection } from './lib/firebase-schema'

export const usersSchema = defineCollection('users', (s) => ({
  name:      s.string().min(1),
  email:     s.string().email(),
  role:      s.enum(['admin', 'user']).default('user'),
  age:       s.number().int().optional(),
  isActive:  s.boolean().default(true),
  createdAt: s.timestamp(),
  updatedAt: s.timestamp(),
}))

export const postsSchema = defineCollection('posts', (s) => ({
  title:     s.string().min(1).max(200),
  body:      s.string(),
  authorRef: s.reference(),
  tags:      s.array(s.string()).default([]),
  status:    s.enum(['draft', 'published']).default('draft'),
  createdAt: s.timestamp(),
}))
```

### 2. Init Firebase and bind operations

```js
// firebase.js
import { initializeApp }     from 'firebase/app'
import { getFirestore }      from 'firebase/firestore'
import { initFirestoreSchema } from './lib/firebase-schema'

const app = initializeApp({ /* your config */ })
const db  = getFirestore(app)

export const {
  createDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocRef,
  getCollectionRef,
  onDocSnapshot,
  onCollectionSnapshot,
  createBatch,
  runTransaction,
} = initFirestoreSchema(db)

export { db }
```

### 3. Use everywhere

```js
import { serverTimestamp, where, orderBy, limit } from 'firebase/firestore'
import { createDoc, updateDoc, getDocs }          from './firebase.js'
import { usersSchema }                            from './schema.js'

// Create
await createDoc(usersSchema, {
  name:      'Alice',
  email:     'alice@example.com',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
})

// Update (partial — only validates fields you provide)
await updateDoc(usersSchema, 'user-123', {
  name:      'Alice Smith',
  updatedAt: serverTimestamp(),
})

// Query
const admins = await getDocs(
  usersSchema,
  where('role', '==', 'admin'),
  orderBy('name'),
  limit(20)
)
```

---

## Field types

| Field | Example | Options |
|-------|---------|---------|
| `s.string()` | `s.string().min(1).max(100)` | `.min()` `.max()` `.email()` `.url()` `.uuid()` `.regex()` |
| `s.number()` | `s.number().int().positive()` | `.min()` `.max()` `.int()` `.positive()` `.negative()` |
| `s.boolean()` | `s.boolean().default(false)` | — |
| `s.timestamp()` | `s.timestamp()` | Accepts `Date`, Firestore `Timestamp`, `serverTimestamp()` |
| `s.array(item)` | `s.array(s.string()).min(1)` | `.min()` `.max()` |
| `s.map(shape)` | `s.map({ x: s.number(), y: s.number() })` | Nested schema |
| `s.enum(values)` | `s.enum(['a', 'b', 'c'])` | — |
| `s.reference()` | `s.reference()` | Accepts `DocumentReference` |
| `s.literal(val)` | `s.literal('active')` | — |
| `s.union(fields)` | `s.union([s.string(), s.number()])` | — |
| `s.any()` | `s.any()` | Escape hatch |

### Modifiers (available on all field types)

```js
s.string().optional()         // field can be absent from the object
s.string().nullable()         // field can be null
s.string().default('hello')   // use this value if field is absent
```

---

## All operations

### `createDoc(schema, data)` — addDoc equivalent
Auto-generated ID. Full schema validation.

```js
const ref = await createDoc(usersSchema, { name: 'Alice', email: 'alice@example.com', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
console.log(ref.id)
```

### `setDoc(schema, id, data, options?)` — setDoc equivalent
Specific ID. Full validation. Pass `{ merge: true }` to merge (partial validation).

```js
await setDoc(usersSchema, 'user-123', { name: 'Alice', email: 'alice@example.com', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
await setDoc(usersSchema, 'user-123', { bio: 'Hello' }, { merge: true })
```

### `updateDoc(schema, id, data)` — updateDoc equivalent
Partial update. Only validates the fields you provide. Document must exist.

```js
await updateDoc(usersSchema, 'user-123', { name: 'Alice Updated', updatedAt: serverTimestamp() })
```

### `deleteDoc(schema, id)` — deleteDoc equivalent

```js
await deleteDoc(usersSchema, 'user-123')
```

### `getDoc(schema, id)` — getDoc equivalent
Returns `{ id, ...data }` or `null`.

```js
const user = await getDoc(usersSchema, 'user-123')
if (!user) return // not found
console.log(user.name)
```

### `getDocs(schema, ...constraints)` — getDocs equivalent
Returns `Array<{ id, ...data }>`. All Firestore query constraints work.

```js
import { where, orderBy, limit } from 'firebase/firestore'

const users   = await getDocs(usersSchema)
const admins  = await getDocs(usersSchema, where('role', '==', 'admin'))
const recent  = await getDocs(usersSchema, orderBy('createdAt', 'desc'), limit(10))
```

### `getDocRef(schema, id)` — get a DocumentReference
Useful for storing references in other documents.

```js
const authorRef = getDocRef(usersSchema, 'user-123')
await createDoc(postsSchema, { title: 'Hello', authorRef, ... })
```

### `onDocSnapshot(schema, id, callback, onError?)` — real-time single doc

```js
const unsub = onDocSnapshot(usersSchema, 'user-123', (user) => {
  if (!user) return
  console.log(user.name)
})
unsub() // stop listening
```

### `onCollectionSnapshot(schema, callback, ...constraints)` — real-time collection

```js
const unsub = onCollectionSnapshot(
  usersSchema,
  (users) => console.log(users),
  where('isActive', '==', true),
  orderBy('name')
)
unsub()
```

### `createBatch()` — batch writes

```js
const batch = createBatch()

const ref = batch.create(usersSchema, { name: 'Bob', email: 'bob@example.com', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })

batch
  .set(usersSchema, 'user-456', { name: 'Charlie', email: 'charlie@example.com', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  .update(usersSchema, 'user-123', { isActive: false, updatedAt: serverTimestamp() })
  .delete(usersSchema, 'user-old')

await batch.commit()
```

### `runTransaction(fn)` — transactions

```js
await runTransaction(async (t) => {
  const post = await t.get(postsSchema, 'post-123')
  if (!post) throw new Error('Post not found')

  t.update(postsSchema, 'post-123', { viewCount: post.viewCount + 1 })
  t.set(commentsSchema, `c-${Date.now()}`, {
    postRef: getDocRef(postsSchema, 'post-123'),
    body: 'Nice!',
    createdAt: serverTimestamp(),
  })
})
```

---

## Validation errors

All validation errors throw a `SchemaValidationError` before any Firestore write happens.

```js
import { SchemaValidationError } from './lib/firebase-schema'

try {
  await createDoc(usersSchema, { email: 'not-an-email' })
} catch (err) {
  if (err instanceof SchemaValidationError) {
    console.log(err.collection) // 'users'
    console.log(err.issues)     // Zod issue array
    console.log(err.message)
    // [users] Schema validation failed:
    //   • name: Required
    //   • email: Invalid email
  }
}
```

For safe (non-throwing) validation:

```js
const result = usersSchema.safeParse(data)
if (!result.success) {
  console.error(result.error.message)
} else {
  console.log(result.data)
}
```

---

## Nested collections (subcollections)

Use the Firestore path format for subcollections:

```js
export const commentsSchema = defineCollection('posts/{postId}/comments', (s) => ({
  body:      s.string().min(1),
  authorRef: s.reference(),
  createdAt: s.timestamp(),
}))
```

For subcollections you'll typically use `getDocRef` or `getCollectionRef` with a concrete path:

```js
import { collection, doc } from 'firebase/firestore'

// Direct Firestore ref for the specific post's comments
const commentsRef = collection(db, 'posts', postId, 'comments')
```