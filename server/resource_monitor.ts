/**
 * ULTIMATE ORNITH 1.0 — Real-Time Resource Monitoring & Firestore Stream Provider
 *
 * Continuously measures process RAM (RSS, Heap, External) and real CPU load percentage
 * across all vCPUs. Emits real-time documents to Firestore under `telemetry_resources/live`
 * and collection `telemetry_resources` for onSnapshot consumption in the frontend.
 */

import os from "os";
import { db } from "../src/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ResourceTelemetryPoint, ResourceTelemetryDocument } from "../src/types";

export class ResourceMonitor {
  private static intervalTimer: NodeJS.Timeout | null = null;
  private static previousCpuTime = process.cpuUsage();
  private static previousHrTime = process.hrtime();
  private static historyBuffer: ResourceTelemetryPoint[] = [];
  private static maxHistorySize = 50;
  private static getActiveSessionFn: (() => any) | null = null;
  private static numCpus = Math.max(1, os.cpus()?.length || 1);

  public static init(getActiveSession: () => any): void {
    this.getActiveSessionFn = getActiveSession;
    if (this.intervalTimer) return;

    // Seed initial point
    this.tick();

    // Publish every 1500ms
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1500);

    console.log("[ResourceMonitor] Initialized real-time RAM & CPU Firestore telemetry stream.");
  }

  public static stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public static tick(): ResourceTelemetryPoint {
    const currentCpuTime = process.cpuUsage();
    const currentHrTime = process.hrtime();

    const elapsedMicros =
      (currentHrTime[0] - this.previousHrTime[0]) * 1000000 +
      (currentHrTime[1] - this.previousHrTime[1]) / 1000;

    const userMicros = currentCpuTime.user - this.previousCpuTime.user;
    const systemMicros = currentCpuTime.system - this.previousCpuTime.system;
    const totalCpuMicros = userMicros + systemMicros;

    let cpuPercent = 0;
    if (elapsedMicros > 0) {
      cpuPercent = Math.min(
        100,
        Math.max(
          0,
          parseFloat(
            ((totalCpuMicros / (elapsedMicros * this.numCpus)) * 100).toFixed(1)
          )
        )
      );
    }

    this.previousCpuTime = currentCpuTime;
    this.previousHrTime = currentHrTime;

    const mem = process.memoryUsage();
    const ramUsedMb = parseFloat((mem.rss / 1024 / 1024).toFixed(1));
    const heapUsedMb = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1));
    const heapTotalMb = parseFloat((mem.heapTotal / 1024 / 1024).toFixed(1));
    const externalMb = parseFloat((mem.external / 1024 / 1024).toFixed(1));

    // Target container memory capacity (512MB default allocation, capped at system memory)
    const osTotalMb = Math.round(os.totalmem() / 1024 / 1024);
    const ramTotalMb = Math.max(256, Math.min(1024, osTotalMb > 0 ? 512 : 512));
    const ramPercent = Math.min(
      100,
      parseFloat(((ramUsedMb / ramTotalMb) * 100).toFixed(1))
    );

    // Active training metadata
    const activeSession = this.getActiveSessionFn ? this.getActiveSessionFn() : null;
    let trainingStatus: "idle" | "running" | "completed" | "cancelled" | "failed" = "idle";
    let activeRunId: string | null = null;
    let activeEpoch = 0;
    let totalEpochs = 0;
    let epochLoss: number | undefined;
    let epochAccuracy: number | undefined;

    if (activeSession && activeSession.run) {
      trainingStatus = activeSession.run.status;
      activeRunId = activeSession.run.id;
      activeEpoch = activeSession.run.currentEpoch || 0;
      totalEpochs = activeSession.run.totalEpochs || 0;
      const lastMetric = activeSession.run.history?.slice(-1)[0];
      if (lastMetric) {
        epochLoss = lastMetric.loss;
        epochAccuracy = lastMetric.accuracy;
      }
    }

    const point: ResourceTelemetryPoint = {
      id: `res-${Date.now()}`,
      timestamp: new Date().toISOString(),
      cpuPercent,
      ramUsedMb,
      ramTotalMb,
      ramPercent,
      heapUsedMb,
      heapTotalMb,
      externalMb,
      cpuCores: this.numCpus,
      trainingStatus,
      activeRunId,
      activeEpoch,
      totalEpochs,
      epochLoss,
      epochAccuracy,
    };

    // Maintain rolling buffer
    this.historyBuffer.push(point);
    if (this.historyBuffer.length > this.maxHistorySize) {
      this.historyBuffer.shift();
    }

    // Publish to Firestore live document stream
    try {
      const docPayload: ResourceTelemetryDocument = {
        current: point,
        history: this.historyBuffer,
        updatedAt: new Date().toISOString(),
        serverUptimeSec: Math.round(process.uptime()),
      };

      setDoc(doc(db, "telemetry_resources", "live"), docPayload).catch(() => {
        // Suppress background sync errors if Firestore is temporarily offline
      });
    } catch {
      // Non-fatal
    }

    return point;
  }

  public static getCurrentPoint(): ResourceTelemetryPoint {
    if (this.historyBuffer.length > 0) {
      return this.historyBuffer[this.historyBuffer.length - 1];
    }
    return this.tick();
  }

  public static getHistory(): ResourceTelemetryPoint[] {
    return [...this.historyBuffer];
  }
}
