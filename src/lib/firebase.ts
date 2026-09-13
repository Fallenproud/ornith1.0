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
 * Concurrency-safe helper to update a single dataset validation rule in Firestore.
 * Persists the rule atomically to the project document and subcollection.
 */
export async function updateValidationRule(
  projectId: string,
  rule: DatasetValidationRule
): Promise<DatasetValidationRule> {
  return await saveDatasetValidationRuleTransactional(projectId, rule);
}

/**
 * Mapped export readiness details for Firestore snapshot data.
 */
export interface MappedExportStatus {
  tflite: 'ready' | 'exporting' | 'pending' | 'failed';
  savedModel: 'ready' | 'exporting' | 'pending' | 'failed';
  cHeader: 'ready' | 'exporting' | 'pending' | 'failed';
  overall: 'ready' | 'exporting' | 'pending' | 'failed';
  readyForDownload: boolean;
  tfliteSizeBytes?: number;
  savedModelSizeBytes?: number;
  lastExportedAt?: string;
  indicatorColor: 'green' | 'yellow' | 'red' | 'gray';
  statusText: string;
}

/**
 * Maps model export and readiness status from Firestore snapshot data (e.g. TrainingRun, Artifact, or Project).
 * Allows UI components to render instant green/yellow/red indicators for .tflite, SavedModel, and C-headers.
 */
export function mapExportStatusFromSnapshot(snapshotData: any): MappedExportStatus {
  if (!snapshotData) {
    return {
      tflite: 'pending',
      savedModel: 'pending',
      cHeader: 'pending',
      overall: 'pending',
      readyForDownload: false,
      indicatorColor: 'gray',
      statusText: 'Ingen eksportdata funnet',
    };
  }

  // Check if snapshotData is a direct TrainingRun or has export status fields
  const runStatus = snapshotData.status || snapshotData.trainingStatus;
  const isRunning = runStatus === 'running' || snapshotData.isTraining === true;
  const isCompleted = runStatus === 'completed' || snapshotData.completed === true || snapshotData.accuracy !== undefined;
  const isFailed = runStatus === 'failed' || snapshotData.error !== undefined;

  // Granular artifact exports state if provided
  const exportsInfo = snapshotData.exports || snapshotData.artifacts || {};
  const tfliteState: 'ready' | 'exporting' | 'pending' | 'failed' =
    exportsInfo.tflite?.status || (isCompleted ? 'ready' : isRunning ? 'exporting' : isFailed ? 'failed' : 'pending');
  const savedModelState: 'ready' | 'exporting' | 'pending' | 'failed' =
    exportsInfo.savedModel?.status || (isCompleted ? 'ready' : isRunning ? 'exporting' : isFailed ? 'failed' : 'pending');
  const cHeaderState: 'ready' | 'exporting' | 'pending' | 'failed' =
    exportsInfo.cHeader?.status || (isCompleted ? 'ready' : isRunning ? 'exporting' : isFailed ? 'failed' : 'pending');

  let overall: 'ready' | 'exporting' | 'pending' | 'failed' = 'pending';
  let indicatorColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray';
  let statusText = 'Venter på treningsfullføring';

  if (tfliteState === 'ready' || savedModelState === 'ready' || isCompleted) {
    overall = 'ready';
    indicatorColor = 'green';
    statusText = 'TensorFlow-modeller er klare for nedlasting (.tflite / SavedModel)';
  } else if (isRunning || tfliteState === 'exporting' || savedModelState === 'exporting') {
    overall = 'exporting';
    indicatorColor = 'yellow';
    statusText = 'Kompilerer og serialiserer TensorFlow-artefakter...';
  } else if (isFailed || tfliteState === 'failed') {
    overall = 'failed';
    indicatorColor = 'red';
    statusText = 'Eksport eller trening feilet';
  }

  return {
    tflite: tfliteState,
    savedModel: savedModelState,
    cHeader: cHeaderState,
    overall,
    readyForDownload: overall === 'ready',
    tfliteSizeBytes: exportsInfo.tflite?.sizeBytes || snapshotData.tfliteSizeBytes,
    savedModelSizeBytes: exportsInfo.savedModel?.sizeBytes || snapshotData.savedModelSizeBytes,
    lastExportedAt: snapshotData.updatedAt || snapshotData.completedAt || snapshotData.createdAt,
    indicatorColor,
    statusText,
  };
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



