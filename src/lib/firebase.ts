import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  onSnapshot,
  runTransaction,
  setDoc,
  deleteDoc,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { DatasetValidationRule, ProjectValidationConfig, ProjectMetadata } from '../types';

export let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      tenantId: 'default-tenant',
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by firebase skill
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Firestore-tilkobling validert.');
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Klienten er offline, vennligst sjekk nettverk eller Firebase-konfigurasjon.');
    } else {
      console.log('[Firebase] Initialisert og klar.');
    }
    return false;
  }
}

// ============================================================================
// Standardized High-Concurrency Safe Dataset Validation Rules Interface
// ============================================================================

/**
 * Reads the full project validation configuration from Firestore.
 * Performs safe retrieval with structured error handling.
 */
export async function getProjectValidationConfig(projectId: string): Promise<ProjectValidationConfig | null> {
  const projectDocPath = `projects/${projectId}`;
  try {
    const projectRef = doc(db, 'projects', projectId);
    const snap = await getDoc(projectRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data() as ProjectMetadata;
    return data.validationConfig || null;
  } catch (error) {
    return handleFirestoreError(error, OperationType.GET, projectDocPath);
  }
}

/**
 * Reads the active validation rules for a given project from Firestore.
 * Checks both the project document and the validation_rules subcollection.
 */
export async function getProjectValidationRules(projectId: string): Promise<DatasetValidationRule[]> {
  const path = `projects/${projectId}/validation_rules`;
  try {
    // 1. Try reading subcollection for granular rules
    const rulesCollectionRef = collection(db, 'projects', projectId, 'validation_rules');
    const q = query(rulesCollectionRef);
    const snap = await getDocs(q);

    if (!snap.empty) {
      const subcollectionRules: DatasetValidationRule[] = [];
      snap.forEach((docSnap) => {
        subcollectionRules.push(docSnap.data() as DatasetValidationRule);
      });
      return subcollectionRules;
    }

    // 2. Fallback to project document validationConfig
    const config = await getProjectValidationConfig(projectId);
    return config?.rules || [];
  } catch (error) {
    return handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Concurrency-safe atomic transaction to save and synchronize all validation rules for a project.
 * Uses `runTransaction` to guarantee optimistic concurrency control and avoid lost updates.
 */
export async function saveProjectValidationRulesTransactional(
  projectId: string,
  params: {
    rules: DatasetValidationRule[];
    strictMode?: boolean;
    autoCleanWhitespace?: boolean;
  }
): Promise<ProjectValidationConfig> {
  const projectPath = `projects/${projectId}`;
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (transaction) => {
      const projectRef = doc(db, 'projects', projectId);
      const projectDoc = await transaction.get(projectRef);

      const existingData = projectDoc.exists() ? (projectDoc.data() as ProjectMetadata) : null;
      const currentConfig = existingData?.validationConfig;

      const updatedRules: DatasetValidationRule[] = params.rules.map((r) => ({
        ...r,
        firestoreSynced: true,
        updatedAt: nowIso,
      }));

      const newConfig: ProjectValidationConfig = {
        rules: updatedRules,
        strictMode: params.strictMode !== undefined ? params.strictMode : Boolean(currentConfig?.strictMode),
        autoCleanWhitespace:
          params.autoCleanWhitespace !== undefined
            ? params.autoCleanWhitespace
            : currentConfig?.autoCleanWhitespace !== false,
        lastValidatedAt: nowIso,
        lastSavedToFirestore: nowIso,
      };

      // Atomic update of the project document
      transaction.set(
        projectRef,
        {
          validationConfig: newConfig,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      // Atomic write to individual rule subcollection documents
      for (const rule of updatedRules) {
        const ruleDocRef = doc(db, 'projects', projectId, 'validation_rules', rule.id);
        transaction.set(ruleDocRef, rule, { merge: true });
      }

      return newConfig;
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.WRITE, projectPath);
  }
}

/**
 * Concurrency-safe atomic upsert for a single dataset validation rule.
 * Uses `runTransaction` to safely modify the rule in the parent project's config array
 * as well as the subcollection document without racing.
 */
export async function saveDatasetValidationRuleTransactional(
  projectId: string,
  rule: DatasetValidationRule
): Promise<DatasetValidationRule> {
  const rulePath = `projects/${projectId}/validation_rules/${rule.id}`;
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (transaction) => {
      const projectRef = doc(db, 'projects', projectId);
      const ruleRef = doc(db, 'projects', projectId, 'validation_rules', rule.id);

      const projectDoc = await transaction.get(projectRef);
      const projectData = projectDoc.exists() ? (projectDoc.data() as ProjectMetadata) : null;
      const existingConfig = projectData?.validationConfig;
      const existingRules = existingConfig?.rules || [];

      const syncedRule: DatasetValidationRule = {
        ...rule,
        firestoreSynced: true,
        updatedAt: nowIso,
      };

      const ruleIndex = existingRules.findIndex((r) => r.id === rule.id);
      let updatedRulesList: DatasetValidationRule[];
      if (ruleIndex >= 0) {
        updatedRulesList = [
          ...existingRules.slice(0, ruleIndex),
          syncedRule,
          ...existingRules.slice(ruleIndex + 1),
        ];
      } else {
        updatedRulesList = [...existingRules, syncedRule];
      }

      const updatedConfig: ProjectValidationConfig = {
        rules: updatedRulesList,
        strictMode: Boolean(existingConfig?.strictMode),
        autoCleanWhitespace: existingConfig?.autoCleanWhitespace !== false,
        lastValidatedAt: nowIso,
        lastSavedToFirestore: nowIso,
      };

      // Set subcollection rule document atomically
      transaction.set(ruleRef, syncedRule, { merge: true });

      // Update parent project document atomically
      transaction.set(
        projectRef,
        {
          validationConfig: updatedConfig,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      return syncedRule;
    });
  } catch (error) {
    return handleFirestoreError(error, OperationType.UPDATE, rulePath);
  }
}

/**
 * Concurrency-safe atomic deletion of a dataset validation rule.
 * Uses `runTransaction` to remove the rule from the project config and delete the rule subdocument.
 */
export async function deleteDatasetValidationRuleTransactional(
  projectId: string,
  ruleId: string
): Promise<void> {
  const rulePath = `projects/${projectId}/validation_rules/${ruleId}`;
  const nowIso = new Date().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const projectRef = doc(db, 'projects', projectId);
      const ruleRef = doc(db, 'projects', projectId, 'validation_rules', ruleId);

      const projectDoc = await transaction.get(projectRef);
      const projectData = projectDoc.exists() ? (projectDoc.data() as ProjectMetadata) : null;
      const existingConfig = projectData?.validationConfig;
      const existingRules = existingConfig?.rules || [];

      const filteredRules = existingRules.filter((r) => r.id !== ruleId);

      const updatedConfig: ProjectValidationConfig = {
        rules: filteredRules,
        strictMode: Boolean(existingConfig?.strictMode),
        autoCleanWhitespace: existingConfig?.autoCleanWhitespace !== false,
        lastValidatedAt: nowIso,
        lastSavedToFirestore: nowIso,
      };

      // Delete subcollection document atomically
      transaction.delete(ruleRef);

      // Update parent project document atomically
      transaction.set(
        projectRef,
        {
          validationConfig: updatedConfig,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, rulePath);
  }
}

/**
 * Real-time subscription listener for a project's validation configuration.
 * Returns an unsubscribe function to clean up listeners on unmount.
 */
export function subscribeToProjectValidationRules(
  projectId: string,
  onUpdate: (config: ProjectValidationConfig) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const projectRef = doc(db, 'projects', projectId);
  return onSnapshot(
    projectRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as ProjectMetadata;
        if (data.validationConfig) {
          onUpdate(data.validationConfig);
        }
      }
    },
    (err) => {
      console.error(`[Firestore Subscription Error] Project ${projectId}:`, err);
      if (onError) onError(err);
    }
  );
}

