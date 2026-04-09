import type { CollectionReference, DocumentData, DocumentReference, Firestore, QueryConstraint, SetOptions, Unsubscribe } from 'firebase/firestore';
import type { CollectionSchema } from './collection.js';
export type WithId<TData extends DocumentData> = TData & {
    id: string;
};
export interface SchemaBatch {
    create: <TData extends DocumentData>(schema: CollectionSchema<TData>, data: TData) => DocumentReference<TData>;
    set: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: TData | Partial<TData>, options?: SetOptions) => SchemaBatch;
    update: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: Partial<TData>) => SchemaBatch;
    delete: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference) => SchemaBatch;
    commit: () => Promise<void>;
}
export interface SchemaTransaction {
    get: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference) => Promise<WithId<TData> | null>;
    set: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: TData | Partial<TData>, options?: SetOptions) => SchemaTransaction;
    update: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: Partial<TData>) => SchemaTransaction;
    delete: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference) => SchemaTransaction;
}
export interface FirestoreSchemaOperations {
    createDoc: <TData extends DocumentData>(schema: CollectionSchema<TData>, data: TData) => Promise<DocumentReference<TData>>;
    setDoc: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: TData | Partial<TData>, options?: SetOptions) => Promise<void>;
    updateDoc: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, data: Partial<TData>) => Promise<void>;
    deleteDoc: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference) => Promise<void>;
    getDoc: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference) => Promise<WithId<TData> | null>;
    getDocs: <TData extends DocumentData>(schema: CollectionSchema<TData>, ...constraints: QueryConstraint[]) => Promise<Array<WithId<TData>>>;
    getDocRef: <TData extends DocumentData>(schema: CollectionSchema<TData>, id: string) => DocumentReference<TData>;
    getCollectionRef: <TData extends DocumentData>(schema: CollectionSchema<TData>) => CollectionReference<TData>;
    onDocSnapshot: <TData extends DocumentData>(schema: CollectionSchema<TData>, idOrRef: string | DocumentReference, callback: (data: WithId<TData> | null) => void, onError?: (error: Error) => void) => Unsubscribe;
    onCollectionSnapshot: <TData extends DocumentData>(schema: CollectionSchema<TData>, callback: (docs: Array<WithId<TData>>) => void, ...constraints: QueryConstraint[]) => Unsubscribe;
    createBatch: () => SchemaBatch;
    runTransaction: <TResult>(updateFn: (t: SchemaTransaction) => Promise<TResult>) => Promise<TResult>;
}
export declare function initFirestoreSchema(db: Firestore): FirestoreSchemaOperations;
//# sourceMappingURL=operations.d.ts.map