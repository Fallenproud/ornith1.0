/**
 * ULTIMATE ORNITH 1.0 — Dynamic Export Status Indicator Banner
 *
 * Real-time Firestore synchronization component that maps export status
 * (Ready / Exporting / Pending / Failed) from Firestore onSnapshot events
 * directly to interactive UI indicators, progress bars, and format cards.
 */

import React from "react";
import {
  Package,
  CheckCircle2,
  RefreshCw,
  Clock,
  AlertCircle,
  Cpu,
  Layers,
  FileCode,
  FolderArchive,
  Database,
  ArrowRight,
  Sparkles,
  Zap,
  HardDrive,
  Download,
} from "lucide-react";
import { ModelArtifact, TrainingRun } from "../../types";
import { FirestoreExportStatusPayload } from "../../lib/firebase";
import { formatBytes, formatDateTime } from "../../lib/i18n";

interface DynamicExportStatusBannerProps {
  exportPayload: FirestoreExportStatusPayload | null;
  activeRun?: TrainingRun | null;
  artifacts: ModelArtifact[];
  isTriggeringExport: boolean;
  onStartExportProcess: () => Promise<void>;
  firestoreConnected: boolean;
  lastSnapshotTime: number | null;
  onDownloadFullZip?: () => void;
}

export const DynamicExportStatusBanner: React.FC<DynamicExportStatusBannerProps> = ({
  exportPayload,
  activeRun,
  artifacts,
  isTriggeringExport,
  onStartExportProcess,
  firestoreConnected,
  lastSnapshotTime,
  onDownloadFullZip,
}) => {
  // Determine overall mapped export status
  const currentStatus: "ready" | "exporting" | "pending" | "failed" =
    exportPayload?.status ||
    (isTriggeringExport
      ? "exporting"
      : activeRun?.status === "running"
        ? "exporting"
        : artifacts.length > 0
          ? "ready"
          : "pending");

  const progressPercent = Math.min(
    100,
    Math.max(
      0,
      exportPayload?.exportProgress ??
        (currentStatus === "ready" ? 100 : currentStatus === "exporting" ? 65 : 0),
    ),
  );

  const phaseDescription =
    exportPayload?.exportPhase ||
    (currentStatus === "ready"
      ? "Alle modellartefakter er serialisert, validert og klare for distribusjon i Firestore."
      : currentStatus === "exporting"
        ? "Kompilerer TensorFlow Lite FlatBuffer, SavedModel bundle og C-Header i Firestore..."
        : "Venter på at en treningsøkt fullføres eller en manuell eksport igangsettes.");

  // Map individual format states from Firestore snapshot
  const tfliteArt = artifacts.find((a) => a.fileType === "tflite");
  const savedModelArt = artifacts.find((a) => a.fileType === "saved-model");
  const cHeaderArt = artifacts.find((a) => a.fileType === "c-header");
  const packageArt = artifacts.find((a) => a.fileType === "zip-package");

  const getFormatStatus = (
    art: ModelArtifact | undefined,
    fallbackKey: "tflite" | "savedModel" | "cHeader" | "zipPackage",
  ): {
    status: "ready" | "exporting" | "pending" | "failed";
    label: string;
    badgeClass: string;
    icon: React.ReactNode;
  } => {
    const firestoreFormat = exportPayload?.exports?.[fallbackKey]?.status;
    const finalState =
      firestoreFormat ||
      art?.status ||
      art?.readinessState ||
      (currentStatus === "ready" ? "ready" : currentStatus === "exporting" ? "exporting" : "pending");

    switch (finalState) {
      case "ready":
        return {
          status: "ready",
          label: "Klar (Ready)",
          badgeClass: "bg-[#77F23B]/10 text-[#77F23B] border-[#77F23B]/30",
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#77F23B]" />,
        };
      case "exporting":
        return {
          status: "exporting",
          label: "Eksporterer",
          badgeClass: "bg-[#FF9F0A]/10 text-[#FF9F0A] border-[#FF9F0A]/30",
          icon: <RefreshCw className="h-3.5 w-3.5 text-[#FF9F0A] animate-spin" />,
        };
      case "failed":
        return {
          status: "failed",
          label: "Feilet",
          badgeClass: "bg-[#FF453A]/10 text-[#FF453A] border-[#FF453A]/30",
          icon: <AlertCircle className="h-3.5 w-3.5 text-[#FF453A]" />,
        };
      case "pending":
      default:
        return {
          status: "pending",
          label: "Venter",
          badgeClass: "bg-[#333]/40 text-[#A3A3A0] border-[rgba(255,255,255,0.08)]",
          icon: <Clock className="h-3.5 w-3.5 text-[#A3A3A0]" />,
        };
    }
  };

  const tfliteStatus = getFormatStatus(tfliteArt, "tflite");
  const savedModelStatus = getFormatStatus(savedModelArt, "savedModel");
  const cHeaderStatus = getFormatStatus(cHeaderArt, "cHeader");
  const packageStatus = getFormatStatus(packageArt, "zipPackage");

  const readyFormatsCount = [
    tfliteStatus.status === "ready",
    savedModelStatus.status === "ready",
    cHeaderStatus.status === "ready",
    packageStatus.status === "ready",
  ].filter(Boolean).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.1)] bg-gradient-to-b from-[#161615] to-[#10100F] p-5 shadow-xl transition-all">
      {/* Dynamic Background Accent Glow */}
      <div
        className={`pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full blur-3xl transition-opacity ${
          currentStatus === "ready"
            ? "bg-[#77F23B]/10 opacity-100"
            : currentStatus === "exporting"
              ? "bg-[#FF9F0A]/15 opacity-100 animate-pulse"
              : "bg-[#8F2BFF]/10 opacity-50"
        }`}
      />

      {/* Top Header Row: Title, Real-time status indicator & Action Button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${
              currentStatus === "ready"
                ? "border-[#77F23B]/40 bg-[#77F23B]/10 text-[#77F23B]"
                : currentStatus === "exporting"
                  ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#FF9F0A]"
                  : "border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] text-white"
            }`}
          >
            {currentStatus === "exporting" ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : currentStatus === "ready" ? (
              <CheckCircle2 className="h-5 w-5 text-[#77F23B]" />
            ) : (
              <Package className="h-5 w-5 text-[#B25CFF]" />
            )}
            <span
              className={`absolute -top-1 -right-1 flex h-2.5 w-2.5 rounded-full ${
                currentStatus === "ready"
                  ? "bg-[#77F23B]"
                  : currentStatus === "exporting"
                    ? "bg-[#FF9F0A] animate-ping"
                    : "bg-[#666]"
              }`}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Sanntids Eksportprosess & Firestore-status
              </h2>

              {/* Dynamic Status Pill */}
              {currentStatus === "ready" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#77F23B]/40 bg-[#77F23B]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#77F23B]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#77F23B]" />
                  <span>KLAR (READY)</span>
                </span>
              )}

              {currentStatus === "exporting" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF9F0A]/40 bg-[#FF9F0A]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FF9F0A]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F0A] animate-ping" />
                  <span>EKSPORTERER ({progressPercent}%)</span>
                </span>
              )}

              {currentStatus === "pending" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[#222] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#A3A3A0]">
                  <Clock className="h-3 w-3" />
                  <span>VENTER PÅ EKSPORT</span>
                </span>
              )}

              {currentStatus === "failed" && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF453A]/40 bg-[#FF453A]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FF453A]">
                  <AlertCircle className="h-3 w-3" />
                  <span>FEILET</span>
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-[#A3A3A0] max-w-xl leading-relaxed">
              {phaseDescription}
            </p>
          </div>
        </div>

        {/* Right side interactive actions */}
        <div className="flex flex-wrap items-center gap-2">
          {currentStatus === "ready" && onDownloadFullZip && (
            <button
              onClick={onDownloadFullZip}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#77F23B] to-[#39D9E6] px-3.5 py-2 text-xs font-bold text-[#0D0D0C] shadow-md transition-all hover:opacity-95 cursor-pointer"
              title="Last ned komplett produksjonspakke (.zip)"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Last ned ZIP-pakke</span>
            </button>
          )}

          <button
            onClick={onStartExportProcess}
            disabled={isTriggeringExport}
            className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
              currentStatus === "exporting" || isTriggeringExport
                ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/10 text-[#FF9F0A] cursor-not-allowed"
                : "border-[rgba(255,255,255,0.14)] bg-[#1F1F1E] text-white hover:bg-[#282827] hover:border-[#8F2BFF]/50 cursor-pointer"
            }`}
            title="Start eller simuler sanntidseksport for å observere Firestore status-synkronisering live"
          >
            {isTriggeringExport ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#FF9F0A]" />
                <span>Synkroniserer...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 text-[#39D9E6]" />
                <span>{currentStatus === "ready" ? "Kjør Ny Eksport" : "Start Eksportprosess"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Dynamic Progress Bar for Real-time Export */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#A3A3A0] mb-1.5">
          <div className="flex items-center gap-2">
            <span>Prosessfremdrift:</span>
            <span className="font-bold text-white">
              {currentStatus === "ready"
                ? "100% Fullført"
                : currentStatus === "exporting"
                  ? `${progressPercent}% Pågår`
                  : "0% Ikke påbegynt"}
            </span>
          </div>
          <span>
            {readyFormatsCount} av 4 formater klare
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F1F1E] p-0.5 border border-[rgba(255,255,255,0.06)]">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              currentStatus === "ready"
                ? "bg-[#77F23B]"
                : currentStatus === "exporting"
                  ? "bg-gradient-to-r from-[#FF9F0A] via-[#39D9E6] to-[#8F2BFF] animate-pulse"
                  : "bg-[#333]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Format-by-Format Live Status Grid */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. TensorFlow Lite */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
            tfliteStatus.status === "ready"
              ? "border-[#39D9E6]/30 bg-[#39D9E6]/5"
              : tfliteStatus.status === "exporting"
                ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/5 animate-pulse"
                : "border-[rgba(255,255,255,0.06)] bg-[#141414]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#39D9E6]" />
              <span className="font-mono text-xs font-bold text-white">
                TFLite (.tflite)
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${tfliteStatus.badgeClass}`}
            >
              {tfliteStatus.icon}
              <span>{tfliteStatus.label}</span>
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A3A3A0]">
            <span>FlatBuffer INT8</span>
            <span className="font-mono text-white">
              {tfliteArt ? formatBytes(tfliteArt.sizeBytes) : "~8.2 KB"}
            </span>
          </div>
        </div>

        {/* 2. TensorFlow SavedModel */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
            savedModelStatus.status === "ready"
              ? "border-[#8F2BFF]/30 bg-[#8F2BFF]/5"
              : savedModelStatus.status === "exporting"
                ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/5 animate-pulse"
                : "border-[rgba(255,255,255,0.06)] bg-[#141414]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#B25CFF]" />
              <span className="font-mono text-xs font-bold text-white">
                SavedModel (.zip)
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${savedModelStatus.badgeClass}`}
            >
              {savedModelStatus.icon}
              <span>{savedModelStatus.label}</span>
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A3A3A0]">
            <span>TF 2.x Serving</span>
            <span className="font-mono text-white">
              {savedModelArt ? formatBytes(savedModelArt.sizeBytes) : "~32.4 KB"}
            </span>
          </div>
        </div>

        {/* 3. Embedded C-Header */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
            cHeaderStatus.status === "ready"
              ? "border-[#77F23B]/30 bg-[#77F23B]/5"
              : cHeaderStatus.status === "exporting"
                ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/5 animate-pulse"
                : "border-[rgba(255,255,255,0.06)] bg-[#141414]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-[#77F23B]" />
              <span className="font-mono text-xs font-bold text-white">
                C-Header (.h)
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${cHeaderStatus.badgeClass}`}
            >
              {cHeaderStatus.icon}
              <span>{cHeaderStatus.label}</span>
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A3A3A0]">
            <span>Zero-Heap Micro</span>
            <span className="font-mono text-white">
              {cHeaderArt ? formatBytes(cHeaderArt.sizeBytes) : "~14.1 KB"}
            </span>
          </div>
        </div>

        {/* 4. Complete ZIP Package */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-3 transition-all ${
            packageStatus.status === "ready"
              ? "border-[#FF9F0A]/30 bg-[#FF9F0A]/5"
              : packageStatus.status === "exporting"
                ? "border-[#FF9F0A]/40 bg-[#FF9F0A]/5 animate-pulse"
                : "border-[rgba(255,255,255,0.06)] bg-[#141414]"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderArchive className="h-4 w-4 text-[#FF9F0A]" />
              <span className="font-mono text-xs font-bold text-white">
                Eksportpakke (.zip)
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${packageStatus.badgeClass}`}
            >
              {packageStatus.icon}
              <span>{packageStatus.label}</span>
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#A3A3A0]">
            <span>Pakke med logger & skript</span>
            <span className="font-mono text-white">
              {packageArt ? formatBytes(packageArt.sizeBytes) : "~68.0 KB"}
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Firestore Synchronization Footer */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.06)] pt-3 text-[11px] text-[#888]">
        <div className="flex items-center gap-2 font-mono">
          <Database className="h-3.5 w-3.5 text-[#39D9E6]" />
          <span>Firestore Sanntidslytter (onSnapshot):</span>
          <span
            className={`inline-flex items-center gap-1 font-bold ${
              firestoreConnected ? "text-[#77F23B]" : "text-[#FF9F0A]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                firestoreConnected ? "bg-[#77F23B] animate-ping" : "bg-[#FF9F0A]"
              }`}
            />
            {firestoreConnected ? "Tilkoblet" : "Venter på snapshot"}
          </span>
          {activeRun?.id && (
            <span className="hidden md:inline text-[#666]">
              • /runs/{activeRun.id.substring(0, 10)}...
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px]">
          {lastSnapshotTime && (
            <span>
              Sist oppdatert:{" "}
              <strong className="text-[#CCC]">
                {new Date(lastSnapshotTime).toLocaleTimeString("nb-NO")}
              </strong>
            </span>
          )}
          {exportPayload?.lastExportedAt && (
            <span>
              Fullført:{" "}
              <strong className="text-[#77F23B]">
                {formatDateTime(exportPayload.lastExportedAt)}
              </strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
