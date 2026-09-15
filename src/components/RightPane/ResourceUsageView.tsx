/**
 * ULTIMATE ORNITH 1.0 — Real-Time Resource Usage View (RAM & CPU)
 *
 * Visualizes live hardware resource utilization from the TinyML training environment
 * powered by a real-time Firebase onSnapshot stream (`telemetry_resources/live`).
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Cpu,
  HardDrive,
  Activity,
  Zap,
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Layers,
  Download,
  Info,
  Radio,
} from "lucide-react";
import { ResourceTelemetryPoint } from "../../types";
import { subscribeToResourceStream } from "../../lib/resourceTelemetry";

interface ResourceUsageViewProps {
  onNavigateToTraining?: () => void;
}

export const ResourceUsageView: React.FC<ResourceUsageViewProps> = ({
  onNavigateToTraining,
}) => {
  const [currentMetrics, setCurrentMetrics] = useState<ResourceTelemetryPoint | null>(null);
  const [history, setHistory] = useState<ResourceTelemetryPoint[]>([]);
  const [streamSource, setStreamSource] = useState<"firestore" | "rest">("firestore");
  const [lastStreamTime, setLastStreamTime] = useState<string>("");
  const [chartPointsCount, setChartPointsCount] = useState<15 | 30 | 50>(30);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Subscribe to live Firebase stream
  useEffect(() => {
    const unsubscribe = subscribeToResourceStream((data) => {
      setCurrentMetrics(data.current);
      setHistory(data.history);
      setStreamSource(data.source);
      setLastStreamTime(new Date().toLocaleTimeString("nb-NO"));
    });

    return unsubscribe;
  }, []);

  // Filtered subset for charts
  const chartData = useMemo(() => {
    return history.slice(-chartPointsCount);
  }, [history, chartPointsCount]);

  // Peak metrics calculation
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        peakCpu: 0,
        avgCpu: 0,
        peakRam: 0,
        avgRam: 0,
        minRam: 0,
      };
    }
    const cpuVals = chartData.map((d) => d.cpuPercent);
    const ramVals = chartData.map((d) => d.ramUsedMb);

    const peakCpu = Math.max(...cpuVals);
    const avgCpu = cpuVals.reduce((a, b) => a + b, 0) / cpuVals.length;

    const peakRam = Math.max(...ramVals);
    const minRam = Math.min(...ramVals);
    const avgRam = ramVals.reduce((a, b) => a + b, 0) / ramVals.length;

    return {
      peakCpu,
      avgCpu,
      peakRam,
      avgRam,
      minRam,
    };
  }, [chartData]);

  // Color helpers
  const getCpuColor = (percent: number) => {
    if (percent < 30) return "text-[#77F23B]";
    if (percent < 70) return "text-[#FF9F0A]";
    return "text-[#FF453A]";
  };

  const getCpuBg = (percent: number) => {
    if (percent < 30) return "bg-[#77F23B]";
    if (percent < 70) return "bg-[#FF9F0A]";
    return "bg-[#FF453A]";
  };

  const getRamColor = (percent: number) => {
    if (percent < 50) return "text-[#39D9E6]";
    if (percent < 80) return "text-[#FF9F0A]";
    return "text-[#FF453A]";
  };

  const getRamBg = (percent: number) => {
    if (percent < 50) return "bg-[#39D9E6]";
    if (percent < 80) return "bg-[#FF9F0A]";
    return "bg-[#FF453A]";
  };

  // Export resource log
  const handleExportCsv = () => {
    if (history.length === 0) return;
    const headers = [
      "Tidsstempel",
      "CPU_Prosent",
      "RAM_MB",
      "RAM_Prosent",
      "Heap_Brukt_MB",
      "Heap_Total_MB",
      "Treningsstatus",
      "Epoke",
    ];
    const rows = history.map((p) => [
      p.timestamp,
      p.cpuPercent,
      p.ramUsedMb,
      p.ramPercent,
      p.heapUsedMb,
      p.heapTotalMb,
      p.trainingStatus,
      p.activeEpoch || 0,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ressursbruk_telemetri_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // SVG Chart Geometry Helpers
  const renderCpuChart = () => {
    if (chartData.length < 2) {
      return (
        <div className="flex h-44 items-center justify-center text-xs text-[#888]">
          Samler inn sanntidsdata fra Firebase...
        </div>
      );
    }

    const width = 600;
    const height = 160;
    const padding = { top: 20, right: 20, bottom: 25, left: 35 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(100, Math.ceil(stats.peakCpu / 10) * 10);
    const minVal = 0;

    const getX = (index: number) => padding.left + (index / (chartData.length - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - (val / maxVal) * chartH;

    const points = chartData.map((d, i) => ({
      x: getX(i),
      y: getY(d.cpuPercent),
      val: d.cpuPercent,
      data: d,
    }));

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${getY(0)} L ${points[0].x.toFixed(1)} ${getY(0)} Z`;

    return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#39D9E6" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#39D9E6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#666"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          <path d={areaD} fill="url(#cpuGradient)" />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke="#39D9E6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === idx ? 4.5 : 2}
              fill={hoveredIndex === idx ? "#FFF" : "#39D9E6"}
              stroke="#0D0D0C"
              strokeWidth="1.5"
              className="transition-all cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredIndex !== null && chartData[hoveredIndex] && (
          <div
            className="pointer-events-none absolute -top-8 rounded-md border border-[#39D9E6]/40 bg-[#161615] px-2.5 py-1 text-[11px] font-mono text-white shadow-lg"
            style={{
              left: `${(hoveredIndex / (chartData.length - 1)) * 90 + 5}%`,
              transform: "translateX(-50%)",
            }}
          >
            <span className="text-[#39D9E6] font-bold">
              {chartData[hoveredIndex].cpuPercent.toFixed(1)}% CPU
            </span>{" "}
            <span className="text-[#888]">
              ({new Date(chartData[hoveredIndex].timestamp).toLocaleTimeString("nb-NO")})
            </span>
          </div>
        )}
      </div>
    );
  };

  // RAM Dual-Line Chart (RSS vs Heap)
  const renderRamChart = () => {
    if (chartData.length < 2) {
      return (
        <div className="flex h-44 items-center justify-center text-xs text-[#888]">
          Samler inn sanntidsdata fra Firebase...
        </div>
      );
    }

    const width = 600;
    const height = 160;
    const padding = { top: 20, right: 20, bottom: 25, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(256, Math.ceil((stats.peakRam * 1.25) / 50) * 50);

    const getX = (index: number) => padding.left + (index / (chartData.length - 1)) * chartW;
    const getY = (val: number) => padding.top + chartH - (val / maxVal) * chartH;

    const rssPoints = chartData.map((d, i) => ({
      x: getX(i),
      y: getY(d.ramUsedMb),
      val: d.ramUsedMb,
    }));

    const heapPoints = chartData.map((d, i) => ({
      x: getX(i),
      y: getY(d.heapUsedMb),
      val: d.heapUsedMb,
    }));

    const rssPath = rssPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const heapPath = heapPoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const rssArea = `${rssPath} L ${rssPoints[rssPoints.length - 1].x.toFixed(1)} ${getY(0)} L ${rssPoints[0].x.toFixed(1)} ${getY(0)} Z`;

    return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8F2BFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#8F2BFF" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, Math.round(maxVal / 4), Math.round(maxVal / 2), Math.round((maxVal * 3) / 4), maxVal].map(
            (tick) => {
              const y = getY(tick);
              return (
                <g key={tick}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={padding.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="#666"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {tick} MB
                  </text>
                </g>
              );
            }
          )}

          {/* Area fill */}
          <path d={rssArea} fill="url(#ramGradient)" />

          {/* RSS Line (Purple) */}
          <path
            d={rssPath}
            fill="none"
            stroke="#8F2BFF"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Heap Line (Green) */}
          <path
            d={heapPath}
            fill="none"
            stroke="#77F23B"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points for RSS */}
          {rssPoints.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={2}
              fill="#8F2BFF"
              stroke="#0D0D0C"
              strokeWidth="1"
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-end gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#8F2BFF]" />
            <span className="text-[#CCC]">Fysisk RAM (RSS)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#77F23B]" />
            <span className="text-[#CCC]">V8 Heap Brukt</span>
          </div>
        </div>
      </div>
    );
  };

  const current = currentMetrics || {
    timestamp: new Date().toISOString(),
    cpuPercent: 0,
    ramUsedMb: 0,
    ramTotalMb: 512,
    ramPercent: 0,
    heapUsedMb: 0,
    heapTotalMb: 0,
    trainingStatus: "idle",
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Stream Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#8F2BFF]/20 text-[#B25CFF] border border-[#8F2BFF]/30">
            <Radio className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                Sanntids Ressurs-Stream
              </span>
              <span className="flex items-center gap-1 rounded-full border border-[#77F23B]/30 bg-[#77F23B]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#77F23B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#77F23B] animate-ping" />
                Firebase onSnapshot
              </span>
            </div>
            <p className="text-xs text-[#888]">
              Direktestrømming fra <code className="font-mono text-[#39D9E6]">telemetry_resources/live</code>
              {lastStreamTime && ` • Siste puls: ${lastStreamTime}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Range Toggle */}
          <div className="flex rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-1 text-[11px]">
            {([15, 30, 50] as const).map((count) => (
              <button
                key={count}
                onClick={() => setChartPointsCount(count)}
                className={`rounded px-2.5 py-0.5 font-mono transition-all ${
                  chartPointsCount === count
                    ? "bg-[#8F2BFF] text-white"
                    : "text-[#888] hover:text-white"
                }`}
              >
                {count}p
              </button>
            ))}
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1F1F1E] px-3 py-1.5 text-xs text-[#CCC] transition-colors hover:bg-[#2A2A28] hover:text-white"
            title="Eksporter ressurslogger som CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Eksporter CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Resource Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: CPU Load */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4">
          <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
            <span className="font-medium">CPU-belastning</span>
            <Cpu className="h-4 w-4 text-[#39D9E6]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-3xl font-extrabold tracking-tight ${getCpuColor(
                current.cpuPercent
              )}`}
            >
              {current.cpuPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-[#888]">
              {current.cpuCores ? `${current.cpuCores} vCPUs` : "prosessor"}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#242422]">
            <div
              className={`h-full transition-all duration-300 ${getCpuBg(current.cpuPercent)}`}
              style={{ width: `${Math.min(100, current.cpuPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#888]">
            <span>Topp i vinduet:</span>
            <span className="font-mono text-white">{stats.peakCpu.toFixed(1)}%</span>
          </div>
        </div>

        {/* Card 2: Physical RAM (RSS) */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4">
          <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
            <span className="font-medium">Minnebruk (RAM - RSS)</span>
            <HardDrive className="h-4 w-4 text-[#8F2BFF]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-3xl font-extrabold tracking-tight ${getRamColor(
                current.ramPercent
              )}`}
            >
              {current.ramUsedMb.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-[#888]">
              / {current.ramTotalMb} MB ({current.ramPercent.toFixed(0)}%)
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#242422]">
            <div
              className={`h-full transition-all duration-300 ${getRamBg(current.ramPercent)}`}
              style={{ width: `${Math.min(100, current.ramPercent)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#888]">
            <span>Gjennomsnitt:</span>
            <span className="font-mono text-white">{stats.avgRam.toFixed(1)} MB</span>
          </div>
        </div>

        {/* Card 3: V8 Heap Allocation */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4">
          <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
            <span className="font-medium">JavaScript V8 Heap</span>
            <Layers className="h-4 w-4 text-[#77F23B]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-extrabold tracking-tight text-[#77F23B]">
              {current.heapUsedMb.toFixed(1)}
            </span>
            <span className="font-mono text-xs text-[#888]">
              / {current.heapTotalMb.toFixed(1)} MB
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#242422]">
            <div
              className="h-full bg-[#77F23B] transition-all duration-300"
              style={{
                width: `${
                  current.heapTotalMb > 0
                    ? Math.min(100, (current.heapUsedMb / current.heapTotalMb) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#888]">
            <span>Ekstern buffer:</span>
            <span className="font-mono text-white">
              {current.externalMb ? `${current.externalMb.toFixed(1)} MB` : "0.0 MB"}
            </span>
          </div>
        </div>

        {/* Card 4: Training Environment State */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-4">
          <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
            <span className="font-medium">Treningsprosess</span>
            <Activity className="h-4 w-4 text-[#FF9F0A]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`font-mono text-xl font-bold ${
                current.trainingStatus === "running"
                  ? "text-[#39D9E6]"
                  : current.trainingStatus === "completed"
                  ? "text-[#77F23B]"
                  : "text-[#888]"
              }`}
            >
              {current.trainingStatus === "running"
                ? `Epoke ${current.activeEpoch}/${current.totalEpochs}`
                : current.trainingStatus === "completed"
                ? "Fullført"
                : "Hvilemodus"}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)] text-[11px]">
            <span className="text-[#888]">
              {current.trainingStatus === "running" ? "Aktiv treningsøkt" : "Status:"}
            </span>
            <span className="font-mono text-white">
              {current.activeRunId ? current.activeRunId.slice(0, 12) + "..." : "Ingen aktiv økt"}
            </span>
          </div>
        </div>
      </div>

      {/* Dual Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* CPU Chart Container */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#39D9E6]" />
              <h3 className="text-sm font-semibold text-white">
                CPU-belastning over tid (%)
              </h3>
            </div>
            <span className="font-mono text-xs text-[#39D9E6]">
              {current.cpuPercent.toFixed(1)}% nå
            </span>
          </div>
          {renderCpuChart()}
        </div>

        {/* RAM Chart Container */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-[#8F2BFF]" />
              <h3 className="text-sm font-semibold text-white">
                Minnebruk over tid (RAM & Heap MB)
              </h3>
            </div>
            <span className="font-mono text-xs text-[#8F2BFF]">
              {current.ramUsedMb.toFixed(1)} MB nå
            </span>
          </div>
          {renderRamChart()}
        </div>
      </div>

      {/* Real-time Stream Events Table */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#161615] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-5 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#39D9E6]" />
            <h3 className="text-xs font-semibold text-white">
              Siste Telemetri-hendelser fra Firebase Stream ({chartData.length} oppdateringer)
            </h3>
          </div>
          <span className="font-mono text-[11px] text-[#888]">
            Oppdateringsfrekvens: ~1.5s
          </span>
        </div>

        <div className="overflow-x-auto max-h-72 custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#1F1F1E] text-[#888] border-b border-[rgba(255,255,255,0.06)]">
              <tr>
                <th className="px-4 py-2.5">Tidsstempel</th>
                <th className="px-4 py-2.5">CPU %</th>
                <th className="px-4 py-2.5">Fysisk RAM</th>
                <th className="px-4 py-2.5">V8 Heap</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Kilde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)] font-mono">
              {chartData
                .slice(-15)
                .reverse()
                .map((row, idx) => (
                  <tr key={idx} className="hover:bg-[#1C1C1B] transition-colors">
                    <td className="px-4 py-2 text-[#AAA]">
                      {new Date(row.timestamp).toLocaleTimeString("nb-NO")}
                    </td>
                    <td className={`px-4 py-2 font-bold ${getCpuColor(row.cpuPercent)}`}>
                      {row.cpuPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-[#CCC]">
                      {row.ramUsedMb.toFixed(1)} MB ({row.ramPercent.toFixed(0)}%)
                    </td>
                    <td className="px-4 py-2 text-[#77F23B]">
                      {row.heapUsedMb.toFixed(1)} MB
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase font-bold ${
                          row.trainingStatus === "running"
                            ? "bg-[#39D9E6]/20 text-[#39D9E6]"
                            : row.trainingStatus === "completed"
                            ? "bg-[#77F23B]/20 text-[#77F23B]"
                            : "bg-[#2A2A28] text-[#888]"
                        }`}
                      >
                        {row.trainingStatus === "running"
                          ? `Epoke ${row.activeEpoch}`
                          : row.trainingStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[#888] text-[11px]">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#77F23B]" />
                        onSnapshot
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
