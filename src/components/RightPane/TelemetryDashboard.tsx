/**
 * ULTIMATE ORNITH 1.0 — Firestore Performance Telemetry Dashboard
 *
 * Dedicated dashboard in RightPane displaying real-time Firestore read latency,
 * throughput, cache efficiency, percentile distributions, and scalability analytics
 * derived from `recordSnapshotPerformance` events in `src/App.tsx`.
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Zap,
  Clock,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Database,
  ArrowUpDown,
  Filter,
  Download,
  Trash2,
  ShieldCheck,
  Cpu,
  Flame,
  BarChart2,
  TrendingUp,
  Info,
  Layers,
  Server,
  Play,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  subscribeToTelemetry,
  getScalabilityMetrics,
  getTelemetryHistory,
  triggerFirestoreLatencyProbe,
  simulateConcurrencyBurst,
  clearTelemetryBuffer,
  exportTelemetryJson,
  exportTelemetryCsv,
  ScalabilityMetricsSummary,
  SnapshotTelemetryEntry,
  CollectionMetricsSummary,
} from "../../lib/telemetry";
import { ResourceUsageView } from "./ResourceUsageView";

interface TelemetryDashboardProps {
  onNavigateToMode?: (mode: any) => void;
}

export const TelemetryDashboard: React.FC<TelemetryDashboardProps> = ({
  onNavigateToMode,
}) => {
  const [activeTelemetryTab, setActiveTelemetryTab] = useState<"resources" | "firestore">("resources");
  const [metrics, setMetrics] = useState<ScalabilityMetricsSummary>(
    getScalabilityMetrics(),
  );
  const [history, setHistory] = useState<SnapshotTelemetryEntry[]>(
    getTelemetryHistory(60),
  );
  const [isProbing, setIsProbing] = useState(false);
  const [isSimulatingBurst, setIsSimulatingBurst] = useState(false);
  const [probeResult, setProbeResult] = useState<SnapshotTelemetryEntry | null>(null);

  // Filter states
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "cache" | "network">("all");
  const [onlyBursts, setOnlyBursts] = useState(false);
  const [chartRange, setChartRange] = useState<15 | 30 | 60>(30);
  const [hoveredEntry, setHoveredEntry] = useState<SnapshotTelemetryEntry | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Subscribe to live telemetry updates emitted by recordSnapshotPerformance
  useEffect(() => {
    const unsubscribe = subscribeToTelemetry((newMetrics, recent) => {
      setMetrics(newMetrics);
      setHistory(recent);
    });
    return unsubscribe;
  }, []);

  // Filtered log entries for table
  const filteredHistory = useMemo(() => {
    return history
      .filter((entry) => {
        if (collectionFilter !== "all" && entry.collection !== collectionFilter) {
          return false;
        }
        if (sourceFilter === "cache" && !entry.fromCache) return false;
        if (sourceFilter === "network" && entry.fromCache) return false;
        if (onlyBursts && !entry.isHighConcurrencyBurst) return false;
        return true;
      })
      .slice(-50)
      .reverse();
  }, [history, collectionFilter, sourceFilter, onlyBursts]);

  // SLA Color Helpers
  const getLatencyColor = (latencyMs: number) => {
    if (latencyMs <= 0) return "text-[#77F23B]";
    if (latencyMs < 50) return "text-[#77F23B]"; // Fast / Optimal
    if (latencyMs < 150) return "text-[#FF9F0A]"; // Acceptable / Moderate
    return "text-[#FF453A]"; // Slow / High Latency
  };

  const getLatencyBg = (latencyMs: number) => {
    if (latencyMs <= 0) return "bg-[#77F23B]";
    if (latencyMs < 50) return "bg-[#77F23B]";
    if (latencyMs < 150) return "bg-[#FF9F0A]";
    return "bg-[#FF453A]";
  };

  // Run live Firestore latency probe
  const handleRunLatencyProbe = async (targetCollection: string = "projects") => {
    setIsProbing(true);
    try {
      const entry = await triggerFirestoreLatencyProbe(targetCollection);
      setProbeResult(entry);
    } catch (err) {
      console.error("Feil ved latensmåling:", err);
    } finally {
      setIsProbing(false);
    }
  };

  // Simulate concurrency burst
  const handleSimulateBurst = async () => {
    setIsSimulatingBurst(true);
    try {
      await simulateConcurrencyBurst(5);
    } catch (err) {
      console.error("Feil ved burst-simulering:", err);
    } finally {
      setTimeout(() => setIsSimulatingBurst(false), 600);
    }
  };

  // Download export files
  const handleExportJson = () => {
    const jsonStr = exportTelemetryJson();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firestore_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const csvStr = exportTelemetryCsv();
    const blob = new Blob([csvStr], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `firestore_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearBuffer = () => {
    if (confirm("Vil du nullstille den lokale telemetriloggen?")) {
      clearTelemetryBuffer();
      setProbeResult(null);
    }
  };

  // Compute Scalability Health Score (0 - 100%)
  const healthScore = useMemo(() => {
    if (metrics.totalSnapshots === 0) return 100;
    let score = 100;
    // Latency penalty
    if (metrics.avgDurationMs > 50) score -= Math.min(30, (metrics.avgDurationMs - 50) * 0.4);
    // Burst penalty
    if (metrics.highConcurrencyEvents > 0) {
      score -= Math.min(25, metrics.highConcurrencyEvents * 5);
    }
    // Cache bonus / penalty
    if (metrics.cacheHitRatio < 20 && metrics.totalSnapshots > 5) score -= 10;
    return Math.max(20, Math.round(score));
  }, [metrics]);

  // SVG Chart Data calculations
  const chartData = useMemo(() => {
    const subset = history.slice(-chartRange);
    if (subset.length === 0) return null;

    const width = 680;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 25, left: 45 };

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const latencies = subset.map((s) => s.processingDurationMs);
    const maxLat = Math.max(...latencies, 60, metrics.avgDurationMs * 1.3);
    const minLat = 0;

    const getX = (idx: number) => {
      if (subset.length <= 1) return padding.left + chartWidth / 2;
      return padding.left + (idx / (subset.length - 1)) * chartWidth;
    };

    const getY = (val: number) => {
      const clamped = Math.max(minLat, Math.min(maxLat, val));
      return padding.top + chartHeight - ((clamped - minLat) / (maxLat - minLat || 1)) * chartHeight;
    };

    const points = subset.map((item, i) => ({
      x: getX(i),
      y: getY(item.processingDurationMs),
      item,
      i,
    }));

    const pathData = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const avgY = getY(metrics.avgDurationMs);
    const slaY = getY(50); // 50ms SLA line

    return {
      width,
      height,
      padding,
      points,
      pathData,
      maxLat,
      avgY,
      slaY,
      subset,
    };
  }, [history, chartRange, metrics.avgDurationMs]);

  // Unique collections observed
  const availableCollections = useMemo(() => {
    const cols = new Set<string>();
    history.forEach((h) => cols.add(h.collection));
    return Array.from(cols);
  }, [history]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0D0D0C] text-[#F4F4F2] custom-scrollbar">
      {/* Top Header Banner */}
      <div className="shrink-0 border-b border-[rgba(255,255,255,0.08)] bg-[#121212] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#39D9E6]/15 text-[#39D9E6] border border-[#39D9E6]/25">
                <Activity className="h-4 w-4" />
              </div>
              <h1 className="text-base font-bold text-white tracking-tight">
                Firestore Ytelse & Skalerbarhetstelemetri
              </h1>
              <span className="flex items-center gap-1 rounded-full bg-[#77F23B]/10 border border-[#77F23B]/20 px-2 py-0.5 font-mono text-[10px] font-medium text-[#77F23B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#77F23B] animate-pulse" />
                Sanntids onSnapshot
              </span>
            </div>
            <p className="text-xs text-[#A3A3A0] max-w-3xl">
              Sanntidsovervåking av leselatens, cache-treff, gjennomstrømming og høykonkurranse-hendelser
              innhentet kontinuerlig fra <code className="text-[#39D9E6] font-mono text-[11px]">recordSnapshotPerformance</code> i <code className="text-[#8F2BFF] font-mono text-[11px]">src/App.tsx</code>.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleRunLatencyProbe("projects")}
              disabled={isProbing}
              className="flex items-center gap-1.5 rounded-lg border border-[#39D9E6]/30 bg-[#39D9E6]/10 px-3 py-1.5 text-xs font-semibold text-[#39D9E6] transition-all hover:bg-[#39D9E6]/20 disabled:opacity-50"
              title="Kjør en live Firestore-lesespørring for å måle reell latens umiddelbart"
            >
              {isProbing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              <span>Kjør Latensmåling</span>
            </button>

            <button
              onClick={handleSimulateBurst}
              disabled={isSimulatingBurst}
              className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1C1C1A] px-3 py-1.5 text-xs font-medium text-[#E0E0DC] transition-all hover:bg-[#252523] disabled:opacity-50"
              title="Genererer en burst med snapshot-hendelser for å teste alarmgrenser og terskler"
            >
              <Flame className="h-3.5 w-3.5 text-[#FF9F0A]" />
              <span>Test Burst-Deteksjon</span>
            </button>

            <div className="h-4 w-px bg-[rgba(255,255,255,0.1)] mx-1" />

            <button
              onClick={handleExportJson}
              className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191918] px-2.5 py-1.5 text-xs text-[#A3A3A0] hover:text-white hover:bg-[#222]"
              title="Eksporter telemetridata som JSON"
            >
              <Download className="h-3.5 w-3.5" />
              <span>JSON</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191918] px-2.5 py-1.5 text-xs text-[#A3A3A0] hover:text-white hover:bg-[#222]"
              title="Eksporter telemetridata som CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleClearBuffer}
              className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#191918] p-1.5 text-[#888] hover:text-[#FF453A] hover:bg-[#222]"
              title="Nullstill historikk og metrikker"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Probe Feedback Notification */}
        {probeResult && (
          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#39D9E6]/25 bg-[#39D9E6]/10 px-3 py-2 text-xs text-white">
            <div className="flex items-center gap-2 font-mono">
              <CheckCircle2 className="h-4 w-4 text-[#39D9E6]" />
              <span>
                Latensprobe fullført på <strong>'{probeResult.collection}'</strong>:{" "}
                <span className="text-[#77F23B] font-bold">{probeResult.processingDurationMs} ms</span>{" "}
                ({probeResult.docCount} dok, {probeResult.fromCache ? "Cache" : "Nettverk"}).
              </span>
            </div>
            <button
              onClick={() => setProbeResult(null)}
              className="text-[#A3A3A0] hover:text-white text-[11px]"
            >
              Lukk
            </button>
          </div>
        )}
      </div>

      {/* Sub-tab Navigation Bar: Ressursbruk vs Firestore Ytelse */}
      <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#101010] px-6 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTelemetryTab("resources")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTelemetryTab === "resources"
                ? "border border-[#8F2BFF]/40 bg-[#8F2BFF]/20 text-[#B25CFF] shadow-sm"
                : "text-[#888] hover:bg-[#1A1A19] hover:text-white"
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Ressursbruk (RAM & CPU)</span>
            <span className="flex h-2 w-2 rounded-full bg-[#77F23B] animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTelemetryTab("firestore")}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTelemetryTab === "firestore"
                ? "border border-[#39D9E6]/40 bg-[#39D9E6]/20 text-[#39D9E6] shadow-sm"
                : "text-[#888] hover:bg-[#1A1A19] hover:text-white"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Firestore Ytelse & Latens</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-[#888]">
          <HardDrive className="h-3.5 w-3.5 text-[#A3A3A0]" />
          <span>Sanntids Telemetrimiljø</span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 space-y-6 p-6">
        {activeTelemetryTab === "resources" ? (
          <ResourceUsageView
            onNavigateToTraining={() => onNavigateToMode && onNavigateToMode("training")}
          />
        ) : (
          <>
        {/* Metric Cards Grid (Anti-Slop: High Contrast, Mathematical Spacing, <7% delta) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Average Firestore Latency */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4 transition-all">
            <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
              <span className="font-medium">Gjennomsnittlig Latens</span>
              <Clock className="h-4 w-4 text-[#39D9E6]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`font-mono text-3xl font-extrabold tracking-tight ${getLatencyColor(metrics.avgDurationMs)}`}
              >
                {metrics.totalSnapshots > 0 ? `${metrics.avgDurationMs.toFixed(1)}` : "< 1.0"}
              </span>
              <span className="font-mono text-sm text-[#A3A3A0]">ms</span>
            </div>

            {/* SLA Status Pill */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px]">
              <span className="text-[#888]">SLA-status:</span>
              <span
                className={`font-medium ${
                  metrics.avgDurationMs < 50
                    ? "text-[#77F23B]"
                    : metrics.avgDurationMs < 150
                      ? "text-[#FF9F0A]"
                      : "text-[#FF453A]"
                }`}
              >
                {metrics.avgDurationMs < 50
                  ? "Optimal (< 50ms)"
                  : metrics.avgDurationMs < 150
                    ? "Godkjent (< 150ms)"
                    : "Høy latens (> 150ms)"}
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#888]">
              <span>p50: {metrics.p50DurationMs} ms</span>
              <span>p90: {metrics.p90DurationMs} ms</span>
              <span>Min: {metrics.minDurationMs} ms</span>
            </div>
          </div>

          {/* Card 2: Read Throughput */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4 transition-all">
            <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
              <span className="font-medium">Lesehastighet</span>
              <Zap className="h-4 w-4 text-[#8F2BFF]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-white tracking-tight">
                {metrics.currentReadsPerSec}
              </span>
              <span className="font-mono text-sm text-[#A3A3A0]">dok / sek</span>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px]">
              <span className="text-[#888]">Totalt leste dokumenter:</span>
              <span className="font-mono font-semibold text-white">
                {metrics.totalDocsRead} dok
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#888]">
              <span>Snapshots: {metrics.totalSnapshots}</span>
              <span>Vindu: 5s glidende</span>
            </div>
          </div>

          {/* Card 3: Cache Hit Ratio */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4 transition-all">
            <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
              <span className="font-medium">Cache-Effektivitet</span>
              <HardDrive className="h-4 w-4 text-[#77F23B]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-[#77F23B] tracking-tight">
                {metrics.cacheHitRatio}
              </span>
              <span className="font-mono text-sm text-[#77F23B]">%</span>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px]">
              <span className="text-[#888]">Kilde:</span>
              <span className="font-medium text-[#77F23B]">
                IndexedDB / Memory Cache
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#888]">
              <span>Sparer nettverk & kvoter</span>
              <span>Null forsinkelse</span>
            </div>
          </div>

          {/* Card 4: Concurrency & Scalability Score */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4 transition-all">
            <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
              <span className="font-medium">Skalerbarhets-Score</span>
              <ShieldCheck className="h-4 w-4 text-[#39D9E6]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-white tracking-tight">
                {healthScore}
              </span>
              <span className="font-mono text-sm text-[#A3A3A0]">/ 100</span>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px]">
              <span className="text-[#888]">Høykonkurranse-varsler:</span>
              <span
                className={`font-mono font-bold ${
                  metrics.highConcurrencyEvents > 0 ? "text-[#FF9F0A]" : "text-[#77F23B]"
                }`}
              >
                {metrics.highConcurrencyEvents} bursts
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-[#888]">
              <span>Terskel: ≥3 hendelser / 5s</span>
              <span>{metrics.highConcurrencyEvents === 0 ? "Optimal" : "Overvåkes"}</span>
            </div>
          </div>
        </div>

        {/* Real-time Time-Series Latency SVG Chart */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141413] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#39D9E6]" />
              <h2 className="text-sm font-bold text-white">
                Sanntids Latenskurve for onSnapshot-Lyttere
              </h2>
              <span className="text-xs text-[#888]">
                (Målt i millisekunder per snapshot-kall)
              </span>
            </div>

            {/* Range & Legend */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-[#A3A3A0]">
                  <span className="h-2 w-2 rounded-full bg-[#39D9E6]" />
                  Snapshot-latens
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#FF9F0A]">
                  <span className="h-0.5 w-3 border-b-2 border-dashed border-[#FF9F0A]" />
                  Snitt ({metrics.avgDurationMs.toFixed(1)} ms)
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-[#77F23B]">
                  <span className="h-0.5 w-3 border-b border-[#77F23B]" />
                  SLA (50 ms)
                </span>
              </div>

              {/* Sample count selector */}
              <div className="flex items-center rounded-lg bg-[#1D1D1C] p-0.5 border border-[rgba(255,255,255,0.06)]">
                {[15, 30, 60].map((num) => (
                  <button
                    key={num}
                    onClick={() => setChartRange(num as any)}
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${
                      chartRange === num
                        ? "bg-[#39D9E6] text-black font-bold"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    {num} pkt
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Canvas */}
          {chartData ? (
            <div className="relative w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="w-full overflow-visible"
              >
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                  const yVal = chartData.padding.top + (1 - pct) * (chartData.height - chartData.padding.top - chartData.padding.bottom);
                  const latLabel = Math.round(pct * chartData.maxLat);
                  return (
                    <g key={pct}>
                      <line
                        x1={chartData.padding.left}
                        y1={yVal}
                        x2={chartData.width - chartData.padding.right}
                        y2={yVal}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                      />
                      <text
                        x={chartData.padding.left - 8}
                        y={yVal + 3}
                        fill="#666"
                        fontSize="9"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {latLabel}ms
                      </text>
                    </g>
                  );
                })}

                {/* 50ms SLA Target Line */}
                <line
                  x1={chartData.padding.left}
                  y1={chartData.slaY}
                  x2={chartData.width - chartData.padding.right}
                  y2={chartData.slaY}
                  stroke="#77F23B"
                  strokeWidth="1"
                  strokeOpacity="0.6"
                />

                {/* Average Duration Line */}
                <line
                  x1={chartData.padding.left}
                  y1={chartData.avgY}
                  x2={chartData.width - chartData.padding.right}
                  y2={chartData.avgY}
                  stroke="#FF9F0A"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />

                {/* Main Latency Line */}
                <path
                  d={chartData.pathData}
                  fill="none"
                  stroke="#39D9E6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Interactive Points */}
                {chartData.points.map((p) => {
                  const isHovered = hoveredEntry?.id === p.item.id;
                  const isBurst = p.item.isHighConcurrencyBurst;
                  return (
                    <circle
                      key={p.item.id}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : isBurst ? 4.5 : 3.5}
                      fill={isBurst ? "#FF9F0A" : p.item.fromCache ? "#77F23B" : "#39D9E6"}
                      stroke="#0D0D0C"
                      strokeWidth={1.5}
                      className="cursor-pointer transition-all hover:scale-125"
                      onMouseEnter={() => setHoveredEntry(p.item)}
                      onMouseLeave={() => setHoveredEntry(null)}
                      onClick={() => setExpandedEntryId(p.item.id)}
                    />
                  );
                })}
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredEntry && (
                <div className="absolute top-2 right-4 rounded-lg border border-[rgba(255,255,255,0.15)] bg-[#191918]/95 px-3 py-2 text-xs backdrop-blur-md shadow-xl font-mono pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">'{hoveredEntry.collection}'</span>
                    <span className={`font-bold ${getLatencyColor(hoveredEntry.processingDurationMs)}`}>
                      {hoveredEntry.processingDurationMs} ms
                    </span>
                    {hoveredEntry.isHighConcurrencyBurst && (
                      <span className="rounded bg-[#FF9F0A]/20 px-1 text-[10px] text-[#FF9F0A]">
                        BURST
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[#A3A3A0]">
                    <span>Dok: {hoveredEntry.docCount} ({hoveredEntry.changeCount} endret)</span>
                    <span>Kilde: {hoveredEntry.fromCache ? "Cache" : "Nettverk"}</span>
                    <span>Str: {hoveredEntry.estimatedPayloadKb} KB</span>
                  </div>
                  <div className="text-[10px] text-[#666] mt-0.5">
                    {new Date(hoveredEntry.timestamp).toLocaleTimeString("nb-NO")}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-36 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111] text-xs text-[#888]">
              Venter på første onSnapshot-hendelse for å tegne latensgraf...
            </div>
          )}
        </div>

        {/* Collection-Level Breakdown Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#8F2BFF]" />
              Ytelsesfordeling per Samling (Collection Breakdown)
            </h2>
            <span className="text-xs text-[#888]">
              Sammenligning av latens og dokumentvolum per Firestore-lytter
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(metrics.collectionBreakdown).length > 0 ? (
              (Object.values(metrics.collectionBreakdown) as CollectionMetricsSummary[]).map((cMeta) => (
                <div
                  key={cMeta.collection}
                  className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-[#39D9E6]" />
                      <span className="font-mono text-xs font-bold text-white">
                        {cMeta.collection}
                      </span>
                    </div>
                    <span className="rounded bg-[#1F1F1E] px-2 py-0.5 font-mono text-[10px] text-[#A3A3A0]">
                      {cMeta.snapshotsCount} snapshots
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-[#111110] p-2 border border-[rgba(255,255,255,0.04)]">
                      <div className="text-[#888]">Snittlatens</div>
                      <div
                        className={`font-mono text-sm font-bold mt-0.5 ${getLatencyColor(
                          cMeta.avgDurationMs,
                        )}`}
                      >
                        {cMeta.avgDurationMs} ms
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#111110] p-2 border border-[rgba(255,255,255,0.04)]">
                      <div className="text-[#888]">Leste dokumenter</div>
                      <div className="font-mono text-sm font-bold text-white mt-0.5">
                        {cMeta.totalDocs} dok
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#111110] p-2 border border-[rgba(255,255,255,0.04)]">
                      <div className="text-[#888]">Cache-ratio</div>
                      <div className="font-mono text-xs font-bold text-[#77F23B] mt-0.5">
                        {cMeta.cacheHitRatio}%
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#111110] p-2 border border-[rgba(255,255,255,0.04)]">
                      <div className="text-[#888]">Bursts registrert</div>
                      <div className="font-mono text-xs font-bold text-[#FF9F0A] mt-0.5">
                        {cMeta.burstCount}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-[#777]">
                    <span>Min: {cMeta.minDurationMs} ms</span>
                    <span>Maks: {cMeta.maxDurationMs} ms</span>
                    <span>Snitt str: {cMeta.avgPayloadKb} KB</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141413] p-6 text-center text-xs text-[#888]">
                Ingen samlingsspesifikk telemetri registrert ennå. Klikk "Kjør Latensmåling" for å teste lytterne.
              </div>
            )}
          </div>
        </div>

        {/* Real-time Event Stream Table / Inspector */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141413] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#39D9E6]" />
              <h2 className="text-sm font-bold text-white">
                Detaljert Snapshot-Hendelseslogg
              </h2>
              <span className="font-mono text-xs text-[#888]">
                ({filteredHistory.length} hendelser)
              </span>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Collection filter */}
              <select
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1A1A19] px-2.5 py-1 text-xs text-[#F4F4F2] focus:outline-none"
              >
                <option value="all">Alle samlinger</option>
                {availableCollections.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>

              {/* Source filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1A1A19] px-2.5 py-1 text-xs text-[#F4F4F2] focus:outline-none"
              >
                <option value="all">Alle kilder</option>
                <option value="cache">Kun Cache</option>
                <option value="network">Kun Nettverk</option>
              </select>

              {/* Only Bursts toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer rounded-lg bg-[#1A1A19] border border-[rgba(255,255,255,0.1)] px-2.5 py-1 text-[11px] text-[#A3A3A0] hover:text-white">
                <input
                  type="checkbox"
                  checked={onlyBursts}
                  onChange={(e) => setOnlyBursts(e.target.checked)}
                  className="rounded accent-[#FF9F0A]"
                />
                <span>Kun Bursts</span>
              </label>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111110]">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[rgba(255,255,255,0.06)] bg-[#161615] font-mono text-[11px] text-[#888]">
                <tr>
                  <th className="px-3 py-2.5">Tidspunkt</th>
                  <th className="px-3 py-2.5">Samling</th>
                  <th className="px-3 py-2.5">Behandlingstid</th>
                  <th className="px-3 py-2.5">Dokumenter</th>
                  <th className="px-3 py-2.5">Datamengde</th>
                  <th className="px-3 py-2.5">Kilde</th>
                  <th className="px-3 py-2.5">Konkurransegrad</th>
                  <th className="px-3 py-2.5 text-right">Detaljer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.04)] font-mono text-[11px]">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((entry) => {
                    const isExpanded = expandedEntryId === entry.id;
                    return (
                      <React.Fragment key={entry.id}>
                        <tr className="hover:bg-[#181817] transition-colors">
                          <td className="px-3 py-2 text-[#A3A3A0]">
                            {new Date(entry.timestamp).toLocaleTimeString("nb-NO", {
                              hour12: false,
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              fractionalSecondDigits: 3,
                            })}
                          </td>
                          <td className="px-3 py-2 font-bold text-white">
                            <span className="rounded bg-[#1F1F1E] px-1.5 py-0.5 text-xs text-[#39D9E6]">
                              {entry.collection}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`font-bold ${getLatencyColor(
                                entry.processingDurationMs,
                              )}`}
                            >
                              {entry.processingDurationMs} ms
                            </span>
                          </td>
                          <td className="px-3 py-2 text-[#CCC]">
                            {entry.docCount} dok{" "}
                            {entry.changeCount > 0 && (
                              <span className="text-[#888]">
                                ({entry.changeCount} endret)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-[#A3A3A0]">
                            {entry.estimatedPayloadKb} KB
                          </td>
                          <td className="px-3 py-2">
                            {entry.fromCache ? (
                              <span className="rounded bg-[#77F23B]/10 px-1.5 py-0.5 text-[10px] text-[#77F23B]">
                                Cache
                              </span>
                            ) : (
                              <span className="rounded bg-[#39D9E6]/10 px-1.5 py-0.5 text-[10px] text-[#39D9E6]">
                                Nettverk
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {entry.isHighConcurrencyBurst ? (
                              <span className="flex items-center gap-1 text-[#FF9F0A] font-semibold">
                                <AlertTriangle className="h-3 w-3" />
                                Burst ({entry.concurrencyWindowCount}/5s)
                              </span>
                            ) : (
                              <span className="text-[#666]">
                                {entry.concurrencyWindowCount} i vindu
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() =>
                                setExpandedEntryId(isExpanded ? null : entry.id)
                              }
                              className="text-[#888] hover:text-white transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Payload & Recommendation Row */}
                        {isExpanded && (
                          <tr className="bg-[#141413]">
                            <td colSpan={8} className="p-3 border-t border-[rgba(255,255,255,0.06)]">
                              <div className="rounded-lg bg-[#0C0C0B] p-3 text-[11px] font-mono space-y-1.5">
                                <div className="text-[#39D9E6] font-bold">
                                  Telemetri-objekt ({entry.id}):
                                </div>
                                <pre className="text-[#A3A3A0] overflow-x-auto text-[10px]">
                                  {JSON.stringify(entry, null, 2)}
                                </pre>
                                <div className="text-[11px] text-[#FF9F0A] pt-1">
                                  {entry.isHighConcurrencyBurst
                                    ? "Varsel: Høykonkurranse detektert. Anbefaling: Benytt batching eller debounce på oppdateringer."
                                    : "Normal skalerbarhet og responsivitet overvåket."}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-xs text-[#777]"
                    >
                      Ingen hendelser samsvarer med det aktive filteret.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Scalability Insights & Architecture Recommendations */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141413] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-[#8F2BFF]" />
            <h2 className="text-sm font-bold text-white">
              Skalerbarhetsanbefalinger & Arkitektur-innsikt
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="rounded-lg bg-[#191918] p-3 border border-[rgba(255,255,255,0.05)]">
              <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#77F23B]" />
                onSnapshot Streaming
              </div>
              <p className="text-[#A3A3A0] leading-relaxed">
                Lytterne lytter selektivt på <code>projects</code> og <code>runs</code>.
                Sanntids-strømming reduserer overflødige polling-kall og opprettholder oppdatert tilstand automatisk.
              </p>
            </div>

            <div className="rounded-lg bg-[#191918] p-3 border border-[rgba(255,255,255,0.05)]">
              <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-[#39D9E6]" />
                Klient-side Dokumentcaching
              </div>
              <p className="text-[#A3A3A0] leading-relaxed">
                <code>cachedGetDoc</code> i <code>firebase.ts</code> avlaster databasen for statiske regler og
                prosjektmetadata, slik at leselatensen forblir under 50 ms.
              </p>
            </div>

            <div className="rounded-lg bg-[#191918] p-3 border border-[rgba(255,255,255,0.05)]">
              <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-[#FF9F0A]" />
                Burst-grenser & Debouncing
              </div>
              <p className="text-[#A3A3A0] leading-relaxed">
                Dersom snapshot-frekvensen overstiger 3 hendelser på 5 sekunder, logges det en advarsel
                med forslag om samling eller debouncing av klientskrivinger.
              </p>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
