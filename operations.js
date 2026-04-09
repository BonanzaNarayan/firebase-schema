import {
  collection,
  doc,
  addDoc,
  setDoc      as _setDoc,
  updateDoc   as _updateDoc,
  deleteDoc   as _deleteDoc,
  getDoc      as _getDoc,
  getDocs     as _getDocs,
  onSnapshot  as _onSnapshot,
  query,
  writeBatch,
  runTransaction as _runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate that `schema` is a CollectionSchema produced by defineCollection().
 */
function assertSchema(schema, opName) {
  if (!schema || schema._type !== 'CollectionSchema') {
    throw new TypeError(
      `${opName}: first argument must be a CollectionSchema from defineCollection(). Got: ${typeof schema}`
    )
  }
}

/**
 * Resolve a string ID or an existing DocumentReference into a DocumentReference.
 */
function resolveDocRef(db, schema, idOrRef) {
  if (typeof idOrRef === 'string') {
    return doc(db, schema._name, idOrRef)
  }
  // Already a DocumentReference
  if (idOrRef && typeof idOrRef.path === 'string') {
    return idOrRef
  }
  throw new TypeError(
    `Expected a document ID (string) or DocumentReference, got: ${typeof idOrRef}`
  )
}

/**
 * Get a CollectionReference for the schema.
 */
function collectionRef(db, schema) {
  return collection(db, schema._name)
}

/**
 * Map a Firestore DocumentSnapshot → plain data object with `id` field attached.
 * Returns null if the document doesn't exist.
 */
function docToData(snapshot) {
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() }
}

/**
 * Map a QuerySnapshot → array of plain data objects with `id` field attached.
 */
function snapshotToArray(querySnapshot) {
  return querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── Factory ─────────────────────────────────────────────────────────────────
// All operations are created via initFirestoreSchema(db) so db doesn't need
// to be passed on every call.

export function initFirestoreSchema(db) {
  if (!db) throw new Error('initFirestoreSchema: db (Firestore instance) is required')

  // ── createDoc ─────────────────────────────────────────────────────────────
  /**
   * Add a new document with an auto-generated ID.
   * Equivalent to Firestore's addDoc().
   *
   * @returns {Promise<DocumentReference>}
   *
   * @example
   * const ref = await createDoc(usersSchema, {
   *   name: 'Alice',
   *   email: 'alice@example.com',
   *   createdAt: serverTimestamp(),
   * })
   * console.log(ref.id) // auto-generated ID
   */
  async function createDoc(schema, data) {
    assertSchema(schema, 'createDoc')
    const validated = schema.validate(data)
    return addDoc(collectionRef(db, schema), validated)
  }

  // ── setDoc ────────────────────────────────────────────────────────────────
  /**
   * Write a document with a specific ID (overwrites by default).
   * Pass { merge: true } to merge instead of overwrite.
   * Equivalent to Firestore's setDoc().
   *
   * @param {CollectionSchema} schema
   * @param {string | DocumentReference} idOrRef
   * @param {object} data
   * @param {{ merge?: boolean, mergeFields?: string[] }} [options]
   *
   * @example
   * await setDoc(usersSchema, 'user-123', { name: 'Alice', email: 'alice@example.com', createdAt: serverTimestamp() })
   * await setDoc(usersSchema, 'user-123', { name: 'Alice Updated' }, { merge: true })
   */
  async function setDoc(schema, idOrRef, data, options = {}) {
    assertSchema(schema, 'setDoc')
    const ref       = resolveDocRef(db, schema, idOrRef)
    // merge/mergeFields: only validate fields present in data (partial)
    const validated = (options.merge || options.mergeFields)
      ? schema.validatePartial(data)
      : schema.validate(data)
    return _setDoc(ref, validated, options)
  }

  // ── updateDoc ─────────────────────────────────────────────────────────────
  /**
   * Partially update a document — only fields provided will be written.
   * The document must already exist.
   * Equivalent to Firestore's updateDoc().
   *
   * @example
   * await updateDoc(usersSchema, 'user-123', { name: 'Alice Updated' })
   */
  async function updateDoc(schema, idOrRef, data) {
    assertSchema(schema, 'updateDoc')
    const ref       = resolveDocRef(db, schema, idOrRef)
    const validated = schema.validatePartial(data)
    return _updateDoc(ref, validated)
  }

  // ── deleteDoc ─────────────────────────────────────────────────────────────
  /**
   * Delete a document by ID or ref.
   * No schema validation needed — it's just a deletion.
   *
   * @example
   * await deleteDoc(usersSchema, 'user-123')
   */
  async function deleteDoc(schema, idOrRef) {
    assertSchema(schema, 'deleteDoc')
    const ref = resolveDocRef(db, schema, idOrRef)
    return _deleteDoc(ref)
  }

  // ── getDoc ────────────────────────────────────────────────────────────────
  /**
   * Fetch a single document by ID or ref.
   * Returns { id, ...data } or null if not found.
   *
   * @returns {Promise<{ id: string } & T | null>}
   *
   * @example
   * const user = await getDoc(usersSchema, 'user-123')
   * if (!user) console.log('Not found')
   */
  async function getDoc(schema, idOrRef) {
    assertSchema(schema, 'getDoc')
    const ref      = resolveDocRef(db, schema, idOrRef)
    const snapshot = await _getDoc(ref)
    return docToData(snapshot)
  }

  // ── getDocs ───────────────────────────────────────────────────────────────
  /**
   * Fetch multiple documents from a collection, with optional query constraints.
   * Returns an array of { id, ...data } objects.
   *
   * @param {CollectionSchema} schema
   * @param {...QueryConstraint} constraints - where(), orderBy(), limit(), startAfter(), etc.
   * @returns {Promise<Array<{ id: string } & T>>}
   *
   * @example
   * import { where, orderBy, limit } from 'firebase/firestore'
   *
   * const users = await getDocs(usersSchema)
   * const admins = await getDocs(usersSchema, where('role', '==', 'admin'))
   * const recent = await getDocs(usersSchema, orderBy('createdAt', 'desc'), limit(10))
   */
  async function getDocs(schema, ...constraints) {
    assertSchema(schema, 'getDocs')
    const ref        = collectionRef(db, schema)
    const q          = constraints.length ? query(ref, ...constraints) : ref
    const snapshot   = await _getDocs(q)
    return snapshotToArray(snapshot)
  }

  // ── getDocRef ─────────────────────────────────────────────────────────────
  /**
   * Get a Firestore DocumentReference for a given schema and ID.
   * Useful when you need the ref itself (e.g. for storing references).
   *
   * @example
   * const ref = getDocRef(usersSchema, 'user-123')
   * await setDoc(postsSchema, 'post-1', { author: ref, ... })
   */
  function getDocRef(schema, id) {
    assertSchema(schema, 'getDocRef')
    return doc(db, schema._name, id)
  }

  /**
   * Get a Firestore CollectionReference for a schema.
   *
   * @example
   * const ref = getCollectionRef(usersSchema)
   */
  function getCollectionRef(schema) {
    assertSchema(schema, 'getCollectionRef')
    return collectionRef(db, schema)
  }

  // ── onDocSnapshot ─────────────────────────────────────────────────────────
  /**
   * Listen to real-time updates on a single document.
   * Returns an unsubscribe function.
   *
   * @param {CollectionSchema} schema
   * @param {string | DocumentReference} idOrRef
   * @param {(data: T | null) => void} callback - called with { id, ...data } or null
   * @param {(error: Error) => void} [onError]
   * @returns {Unsubscribe}
   *
   * @example
   * const unsub = onDocSnapshot(usersSchema, 'user-123', (user) => {
   *   if (user) console.log(user.name)
   * })
   * // Later: unsub()
   */
  function onDocSnapshot(schema, idOrRef, callback, onError) {
    assertSchema(schema, 'onDocSnapshot')
    const ref = resolveDocRef(db, schema, idOrRef)
    return _onSnapshot(
      ref,
      (snapshot) => callback(docToData(snapshot)),
      onError
    )
  }

  // ── onCollectionSnapshot ──────────────────────────────────────────────────
  /**
   * Listen to real-time updates on a collection or query.
   * Returns an unsubscribe function.
   *
   * @param {CollectionSchema} schema
   * @param {(docs: Array<T>) => void} callback - called with array of { id, ...data }
   * @param {...QueryConstraint} constraints - optional where(), orderBy(), limit(), etc.
   * @returns {Unsubscribe}
   *
   * @example
   * const unsub = onCollectionSnapshot(
   *   usersSchema,
   *   (users) => console.log(users),
   *   where('role', '==', 'admin'),
   *   orderBy('name')
   * )
   * // Later: unsub()
   */
  function onCollectionSnapshot(schema, callback, ...constraints) {
    assertSchema(schema, 'onCollectionSnapshot')
    const ref = collectionRef(db, schema)
    const q   = constraints.length ? query(ref, ...constraints) : ref
    return _onSnapshot(
      q,
      (snapshot) => callback(snapshotToArray(snapshot)),
    )
  }

  // ── Batch Writes ──────────────────────────────────────────────────────────
  /**
   * Create a schema-aware write batch.
   * All operations are validated before being added to the batch.
   *
   * @example
   * const batch = createBatch()
   *
   * batch.create(usersSchema, { name: 'Alice', email: 'alice@example.com', createdAt: serverTimestamp() })
   * batch.set(usersSchema, 'user-456', { name: 'Bob', email: 'bob@example.com', createdAt: serverTimestamp() })
   * batch.update(usersSchema, 'user-123', { name: 'Alice Updated' })
   * batch.delete(usersSchema, 'user-789')
   *
   * await batch.commit()
   */
  function createBatch() {
    const batch = writeBatch(db)

    return {
      /**
       * Add a new document with auto-generated ID to the batch.
       * Note: Firestore's batch doesn't support addDoc — this uses doc() with a generated ref.
       */
      create(schema, data) {
        assertSchema(schema, 'batch.create')
        const validated = schema.validate(data)
        const ref       = doc(collectionRef(db, schema))
        batch.set(ref, validated)
        return ref // return ref so caller can use the ID
      },

      /** Set (overwrite) a document in the batch */
      set(schema, idOrRef, data, options = {}) {
        assertSchema(schema, 'batch.set')
        const ref       = resolveDocRef(db, schema, idOrRef)
        const validated = (options.merge || options.mergeFields)
          ? schema.validatePartial(data)
          : schema.validate(data)
        batch.set(ref, validated, options)
        return this
      },

      /** Partially update a document in the batch */
      update(schema, idOrRef, data) {
        assertSchema(schema, 'batch.update')
        const ref       = resolveDocRef(db, schema, idOrRef)
        const validated = schema.validatePartial(data)
        batch.update(ref, validated)
        return this
      },

      /** Delete a document in the batch */
      delete(schema, idOrRef) {
        assertSchema(schema, 'batch.delete')
        const ref = resolveDocRef(db, schema, idOrRef)
        batch.delete(ref)
        return this
      },

      /** Commit all batched operations */
      commit() {
        return batch.commit()
      },
    }
  }

  // ── Transactions ──────────────────────────────────────────────────────────
  /**
   * Run a schema-aware transaction.
   * The transaction callback receives a schema-aware transaction object.
   *
   * @param {(t: SchemaTransaction) => Promise<T>} updateFn
   * @returns {Promise<T>}
   *
   * @example
   * await runTransaction(async (t) => {
   *   const user = await t.get(usersSchema, 'user-123')
   *   if (!user) throw new Error('User not found')
   *
   *   await t.update(usersSchema, 'user-123', {
   *     points: user.points + 10
   *   })
   * })
   */
  async function runTransaction(updateFn) {
    return _runTransaction(db, (firestoreTx) => {
      const t = {
        /** Get a document within the transaction. Returns { id, ...data } or null. */
        async get(schema, idOrRef) {
          assertSchema(schema, 'transaction.get')
          const ref      = resolveDocRef(db, schema, idOrRef)
          const snapshot = await firestoreTx.get(ref)
          return docToData(snapshot)
        },

        /** Set (overwrite) a document within the transaction */
        set(schema, idOrRef, data, options = {}) {
          assertSchema(schema, 'transaction.set')
          const ref       = resolveDocRef(db, schema, idOrRef)
          const validated = (options.merge || options.mergeFields)
            ? schema.validatePartial(data)
            : schema.validate(data)
          firestoreTx.set(ref, validated, options)
          return this
        },

        /** Partially update a document within the transaction */
        update(schema, idOrRef, data) {
          assertSchema(schema, 'transaction.update')
          const ref       = resolveDocRef(db, schema, idOrRef)
          const validated = schema.validatePartial(data)
          firestoreTx.update(ref, validated)
          return this
        },

        /** Delete a document within the transaction */
        delete(schema, idOrRef) {
          assertSchema(schema, 'transaction.delete')
          const ref = resolveDocRef(db, schema, idOrRef)
          firestoreTx.delete(ref)
          return this
        },
      }

      return updateFn(t)
    })
  }

  // ── Return all operations ─────────────────────────────────────────────────
  return {
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
  }
}