import {
  addDoc,
  collection,
  deleteDoc as _deleteDoc,
  doc,
  getDoc as _getDoc,
  getDocs as _getDocs,
  onSnapshot as _onSnapshot,
  query,
  runTransaction as _runTransaction,
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  writeBatch,
} from 'firebase/firestore'
import type {
  CollectionReference,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  QueryConstraint,
  QuerySnapshot,
  SetOptions,
  Unsubscribe,
} from 'firebase/firestore'

import type { CollectionSchema } from './collection.js'

export type WithId<TData extends DocumentData> = TData & { id: string }

export interface SchemaBatch {
  create: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    data: TData,
  ) => DocumentReference<TData>
  set: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: TData | Partial<TData>,
    options?: SetOptions,
  ) => SchemaBatch
  update: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: Partial<TData>,
  ) => SchemaBatch
  delete: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ) => SchemaBatch
  commit: () => Promise<void>
}

export interface SchemaTransaction {
  get: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ) => Promise<WithId<TData> | null>
  set: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: TData | Partial<TData>,
    options?: SetOptions,
  ) => SchemaTransaction
  update: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: Partial<TData>,
  ) => SchemaTransaction
  delete: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ) => SchemaTransaction
}

export interface FirestoreSchemaOperations {
  createDoc: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    data: TData,
  ) => Promise<DocumentReference<TData>>
  setDoc: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: TData | Partial<TData>,
    options?: SetOptions,
  ) => Promise<void>
  updateDoc: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: Partial<TData>,
  ) => Promise<void>
  deleteDoc: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ) => Promise<void>
  getDoc: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ) => Promise<WithId<TData> | null>
  getDocs: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    ...constraints: QueryConstraint[]
  ) => Promise<Array<WithId<TData>>>
  getDocRef: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    id: string,
  ) => DocumentReference<TData>
  getCollectionRef: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
  ) => CollectionReference<TData>
  onDocSnapshot: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    callback: (data: WithId<TData> | null) => void,
    onError?: (error: Error) => void,
  ) => Unsubscribe
  onCollectionSnapshot: <TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    callback: (docs: Array<WithId<TData>>) => void,
    ...constraints: QueryConstraint[]
  ) => Unsubscribe
  createBatch: () => SchemaBatch
  runTransaction: <TResult>(updateFn: (t: SchemaTransaction) => Promise<TResult>) => Promise<TResult>
}

function assertSchema<TData extends DocumentData>(
  schema: unknown,
  opName: string,
): asserts schema is CollectionSchema<TData> {
  if (!schema || typeof schema !== 'object' || (schema as { _type?: string })._type !== 'CollectionSchema') {
    throw new TypeError(
      `${opName}: first argument must be a CollectionSchema from defineCollection(). ` +
        `Got: ${typeof schema}`,
    )
  }
}

function resolveDocRef<TData extends DocumentData>(
  db: Firestore,
  schema: CollectionSchema<TData>,
  idOrRef: string | DocumentReference,
): DocumentReference<TData> {
  if (typeof idOrRef === 'string') {
    return doc(db, schema._name, idOrRef) as DocumentReference<TData>
  }
  if (idOrRef && typeof idOrRef.path === 'string') {
    return idOrRef as DocumentReference<TData>
  }
  throw new TypeError(
    `Expected a document ID (string) or DocumentReference, got: ${typeof idOrRef}`,
  )
}

function collectionRef<TData extends DocumentData>(
  db: Firestore,
  schema: CollectionSchema<TData>,
): CollectionReference<TData> {
  return collection(db, schema._name) as CollectionReference<TData>
}

function docToData<TData extends DocumentData>(snapshot: DocumentSnapshot<TData>): WithId<TData> | null {
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...(snapshot.data() as TData) }
}

function snapshotToArray<TData extends DocumentData>(querySnapshot: QuerySnapshot<TData>): Array<WithId<TData>> {
  return querySnapshot.docs.map((docSnapshot) => ({
    id: docSnapshot.id,
    ...(docSnapshot.data() as TData),
  }))
}

function shouldValidatePartial(options: SetOptions): boolean {
  const hasMergeFlag = 'merge' in options && Boolean(options.merge)
  const hasMergeFields = 'mergeFields' in options && Array.isArray(options.mergeFields)
  return hasMergeFlag || hasMergeFields
}

export function initFirestoreSchema(db: Firestore): FirestoreSchemaOperations {
  if (!db) throw new Error('initFirestoreSchema: db (Firestore instance) is required')

  async function createDoc<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    data: TData,
  ): Promise<DocumentReference<TData>> {
    assertSchema(schema, 'createDoc')
    const validated = schema.validate(data)
    const ref = await addDoc(collectionRef(db, schema), validated)
    return ref as DocumentReference<TData>
  }

  async function setDoc<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: TData | Partial<TData>,
    options: SetOptions = {},
  ): Promise<void> {
    assertSchema(schema, 'setDoc')
    const ref = resolveDocRef(db, schema, idOrRef)
    const validated = shouldValidatePartial(options)
      ? schema.validatePartial(data)
      : schema.validate(data)
    await _setDoc(ref, validated, options)
  }

  async function updateDoc<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    data: Partial<TData>,
  ): Promise<void> {
    assertSchema(schema, 'updateDoc')
    const ref = resolveDocRef(db, schema, idOrRef)
    const validated = schema.validatePartial(data)
    await _updateDoc(ref as DocumentReference<DocumentData>, validated as DocumentData)
  }

  async function deleteDoc<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ): Promise<void> {
    assertSchema(schema, 'deleteDoc')
    const ref = resolveDocRef(db, schema, idOrRef)
    await _deleteDoc(ref)
  }

  async function getDoc<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
  ): Promise<WithId<TData> | null> {
    assertSchema(schema, 'getDoc')
    const ref = resolveDocRef(db, schema, idOrRef)
    const snapshot = await _getDoc(ref)
    return docToData(snapshot as DocumentSnapshot<TData>)
  }

  async function getDocs<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    ...constraints: QueryConstraint[]
  ): Promise<Array<WithId<TData>>> {
    assertSchema(schema, 'getDocs')
    const ref = collectionRef(db, schema)
    const q = constraints.length ? query(ref, ...constraints) : ref
    const snapshot = await _getDocs(q)
    return snapshotToArray(snapshot as QuerySnapshot<TData>)
  }

  function getDocRef<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    id: string,
  ): DocumentReference<TData> {
    assertSchema(schema, 'getDocRef')
    return doc(db, schema._name, id) as DocumentReference<TData>
  }

  function getCollectionRef<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
  ): CollectionReference<TData> {
    assertSchema(schema, 'getCollectionRef')
    return collectionRef(db, schema)
  }

  function onDocSnapshot<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    idOrRef: string | DocumentReference,
    callback: (data: WithId<TData> | null) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe {
    assertSchema(schema, 'onDocSnapshot')
    const ref = resolveDocRef(db, schema, idOrRef)
    return _onSnapshot(
      ref,
      (snapshot) => callback(docToData(snapshot as DocumentSnapshot<TData>)),
      onError,
    )
  }

  function onCollectionSnapshot<TData extends DocumentData>(
    schema: CollectionSchema<TData>,
    callback: (docs: Array<WithId<TData>>) => void,
    ...constraints: QueryConstraint[]
  ): Unsubscribe {
    assertSchema(schema, 'onCollectionSnapshot')
    const ref = collectionRef(db, schema)
    const q = constraints.length ? query(ref, ...constraints) : ref
    return _onSnapshot(
      q,
      (snapshot) => callback(snapshotToArray(snapshot as QuerySnapshot<TData>)),
    )
  }

  function createBatch(): SchemaBatch {
    const batch = writeBatch(db)

    const schemaBatch: SchemaBatch = {
      create<TData extends DocumentData>(
        schema: CollectionSchema<TData>,
        data: TData,
      ): DocumentReference<TData> {
        assertSchema(schema, 'batch.create')
        const validated = schema.validate(data)
        const ref = doc(collectionRef(db, schema))
        batch.set(ref, validated)
        return ref as DocumentReference<TData>
      },

      set<TData extends DocumentData>(
        schema: CollectionSchema<TData>,
        idOrRef: string | DocumentReference,
        data: TData | Partial<TData>,
        options: SetOptions = {},
      ): SchemaBatch {
        assertSchema(schema, 'batch.set')
        const ref = resolveDocRef(db, schema, idOrRef)
        const validated = shouldValidatePartial(options)
          ? schema.validatePartial(data)
          : schema.validate(data)
        batch.set(ref, validated, options)
        return schemaBatch
      },

      update<TData extends DocumentData>(
        schema: CollectionSchema<TData>,
        idOrRef: string | DocumentReference,
        data: Partial<TData>,
      ): SchemaBatch {
        assertSchema(schema, 'batch.update')
        const ref = resolveDocRef(db, schema, idOrRef)
        const validated = schema.validatePartial(data)
        batch.update(ref as DocumentReference<DocumentData>, validated as DocumentData)
        return schemaBatch
      },

      delete<TData extends DocumentData>(
        schema: CollectionSchema<TData>,
        idOrRef: string | DocumentReference,
      ): SchemaBatch {
        assertSchema(schema, 'batch.delete')
        const ref = resolveDocRef(db, schema, idOrRef)
        batch.delete(ref)
        return schemaBatch
      },

      commit(): Promise<void> {
        return batch.commit()
      },
    }

    return schemaBatch
  }

  async function runTransaction<TResult>(
    updateFn: (t: SchemaTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    return _runTransaction(db, async (firestoreTx) => {
      const transaction: SchemaTransaction = {
        async get<TData extends DocumentData>(
          schema: CollectionSchema<TData>,
          idOrRef: string | DocumentReference,
        ): Promise<WithId<TData> | null> {
          assertSchema(schema, 'transaction.get')
          const ref = resolveDocRef(db, schema, idOrRef)
          const snapshot = await firestoreTx.get(ref)
          return docToData(snapshot as DocumentSnapshot<TData>)
        },

        set<TData extends DocumentData>(
          schema: CollectionSchema<TData>,
          idOrRef: string | DocumentReference,
          data: TData | Partial<TData>,
          options: SetOptions = {},
        ): SchemaTransaction {
          assertSchema(schema, 'transaction.set')
          const ref = resolveDocRef(db, schema, idOrRef)
          const validated = shouldValidatePartial(options)
            ? schema.validatePartial(data)
            : schema.validate(data)
          firestoreTx.set(ref, validated, options)
          return transaction
        },

        update<TData extends DocumentData>(
          schema: CollectionSchema<TData>,
          idOrRef: string | DocumentReference,
          data: Partial<TData>,
        ): SchemaTransaction {
          assertSchema(schema, 'transaction.update')
          const ref = resolveDocRef(db, schema, idOrRef)
          const validated = schema.validatePartial(data)
          firestoreTx.update(ref as DocumentReference<DocumentData>, validated as DocumentData)
          return transaction
        },

        delete<TData extends DocumentData>(
          schema: CollectionSchema<TData>,
          idOrRef: string | DocumentReference,
        ): SchemaTransaction {
          assertSchema(schema, 'transaction.delete')
          const ref = resolveDocRef(db, schema, idOrRef)
          firestoreTx.delete(ref)
          return transaction
        },
      }

      return updateFn(transaction)
    })
  }

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
