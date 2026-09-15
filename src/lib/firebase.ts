import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
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
  updateDoc,
  deleteDoc,
  getDocFromServer,
  Unsubscribe,
  orderBy,
  limit,
} from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";
import {
  DatasetValidationRule,
  ProjectValidationConfig,
  ProjectMetadata,
  ModelArtifact,
} from "../types";
import { recordSnapshotPerformance } from "./telemetry";

export let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const db: Firestore = getFirestore(
  app,
  (firebaseConfig as any).firestoreDatabaseId || undefined,
);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      tenantId: "default-tenant",
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by firebase skill
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.log("[Firebase] Firestore-tilkobling validert.");
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.warn(
        "[Firebase] Klienten er offline, vennligst sjekk nettverk eller Firebase-konfigurasjon.",
      );
    } else {
      console.log("[Firebase] Initialisert og klar.");
    }
    return false;
  }
}

// -------------------------------------------------------------
// In-Memory Read Memoization & Request Batching Cache
// -------------------------------------------------------------
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

const readCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
const DEFAULT_CACHE_TTL_MS = 15000; // 15 seconds memoization window

/**
 * Invalidates cache entries matching the specified path prefix or all if omitted.
 */
export function invalidateFirestoreCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    readCache.clear();
    return;
  }
  for (const key of readCache.keys()) {
    if (key.startsWith(pathPrefix)) {
      readCache.delete(key);
    }
  }
}

/**
 * Batch-deduplicated and memoized Firestore document fetcher.
 */
async function cachedGetDoc<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_CACHE_TTL_MS,
  forceRefresh: boolean = false,
): Promise<T> {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = readCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }
  }

  // De-duplicate in-flight requests
  let pending = inFlightRequests.get(cacheKey);
  if (!pending) {
    pending = fetcher().finally(() => {
      inFlightRequests.delete(cacheKey);
    });
    inFlightRequests.set(cacheKey, pending);
  }

  const result = await pending;
  readCache.set(cacheKey, {
    data: result,
    timestamp: now,
    expiresAt: now + ttlMs,
  });
  return result;
}

export async function getProjectValidationConfig(
  projectId: string,
  options?: { forceRefresh?: boolean; ttlMs?: number },
): Promise<ProjectValidationConfig | null> {
  const cacheKey = `projects/${projectId}/validationConfig`;
  try {
    return await cachedGetDoc(
      cacheKey,
      async () => {
        const docRef = doc(db, "projects", projectId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          return (snap.data().validationConfig as ProjectValidationConfig) || null;
        }
        return null;
      },
      options?.ttlMs || DEFAULT_CACHE_TTL_MS,
      options?.forceRefresh,
    );
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `projects/${projectId}`);
  }
}

export async function getProjectValidationRules(
  projectId: string,
  options?: { forceRefresh?: boolean; ttlMs?: number },
): Promise<DatasetValidationRule[]> {
  const cacheKey = `projects/${projectId}/validation_rules`;
  try {
    return await cachedGetDoc(
      cacheKey,
      async () => {
        const colRef = collection(db, "projects", projectId, "validation_rules");
        const snap = await getDocs(colRef);
        return snap.docs.map((d) => d.data() as DatasetValidationRule);
      },
      options?.ttlMs || DEFAULT_CACHE_TTL_MS,
      options?.forceRefresh,
    );
  } catch (e) {
    handleFirestoreError(
      e,
      OperationType.LIST,
      `projects/${projectId}/validation_rules`,
    );
  }
}

export async function saveProjectValidationRulesTransactional(
  projectId: string,
  config: ProjectValidationConfig,
): Promise<ProjectValidationConfig> {
  try {
    await runTransaction(db, async (transaction) => {
      const projRef = doc(db, "projects", projectId);
      config.lastSavedToFirestore = new Date().toISOString();
      transaction.update(projRef, { validationConfig: config });
    });
    // Invalidate local read cache for project
    invalidateFirestoreCache(`projects/${projectId}`);
    return config;
  } catch (e) {
    handleFirestoreError(
      e,
      OperationType.WRITE,
      `projects/${projectId}/validationConfig`,
    );
  }
}

export async function saveDatasetValidationRuleTransactional(
  projectId: string,
  rule: DatasetValidationRule,
): Promise<void> {
  try {
    const ruleRef = doc(db, "projects", projectId, "validation_rules", rule.id);
    await setDoc(ruleRef, rule);
    invalidateFirestoreCache(`projects/${projectId}/validation_rules`);
  } catch (e) {
    handleFirestoreError(
      e,
      OperationType.WRITE,
      `projects/${projectId}/validation_rules/${rule.id}`,
    );
  }
}

export async function deleteDatasetValidationRuleTransactional(
  projectId: string,
  ruleId: string,
): Promise<void> {
  try {
    const ruleRef = doc(db, "projects", projectId, "validation_rules", ruleId);
    await deleteDoc(ruleRef);
    invalidateFirestoreCache(`projects/${projectId}/validation_rules`);
  } catch (e) {
    handleFirestoreError(
      e,
      OperationType.DELETE,
      `projects/${projectId}/validation_rules/${ruleId}`,
    );
  }
}

export async function updateValidationRule(
  projectId: string,
  rule: DatasetValidationRule,
): Promise<void> {
  try {
    await runTransaction(db, async (transaction) => {
      const projRef = doc(db, "projects", projectId);
      const ruleRef = doc(
        db,
        "projects",
        projectId,
        "validation_rules",
        rule.id,
      );

      const projSnap = await transaction.get(projRef);
      if (projSnap.exists()) {
        transaction.update(projRef, { updatedAt: new Date().toISOString() });
      }
      transaction.set(ruleRef, rule, { merge: true });
    });
    invalidateFirestoreCache(`projects/${projectId}`);
  } catch (e) {
    handleFirestoreError(
      e,
      OperationType.UPDATE,
      `projects/${projectId}/validation_rules/${rule.id}`,
    );
  }
}

// -------------------------------------------------------------
// Real-Time Model Export Status & Artifacts Synchronization
// -------------------------------------------------------------

export interface FirestoreExportStatusPayload {
  status: "ready" | "exporting" | "pending" | "failed";
  exportPhase?: string;
  exportProgress?: number;
  lastExportedAt?: string;
  updatedAt?: string;
  exports?: {
    tflite?: { status: "ready" | "exporting" | "pending" | "failed"; sizeBytes?: number; url?: string };
    savedModel?: { status: "ready" | "exporting" | "pending" | "failed"; sizeBytes?: number; url?: string };
    cHeader?: { status: "ready" | "exporting" | "pending" | "failed"; sizeBytes?: number; url?: string };
    zipPackage?: { status: "ready" | "exporting" | "pending" | "failed"; sizeBytes?: number; url?: string };
  };
  artifactsCount?: number;
  error?: string;
}

/**
 * Subscribes to real-time export status on a specific training run or the latest run.
 */
export function subscribeToRunExport(
  runId: string | undefined,
  onUpdate: (data: FirestoreExportStatusPayload | null) => void,
): Unsubscribe {
  const startTime = performance.now();

  if (runId) {
    const runRef = doc(db, "runs", runId);
    return onSnapshot(
      runRef,
      (snap) => {
        recordSnapshotPerformance("runs", snap, startTime);
        if (snap.exists()) {
          const runData = snap.data();
          const exportPayload: FirestoreExportStatusPayload = {
            status: runData.exportStatus || (runData.status === "running" ? "exporting" : runData.status === "completed" ? "ready" : "pending"),
            exportPhase: runData.exportPhase,
            exportProgress: runData.exportProgress,
            lastExportedAt: runData.lastExportedAt || runData.completedAt,
            updatedAt: runData.updatedAt || new Date().toISOString(),
            exports: runData.exports,
            artifactsCount: runData.checkpointPaths?.length || 0,
            error: runData.failureReason,
          };
          onUpdate(exportPayload);
        } else {
          onUpdate(null);
        }
      },
      (err) => {
        console.warn("[Firebase] Feil ved lytting på run export status:", err);
      },
    );
  }

  // If no runId provided, listen to latest run in runs collection
  const runsQuery = query(collection(db, "runs"), orderBy("createdAt", "desc"), limit(1));
  return onSnapshot(
    runsQuery,
    (snapshot) => {
      recordSnapshotPerformance("runs", snapshot, startTime);
      if (!snapshot.empty) {
        const runData = snapshot.docs[0].data();
        const exportPayload: FirestoreExportStatusPayload = {
          status: runData.exportStatus || (runData.status === "running" ? "exporting" : runData.status === "completed" ? "ready" : "pending"),
          exportPhase: runData.exportPhase,
          exportProgress: runData.exportProgress,
          lastExportedAt: runData.lastExportedAt || runData.completedAt,
          updatedAt: runData.updatedAt || new Date().toISOString(),
          exports: runData.exports,
          artifactsCount: runData.checkpointPaths?.length || 0,
          error: runData.failureReason,
        };
        onUpdate(exportPayload);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn("[Firebase] Feil ved lytting på latest run export status:", err);
    },
  );
}

/**
 * Subscribes to real-time artifacts collection in Firestore.
 */
export function subscribeToArtifacts(
  callback: (artifacts: ModelArtifact[]) => void,
  runId?: string,
): Unsubscribe {
  const startTime = performance.now();
  const artifactsRef = collection(db, "artifacts");
  const q = query(artifactsRef, orderBy("createdAt", "desc"), limit(25));

  return onSnapshot(
    q,
    (snapshot) => {
      recordSnapshotPerformance("artifacts", snapshot, startTime);
      const items: ModelArtifact[] = [];
      snapshot.forEach((d) => {
        const art = d.data() as ModelArtifact;
        if (!runId || art.runId === runId) {
          items.push(art);
        }
      });
      callback(items);
    },
    (err) => {
      console.warn("[Firebase] Feil ved lytting på artifacts collection:", err);
    },
  );
}

/**
 * Updates or persists run export status in Firestore in real-time.
 */
export async function updateRunExportStatusInFirestore(
  runId: string,
  payload: Partial<FirestoreExportStatusPayload>,
): Promise<void> {
  try {
    const runRef = doc(db, "runs", runId);
    const updateData: any = {
      exportStatus: payload.status,
      updatedAt: new Date().toISOString(),
    };
    if (payload.exportPhase !== undefined) updateData.exportPhase = payload.exportPhase;
    if (payload.exportProgress !== undefined) updateData.exportProgress = payload.exportProgress;
    if (payload.lastExportedAt !== undefined) updateData.lastExportedAt = payload.lastExportedAt;
    if (payload.exports !== undefined) updateData.exports = payload.exports;
    if (payload.error !== undefined) updateData.failureReason = payload.error;

    await setDoc(runRef, updateData, { merge: true });
    invalidateFirestoreCache(`runs/${runId}`);
  } catch (err) {
    console.error("[Firebase] Kunne ikke oppdatere export status i Firestore:", err);
  }
}

/**
 * Syncs a batch of model artifacts directly into Firestore for real-time tracking.
 */
export async function syncArtifactsToFirestore(
  artifacts: ModelArtifact[],
): Promise<void> {
  try {
    const promises = artifacts.map((art) => {
      const artRef = doc(db, "artifacts", art.id);
      return setDoc(
        artRef,
        {
          ...art,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });
    await Promise.all(promises);
  } catch (err) {
    console.warn("[Firebase] Feil ved synkronisering av artefakter til Firestore:", err);
  }
}

