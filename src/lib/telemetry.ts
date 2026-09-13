/**
 * ULTIMATE ORNITH 1.0 — Firestore Performance & Scalability Telemetry Logger
 * 
 * Provides real-time metrics, high-concurrency read detection, and scalability
 * observability for Firestore real-time onSnapshot streams.
 */

import { QuerySnapshot, DocumentData } from 'firebase/firestore';

export interface SnapshotTelemetryEntry {
  id: string;
  timestamp: number;
  collection: string;
  docCount: number;
  changeCount: number;
  fromCache: boolean;
  hasPendingWrites: boolean;
  processingDurationMs: number;
  concurrencyWindowCount: number; // snapshots received in last 5 seconds
  estimatedPayloadKb: number;
  isHighConcurrencyBurst: boolean;
}

export interface ScalabilityMetricsSummary {
  totalSnapshots: number;
  totalDocsRead: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  highConcurrencyEvents: number;
  currentReadsPerSec: number;
  cacheHitRatio: number;
  lastEventTimestamp: number | null;
}

// In-memory sliding window of recent telemetry events
const telemetryBuffer: SnapshotTelemetryEntry[] = [];
const MAX_BUFFER_SIZE = 200;
const CONCURRENCY_WINDOW_MS = 5000;
const HIGH_CONCURRENCY_THRESHOLD_EVENTS = 3; // >= 3 snapshot bursts in 5s
const HIGH_DOC_VOLUME_THRESHOLD = 50;

type TelemetryListener = (summary: ScalabilityMetricsSummary, recentEntries: SnapshotTelemetryEntry[]) => void;
const listeners: Set<TelemetryListener> = new Set();

function notifyListeners() {
  if (listeners.size === 0) return;
  const summary = getScalabilityMetrics();
  const recent = telemetryBuffer.slice(-20);
  listeners.forEach((fn) => {
    try {
      fn(summary, recent);
    } catch (e) {
      console.error('Error in telemetry listener:', e);
    }
  });
}

/**
 * Subscribes to live performance telemetry updates.
 */
export function subscribeToTelemetry(callback: TelemetryListener): () => void {
  listeners.add(callback);
  // Send immediate initial state
  callback(getScalabilityMetrics(), telemetryBuffer.slice(-20));
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Returns recent telemetry entry buffer.
 */
export function getTelemetryHistory(limitCount: number = 30): SnapshotTelemetryEntry[] {
  return telemetryBuffer.slice(-limitCount);
}

/**
 * Records performance telemetry for a Firestore onSnapshot read event.
 */
export function recordSnapshotPerformance(
  collectionName: string,
  snapshot: QuerySnapshot<DocumentData>,
  startTimeMs: number
): SnapshotTelemetryEntry {
  const endTimeMs = performance.now();
  const durationMs = Math.max(0, Math.round((endTimeMs - startTimeMs) * 100) / 100);
  const now = Date.now();

  const docCount = snapshot.docs.length;
  let changeCount = 0;
  try {
    changeCount = snapshot.docChanges ? snapshot.docChanges().length : docCount;
  } catch {
    changeCount = docCount;
  }

  // Estimate payload size in KB (approximated based on document keys & json strings)
  let estimatedBytes = 0;
  for (const doc of snapshot.docs) {
    try {
      const dataStr = JSON.stringify(doc.data());
      estimatedBytes += dataStr.length + doc.id.length;
    } catch {
      estimatedBytes += 256;
    }
  }
  const estimatedPayloadKb = Math.round((estimatedBytes / 1024) * 100) / 100;

  // Count events in recent concurrency window
  const windowStart = now - CONCURRENCY_WINDOW_MS;
  const recentEvents = telemetryBuffer.filter(e => e.timestamp >= windowStart);
  const concurrencyWindowCount = recentEvents.length + 1;

  const isHighConcurrencyBurst = 
    concurrencyWindowCount >= HIGH_CONCURRENCY_THRESHOLD_EVENTS || 
    docCount >= HIGH_DOC_VOLUME_THRESHOLD;

  const entry: SnapshotTelemetryEntry = {
    id: `tel-${now.toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    collection: collectionName,
    docCount,
    changeCount,
    fromCache: snapshot.metadata.fromCache,
    hasPendingWrites: snapshot.metadata.hasPendingWrites,
    processingDurationMs: durationMs,
    concurrencyWindowCount,
    estimatedPayloadKb,
    isHighConcurrencyBurst,
  };

  telemetryBuffer.push(entry);
  if (telemetryBuffer.length > MAX_BUFFER_SIZE) {
    telemetryBuffer.shift();
  }

  // Notify live UI monitors
  notifyListeners();

  // High-concurrency logging & telemetry report
  if (isHighConcurrencyBurst) {
    console.warn(
      `[Firestore Scalability Alert] High-concurrency read burst detected on collection '${collectionName}':`,
      {
        collection: collectionName,
        eventsInWindow5s: concurrencyWindowCount,
        docsInSnapshot: docCount,
        changesCount: changeCount,
        processingTimeMs: `${durationMs}ms`,
        estimatedPayload: `${estimatedPayloadKb} KB`,
        fromCache: snapshot.metadata.fromCache,
        timestampIso: new Date(now).toISOString(),
        recommendation: docCount > 100 
          ? 'Consider adding query limit() or cursor pagination to optimize snapshot bandwidth.'
          : 'High write/update frequency observed; batching or debouncing client writes recommended.',
      }
    );
  } else {
    // Normal level structured telemetry log
    console.info(
      `[Firestore Telemetry] onSnapshot '${collectionName}' — ${docCount} docs (${changeCount} changed) in ${durationMs}ms [Cache: ${snapshot.metadata.fromCache}]`
    );
  }

  return entry;
}

/**
 * Returns current scalability and telemetry metrics summary.
 */
export function getScalabilityMetrics(): ScalabilityMetricsSummary {
  if (telemetryBuffer.length === 0) {
    return {
      totalSnapshots: 0,
      totalDocsRead: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0,
      highConcurrencyEvents: 0,
      currentReadsPerSec: 0,
      cacheHitRatio: 0,
      lastEventTimestamp: null,
    };
  }

  const totalSnapshots = telemetryBuffer.length;
  const totalDocsRead = telemetryBuffer.reduce((acc, curr) => acc + curr.docCount, 0);
  const totalDuration = telemetryBuffer.reduce((acc, curr) => acc + curr.processingDurationMs, 0);
  const durations = telemetryBuffer.map(e => e.processingDurationMs);
  const minDurationMs = Math.min(...durations);
  const maxDurationMs = Math.max(...durations);
  const highConcurrencyEvents = telemetryBuffer.filter(e => e.isHighConcurrencyBurst).length;
  const cachedCount = telemetryBuffer.filter(e => e.fromCache).length;
  const cacheHitRatio = Math.round((cachedCount / totalSnapshots) * 100);

  const now = Date.now();
  const windowStart = now - 5000;
  const eventsInLast5s = telemetryBuffer.filter(e => e.timestamp >= windowStart);
  const docsInLast5s = eventsInLast5s.reduce((acc, curr) => acc + curr.docCount, 0);
  const currentReadsPerSec = Math.round((docsInLast5s / 5) * 10) / 10;

  return {
    totalSnapshots,
    totalDocsRead,
    avgDurationMs: Math.round((totalDuration / totalSnapshots) * 100) / 100,
    minDurationMs: Math.round(minDurationMs * 100) / 100,
    maxDurationMs: Math.round(maxDurationMs * 100) / 100,
    highConcurrencyEvents,
    currentReadsPerSec,
    cacheHitRatio,
    lastEventTimestamp: telemetryBuffer[telemetryBuffer.length - 1].timestamp,
  };
}

