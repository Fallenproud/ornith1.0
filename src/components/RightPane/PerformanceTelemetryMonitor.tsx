/**
 * ULTIMATE ORNITH 1.0 — Firestore Performance Telemetry Monitor
 * 
 * Displays real-time read latency, throughput metrics, cache hit ratios,
 * and high-concurrency burst indicators derived from `recordSnapshotPerformance`.
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  Clock,
  HardDrive,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  Database,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  subscribeToTelemetry,
  getScalabilityMetrics,
  getTelemetryHistory,
  ScalabilityMetricsSummary,
  SnapshotTelemetryEntry,
} from '../../lib/telemetry';

export const PerformanceTelemetryMonitor: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [metrics, setMetrics] = useState<ScalabilityMetricsSummary>(getScalabilityMetrics());
  const [recentEntries, setRecentEntries] = useState<SnapshotTelemetryEntry[]>(getTelemetryHistory(12));
  const [isExpanded, setIsExpanded] = useState(!compact);

  useEffect(() => {
    const unsubscribe = subscribeToTelemetry((newMetrics, entries) => {
      setMetrics(newMetrics);
      setRecentEntries(entries.slice(-12));
    });
    return unsubscribe;
  }, []);

  const getLatencyColor = (latencyMs: number) => {
    if (latencyMs <= 0) return 'text-[#77F23B]';
    if (latencyMs < 50) return 'text-[#77F23B]'; // Fast (Green)
    if (latencyMs < 150) return 'text-[#FF9F0A]'; // Moderate (Yellow/Amber)
    return 'text-[#FF453A]'; // Slow (Red)
  };

  const getLatencyBg = (latencyMs: number) => {
    if (latencyMs <= 0) return 'bg-[#77F23B]';
    if (latencyMs < 50) return 'bg-[#77F23B]';
    if (latencyMs < 150) return 'bg-[#FF9F0A]';
    return 'bg-[#FF453A]';
  };

  return (
    <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#111110] px-4 py-2 text-xs text-[#F4F4F2] select-none transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left summary pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#A3A3A0]">
            <Activity className="h-3.5 w-3.5 text-[#39D9E6]" />
            <span className="text-white">Firestore Telemetri:</span>
          </div>

          {/* Average Read Latency */}
          <div className="flex items-center gap-1.5 rounded-md bg-[#191918] border border-[rgba(255,255,255,0.06)] px-2.5 py-1">
            <Clock className="h-3 w-3 text-[#A3A3A0]" />
            <span className="text-[11px] text-[#A3A3A0]">Snittlatens:</span>
            <span className={`font-mono text-xs font-bold ${getLatencyColor(metrics.avgDurationMs)}`}>
              {metrics.totalSnapshots > 0 ? `${metrics.avgDurationMs.toFixed(1)} ms` : '< 1 ms'}
            </span>
          </div>

          {/* Read Throughput */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-[#191918] border border-[rgba(255,255,255,0.06)] px-2 py-1 font-mono text-[11px]">
            <Zap className="h-3 w-3 text-[#B25CFF]" />
            <span className="text-[#A3A3A0]">Lesehastighet:</span>
            <span className="font-bold text-white">{metrics.currentReadsPerSec} dok/s</span>
          </div>

          {/* Cache Ratio */}
          <div className="hidden md:flex items-center gap-1.5 rounded-md bg-[#191918] border border-[rgba(255,255,255,0.06)] px-2 py-1 font-mono text-[11px]">
            <HardDrive className="h-3 w-3 text-[#77F23B]" />
            <span className="text-[#A3A3A0]">Cache:</span>
            <span className="font-bold text-[#77F23B]">{metrics.cacheHitRatio}%</span>
          </div>

          {/* High Concurrency Alert Badge */}
          {metrics.highConcurrencyEvents > 0 ? (
            <span className="flex items-center gap-1 rounded-full bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 px-2 py-0.5 text-[10px] font-bold text-[#FF9F0A]">
              <AlertTriangle className="h-3 w-3" />
              <span>{metrics.highConcurrencyEvents} Høykonkurranse-varsler</span>
            </span>
          ) : (
            <span className="hidden lg:flex items-center gap-1 rounded-full bg-[#77F23B]/10 border border-[#77F23B]/20 px-2 py-0.5 text-[10px] text-[#77F23B]">
              <CheckCircle2 className="h-3 w-3" />
              <span>Normal Skalerbarhet</span>
            </span>
          )}
        </div>

        {/* Right side: Mini sparkline of recent latency & expand button */}
        <div className="flex items-center gap-3">
          {/* Real-time snapshot latency bars */}
          <div className="flex items-end gap-1 h-5 px-1 bg-[#161615] rounded border border-[rgba(255,255,255,0.04)]" title="Siste onSnapshot-lesinger (latens i ms)">
            {recentEntries.length > 0 ? (
              recentEntries.slice(-10).map((entry, idx) => {
                const heightPercent = Math.min(100, Math.max(20, (entry.processingDurationMs / 100) * 100));
                return (
                  <div
                    key={entry.id || idx}
                    className={`w-1.5 rounded-t-xs transition-all ${getLatencyBg(entry.processingDurationMs)}`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${entry.collection}: ${entry.processingDurationMs}ms (${entry.docCount} dok, cache: ${entry.fromCache})`}
                  />
                );
              })
            ) : (
              <div className="w-16 text-[9px] font-mono text-[#666] text-center">venter...</div>
            )}
          </div>

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 rounded p-1 text-[#A3A3A0] hover:bg-[#202020] hover:text-white transition-colors"
            title={isExpanded ? 'Skjul detaljert telemetri' : 'Vis detaljert telemetri'}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detailed metrics tray */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-[rgba(255,255,255,0.05)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div className="bg-[#161615] p-2 rounded-lg border border-[rgba(255,255,255,0.04)]">
            <div className="text-[#888]">Totalt antall Snapshots</div>
            <div className="font-mono text-sm font-bold text-white mt-0.5">{metrics.totalSnapshots}</div>
          </div>
          <div className="bg-[#161615] p-2 rounded-lg border border-[rgba(255,255,255,0.04)]">
            <div className="text-[#888]">Total leste dokumenter</div>
            <div className="font-mono text-sm font-bold text-[#39D9E6] mt-0.5">{metrics.totalDocsRead}</div>
          </div>
          <div className="bg-[#161615] p-2 rounded-lg border border-[rgba(255,255,255,0.04)]">
            <div className="text-[#888]">Min / Maks latens</div>
            <div className="font-mono text-sm font-bold text-white mt-0.5">
              {metrics.minDurationMs} ms / {metrics.maxDurationMs} ms
            </div>
          </div>
          <div className="bg-[#161615] p-2 rounded-lg border border-[rgba(255,255,255,0.04)]">
            <div className="text-[#888]">Siste snapshot-tid</div>
            <div className="font-mono text-[11px] text-[#A3A3A0] mt-1 truncate">
              {metrics.lastEventTimestamp ? new Date(metrics.lastEventTimestamp).toLocaleTimeString('nb-NO') : 'Ingen ennå'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
