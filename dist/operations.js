import { addDoc, collection, deleteDoc as _deleteDoc, doc, getDoc as _getDoc, getDocs as _getDocs, onSnapshot as _onSnapshot, query, runTransaction as _runTransaction, setDoc as _setDoc, updateDoc as _updateDoc, writeBatch, } from 'firebase/firestore';
function assertSchema(schema, opName) {
    if (!schema || typeof schema !== 'object' || schema._type !== 'CollectionSchema') {
        throw new TypeError(`${opName}: first argument must be a CollectionSchema from defineCollection(). ` +
            `Got: ${typeof schema}`);
    }
}
function resolveDocRef(db, schema, idOrRef) {
    if (typeof idOrRef === 'string') {
        return doc(db, schema._name, idOrRef);
    }
    if (idOrRef && typeof idOrRef.path === 'string') {
        return idOrRef;
    }
    throw new TypeError(`Expected a document ID (string) or DocumentReference, got: ${typeof idOrRef}`);
}
function collectionRef(db, schema) {
    return collection(db, schema._name);
}
function docToData(snapshot) {
    if (!snapshot.exists())
        return null;
    return { id: snapshot.id, ...snapshot.data() };
}
function snapshotToArray(querySnapshot) {
    return querySnapshot.docs.map((docSnapshot) => ({
        id: docSnapshot.id,
        ...docSnapshot.data(),
    }));
}
function shouldValidatePartial(options) {
    const hasMergeFlag = 'merge' in options && Boolean(options.merge);
    const hasMergeFields = 'mergeFields' in options && Array.isArray(options.mergeFields);
    return hasMergeFlag || hasMergeFields;
}
export function initFirestoreSchema(db) {
    if (!db)
        throw new Error('initFirestoreSchema: db (Firestore instance) is required');
    async function createDoc(schema, data) {
        assertSchema(schema, 'createDoc');
        const validated = schema.validate(data);
        const ref = await addDoc(collectionRef(db, schema), validated);
        return ref;
    }
    async function setDoc(schema, idOrRef, data, options = {}) {
        assertSchema(schema, 'setDoc');
        const ref = resolveDocRef(db, schema, idOrRef);
        const validated = shouldValidatePartial(options)
            ? schema.validatePartial(data)
            : schema.validate(data);
        await _setDoc(ref, validated, options);
    }
    async function updateDoc(schema, idOrRef, data) {
        assertSchema(schema, 'updateDoc');
        const ref = resolveDocRef(db, schema, idOrRef);
        const validated = schema.validatePartial(data);
        await _updateDoc(ref, validated);
    }
    async function deleteDoc(schema, idOrRef) {
        assertSchema(schema, 'deleteDoc');
        const ref = resolveDocRef(db, schema, idOrRef);
        await _deleteDoc(ref);
    }
    async function getDoc(schema, idOrRef) {
        assertSchema(schema, 'getDoc');
        const ref = resolveDocRef(db, schema, idOrRef);
        const snapshot = await _getDoc(ref);
        return docToData(snapshot);
    }
    async function getDocs(schema, ...constraints) {
        assertSchema(schema, 'getDocs');
        const ref = collectionRef(db, schema);
        const q = constraints.length ? query(ref, ...constraints) : ref;
        const snapshot = await _getDocs(q);
        return snapshotToArray(snapshot);
    }
    function getDocRef(schema, id) {
        assertSchema(schema, 'getDocRef');
        return doc(db, schema._name, id);
    }
    function getCollectionRef(schema) {
        assertSchema(schema, 'getCollectionRef');
        return collectionRef(db, schema);
    }
    function onDocSnapshot(schema, idOrRef, callback, onError) {
        assertSchema(schema, 'onDocSnapshot');
        const ref = resolveDocRef(db, schema, idOrRef);
        return _onSnapshot(ref, (snapshot) => callback(docToData(snapshot)), onError);
    }
    function onCollectionSnapshot(schema, callback, ...constraints) {
        assertSchema(schema, 'onCollectionSnapshot');
        const ref = collectionRef(db, schema);
        const q = constraints.length ? query(ref, ...constraints) : ref;
        return _onSnapshot(q, (snapshot) => callback(snapshotToArray(snapshot)));
    }
    function createBatch() {
        const batch = writeBatch(db);
        const schemaBatch = {
            create(schema, data) {
                assertSchema(schema, 'batch.create');
                const validated = schema.validate(data);
                const ref = doc(collectionRef(db, schema));
                batch.set(ref, validated);
                return ref;
            },
            set(schema, idOrRef, data, options = {}) {
                assertSchema(schema, 'batch.set');
                const ref = resolveDocRef(db, schema, idOrRef);
                const validated = shouldValidatePartial(options)
                    ? schema.validatePartial(data)
                    : schema.validate(data);
                batch.set(ref, validated, options);
                return schemaBatch;
            },
            update(schema, idOrRef, data) {
                assertSchema(schema, 'batch.update');
                const ref = resolveDocRef(db, schema, idOrRef);
                const validated = schema.validatePartial(data);
                batch.update(ref, validated);
                return schemaBatch;
            },
            delete(schema, idOrRef) {
                assertSchema(schema, 'batch.delete');
                const ref = resolveDocRef(db, schema, idOrRef);
                batch.delete(ref);
                return schemaBatch;
            },
            commit() {
                return batch.commit();
            },
        };
        return schemaBatch;
    }
    async function runTransaction(updateFn) {
        return _runTransaction(db, async (firestoreTx) => {
            const transaction = {
                async get(schema, idOrRef) {
                    assertSchema(schema, 'transaction.get');
                    const ref = resolveDocRef(db, schema, idOrRef);
                    const snapshot = await firestoreTx.get(ref);
                    return docToData(snapshot);
                },
                set(schema, idOrRef, data, options = {}) {
                    assertSchema(schema, 'transaction.set');
                    const ref = resolveDocRef(db, schema, idOrRef);
                    const validated = shouldValidatePartial(options)
                        ? schema.validatePartial(data)
                        : schema.validate(data);
                    firestoreTx.set(ref, validated, options);
                    return transaction;
                },
                update(schema, idOrRef, data) {
                    assertSchema(schema, 'transaction.update');
                    const ref = resolveDocRef(db, schema, idOrRef);
                    const validated = schema.validatePartial(data);
                    firestoreTx.update(ref, validated);
                    return transaction;
                },
                delete(schema, idOrRef) {
                    assertSchema(schema, 'transaction.delete');
                    const ref = resolveDocRef(db, schema, idOrRef);
                    firestoreTx.delete(ref);
                    return transaction;
                },
            };
            return updateFn(transaction);
        });
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
    };
}
//# sourceMappingURL=operations.js.map