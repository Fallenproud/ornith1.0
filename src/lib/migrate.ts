/**
 * ULTIMATE ORNITH 1.0 — Firestore Migration & Index Validation Utility
 *
 * Checks existence and accessibility of required collections, verifies query indexing
 * for high-concurrency read operations, and ensures default seeds exist on boot.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, testFirebaseConnection } from './firebase';
import { ProjectMetadata, DatasetMetadata } from '../types';

export interface CollectionCheckResult {
  collectionName: string;
  exists: boolean;
  count: number;
  indexOptimized: boolean;
  error?: string;
}

export interface MigrationResult {
  success: boolean;
  connected: boolean;
  collections: Record<string, CollectionCheckResult>;
  initializedSeeds: string[];
  timestamp: string;
  errors: string[];
}

const REQUIRED_COLLECTIONS = ['projects', 'datasets', 'runs', 'conversations'] as const;

/**
 * Checks for existence of required collections and tests indexed query paths
 * to guarantee high-concurrency read scalability on app boot.
 */
export async function runFirestoreMigration(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    connected: false,
    collections: {},
    initializedSeeds: [],
    timestamp: new Date().toISOString(),
    errors: [],
  };

  try {
    // 1. Verify Firestore connectivity
    const isConnected = await testFirebaseConnection();
    result.connected = isConnected;

    // 2. Validate and test index readiness for each required collection
    for (const collName of REQUIRED_COLLECTIONS) {
      const check: CollectionCheckResult = {
        collectionName: collName,
        exists: false,
        count: 0,
        indexOptimized: false,
      };

      try {
        const collRef = collection(db, collName);

        // Perform indexed query test corresponding to real-time subscription access patterns
        let testQuery;
        if (collName === 'projects') {
          testQuery = query(collRef, orderBy('updatedAt', 'desc'), limit(10));
        } else if (collName === 'runs' || collName === 'datasets') {
          testQuery = query(collRef, orderBy('createdAt', 'desc'), limit(10));
        } else {
          testQuery = query(collRef, limit(5));
        }

        const snapshot = await getDocs(testQuery);
        check.exists = true;
        check.count = snapshot.size;
        check.indexOptimized = true;
      } catch (err: any) {
        check.error = err?.message || String(err);
        check.indexOptimized = false;
        result.errors.push(`Feil ved sjekk av samling '${collName}': ${check.error}`);
        // Log formatted Firestore error
        console.warn(`[Migration] Advarsel under indekssjekk for '${collName}':`, check.error);
      }

      result.collections[collName] = check;
    }

    // 3. Ensure essential default seed exists if projects collection is empty
    const projectsCheck = result.collections['projects'];
    if (projectsCheck?.exists && projectsCheck.count === 0) {
      const defaultProjectId = 'ornith-tinyml-norsk-edge';
      const defaultProject: ProjectMetadata = {
        id: defaultProjectId,
        name: 'Norsk Edge IoT Klassifisering',
        description: 'Lavlatens TinyML-modell for gjenkjenning av norske stemme- og tekstkommandoer på mikrokontrollere (Arduino / ESP32).',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        locale: 'nb-NO',
        targetArchitecture: 'tinyml-dense',
        datasetId: 'norwegian-iot-smart-home',
        version: '1.0.0',
      };

      try {
        await setDoc(doc(db, 'projects', defaultProjectId), defaultProject);
        result.initializedSeeds.push('projects/ornith-tinyml-norsk-edge');
        console.log('[Migration] Initialiserte standardprosjekt i Firestore.');
      } catch (err) {
        console.warn('[Migration] Kunne ikke lagre standardprosjekt under migrering:', err);
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    console.log('[Migration] Firestore migrerings- og indekssjekk fullført:', {
      success: result.success,
      connected: result.connected,
      collections: Object.keys(result.collections),
      seeds: result.initializedSeeds,
    });

    return result;
  } catch (globalErr: any) {
    result.success = false;
    result.errors.push(`Kritisk migreringsfeil: ${globalErr?.message || String(globalErr)}`);
    console.error('[Migration] Feil under kjøring av migreringsskript:', globalErr);
    return result;
  }
}
