/**
 * ULTIMATE ORNITH 1.0 — Real-Time Resource Telemetry (Firebase Stream)
 *
 * Subscribes to the live Firestore document `telemetry_resources/live` to track
 * training environment RAM (RSS, Heap, External) and CPU load in real time.
 */

import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "./firebase";
import { ResourceTelemetryPoint, ResourceTelemetryDocument } from "../types";
import { recordSnapshotPerformance } from "./telemetry";

export interface ResourceStreamState {
  current: ResourceTelemetryPoint | null;
  history: ResourceTelemetryPoint[];
  isConnected: boolean;
  lastUpdated: string | null;
  error: string | null;
}

const DEFAULT_POINT: ResourceTelemetryPoint = {
  timestamp: new Date().toISOString(),
  cpuPercent: 0,
  ramUsedMb: 0,
  ramTotalMb: 512,
  ramPercent: 0,
  heapUsedMb: 0,
  heapTotalMb: 0,
  trainingStatus: "idle",
};

/**
 * Subscribes to the live Firebase stream for training environment resources
 */
export function subscribeToResourceStream(
  onUpdate: (data: {
    current: ResourceTelemetryPoint;
    history: ResourceTelemetryPoint[];
    source: "firestore" | "rest";
  }) => void
): () => void {
  let isSubscribed = true;
  let fallbackInterval: NodeJS.Timeout | null = null;

  // Helper to fetch fallback via REST
  const fetchRestFallback = async () => {
    try {
      const res = await fetch("/api/telemetry/resources");
      if (res.ok) {
        const json = await res.json();
        if (isSubscribed && json.current) {
          onUpdate({
            current: json.current,
            history: json.history || [json.current],
            source: "rest",
          });
        }
      }
    } catch (e) {
      // Ignore network hiccup
    }
  };

  // Immediate initial load
  fetchRestFallback();

  // Establish Firestore live stream
  let firestoreUnsub: Unsubscribe | null = null;
  try {
    const liveDocRef = doc(db, "telemetry_resources", "live");
    const startTime = performance.now();

    firestoreUnsub = onSnapshot(
      liveDocRef,
      (snapshot) => {
        recordSnapshotPerformance("telemetry_resources", snapshot, startTime);

        if (snapshot.exists() && isSubscribed) {
          const data = snapshot.data() as ResourceTelemetryDocument;
          if (data && data.current) {
            onUpdate({
              current: data.current,
              history: data.history || [data.current],
              source: "firestore",
            });
          }
        }
      },
      (error) => {
        console.warn("[ResourceStream] Firestore stream warning:", error.message);
        // If Firestore stream errors or is restricted, fallback to polling
        if (!fallbackInterval && isSubscribed) {
          fallbackInterval = setInterval(fetchRestFallback, 2000);
        }
      }
    );
  } catch (err) {
    console.warn("[ResourceStream] Failed to initialize Firestore listener:", err);
    fallbackInterval = setInterval(fetchRestFallback, 2000);
  }

  // Polling fallback check in case Firestore updates are delayed
  const heartbeatInterval = setInterval(() => {
    fetchRestFallback();
  }, 4000);

  return () => {
    isSubscribed = false;
    if (firestoreUnsub) {
      try {
        firestoreUnsub();
      } catch {}
    }
    if (fallbackInterval) clearInterval(fallbackInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  };
}
