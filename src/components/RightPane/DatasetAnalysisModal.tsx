/**
 * ULTIMATE ORNITH 1.0 — Dataset Analysis & Automated Remediation Modal
 *
 * Provides intelligent heuristic inspection for duplicate texts (with/without label conflicts)
 * and missing/placeholder labels, along with automated remediation/removal actions.
 */

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Copy,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ShieldAlert,
  ArrowRight,
  Filter,
  Check,
  RefreshCw,
  Info,
} from "lucide-react";
import { DatasetRecord, DatasetMetadata } from "../../types";
import {
  analyzeDatasetHeuristics,
  DatasetHeuristicsReport,
  DuplicateGroup,
  MissingLabelFinding,
} from "../../lib/datasetHeuristics";
import { API } from "../../lib/api";

interface DatasetAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetMeta: DatasetMetadata | null;
  records: DatasetRecord[];
  projectId?: string;
  onDatasetCleaned: (updatedMeta: DatasetMetadata, updatedRecords: DatasetRecord[], removedCount: number) => void;
}

export const DatasetAnalysisModal: React.FC<DatasetAnalysisModalProps> = ({
  isOpen,
  onClose,
  datasetMeta,
  records,
  projectId,
  onDatasetCleaned,
}) => {
  const [activeTab, setActiveTab] = useState<"overview" | "duplicates" | "unlabeled">("overview");
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionNotice, setExecutionNotice] = useState<string | null>(null);
  const [selectedDuplicateIds, setSelectedDuplicateIds] = useState<Set<string>>(new Set());
  const [selectedMissingIds, setSelectedMissingIds] = useState<Set<string>>(new Set());

  // Run heuristics analysis
  const report: DatasetHeuristicsReport = useMemo(() => {
    return analyzeDatasetHeuristics(records);
  }, [records]);

  // Initialize selected IDs whenever report updates
  React.useEffect(() => {
    setSelectedDuplicateIds(new Set(report.removableDuplicateIds));
    setSelectedMissingIds(new Set(report.removableMissingLabelIds));
  }, [report]);

  if (!isOpen || !datasetMeta) return null;

  const totalSelectedRemovals = selectedDuplicateIds.size + selectedMissingIds.size;

  const handleApplyClean = async (mode: "all" | "duplicates_only" | "unlabeled_only" | "selected") => {
    if (!datasetMeta) return;

    let idsToRemove: string[] = [];
    if (mode === "all") {
      idsToRemove = report.allRemovableIds;
    } else if (mode === "duplicates_only") {
      idsToRemove = report.removableDuplicateIds;
    } else if (mode === "unlabeled_only") {
      idsToRemove = report.removableMissingLabelIds;
    } else {
      idsToRemove = Array.from(new Set([...selectedDuplicateIds, ...selectedMissingIds]));
    }

    if (idsToRemove.length === 0) {
      setExecutionNotice("Ingen rader er markert for fjerning.");
      setTimeout(() => setExecutionNotice(null), 3000);
      return;
    }

    setIsExecuting(true);
    setExecutionNotice(null);

    try {
      const res = await API.cleanDataset(datasetMeta.id, {
        recordIdsToRemove: idsToRemove,
        projectId,
      });

      onDatasetCleaned(res.meta, res.records, res.removedCount);
      setExecutionNotice(`Vellykket! ${res.removedCount} problematiske rader ble fjernet.`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Clean dataset failed", err);
      setExecutionNotice(`Feil under rensing: ${err.message || "Ukjent feil"}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleDuplicateSelection = (id: string) => {
    setSelectedDuplicateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleMissingSelection = (id: string) => {
    setSelectedMissingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#121212] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#171717] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8F2BFF]/20 text-[#B25CFF]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Heuristisk Datasett-analyse
              </h2>
              <p className="text-xs text-[#A3A3A0]">
                Automatisk deteksjon av dubletter, etikett-konflikter og umerkede eksempler
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-lg p-2 text-[#888] transition-colors hover:bg-[#252525] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Execution Notice */}
        {executionNotice && (
          <div className="flex items-center justify-between border-b border-[#39D9E6]/30 bg-[#39D9E6]/10 px-6 py-2.5 text-xs text-[#39D9E6]">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>{executionNotice}</span>
            </div>
            <button onClick={() => setExecutionNotice(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Top Summary Banner */}
        <div className="grid grid-cols-1 gap-3 border-b border-[rgba(255,255,255,0.06)] bg-[#141414] p-6 sm:grid-cols-4">
          {/* Health Score */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-4">
            <div className="text-xs text-[#888]">Data-kvalitetsscore</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl font-bold ${
                  report.healthScore >= 90
                    ? "text-[#77F23B]"
                    : report.healthScore >= 75
                    ? "text-[#FF9F0A]"
                    : "text-[#FF453A]"
                }`}
              >
                {report.healthScore}%
              </span>
              <span className="text-xs text-[#888]">av 100%</span>
            </div>
            <div className="mt-1 text-[11px] text-[#AAA]">
              {report.healthScore >= 90
                ? "Høy renhet for trening"
                : report.healthScore >= 75
                ? "Tiltak anbefales"
                : "Krever opprydding"}
            </div>
          </div>

          {/* Duplicates Metric */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-4">
            <div className="text-xs text-[#888]">Identifiserte dubletter</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-white">
                {report.totalDuplicatesCount}
              </span>
              <span className="text-xs text-[#888]">
                i {report.duplicateGroups.length} grupper
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#FF9F0A]">
              {report.conflictingDuplicatesCount > 0
                ? `⚠️ ${report.conflictingDuplicatesCount} med konfliktende etikett`
                : "Eksakte tekstgjentakelser"}
            </div>
          </div>

          {/* Missing Labels Metric */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-4">
            <div className="text-xs text-[#888]">Manglende merkelapper</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-[#FF453A]">
                {report.totalMissingLabelsCount}
              </span>
              <span className="text-xs text-[#888]">umerkede</span>
            </div>
            <div className="mt-1 text-[11px] text-[#AAA]">
              {report.totalMissingLabelsCount === 0
                ? "Alle rader er annotert"
                : "Tomme eller ukjente etiketter"}
            </div>
          </div>

          {/* Action Recommendation */}
          <div className="rounded-xl border border-[#8F2BFF]/30 bg-[#8F2BFF]/10 p-4">
            <div className="text-xs text-[#B25CFF]">Foreslått tiltak</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {report.allRemovableIds.length === 0
                ? "Ingen fjerning nødvendig"
                : `Fjern ${report.allRemovableIds.length} rader`}
            </div>
            <div className="mt-1 text-[11px] text-[#CCC]">
              {report.allRemovableIds.length === 0
                ? "Datasettet er allerede optimalisert."
                : "Gjenoppretter balansert gradientstabilitet."}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[rgba(255,255,255,0.08)] bg-[#161616] px-6">
          <button
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "overview"
                ? "border-[#8F2BFF] text-white"
                : "border-transparent text-[#888] hover:text-[#CCC]"
            }`}
          >
            Foreslåtte tiltak ({report.allRemovableIds.length})
          </button>
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "duplicates"
                ? "border-[#8F2BFF] text-white"
                : "border-transparent text-[#888] hover:text-[#CCC]"
            }`}
          >
            Dubletter ({report.totalDuplicatesCount})
          </button>
          <button
            onClick={() => setActiveTab("unlabeled")}
            className={`border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "unlabeled"
                ? "border-[#8F2BFF] text-white"
                : "border-transparent text-[#888] hover:text-[#CCC]"
            }`}
          >
            Umerkede oppføringer ({report.totalMissingLabelsCount})
          </button>
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* TAB 1: OVERVIEW & ACTIONS */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Heuristisk Diagnose og Automatiserte Tiltak
                </h3>
                <p className="mt-1 text-xs text-[#888]">
                  Våre heuristikker har skannet {report.totalRecords} rader i{' '}
                  <span className="font-mono text-[#39D9E6]">{datasetMeta.name}</span>.
                  Nedenfor kan du utføre automatiserte fjerningstiltak med ett klikk.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Clean Duplicates Action Card */}
                <div className="flex flex-col justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171717] p-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Copy className="h-4 w-4 text-[#FF9F0A]" />
                      <span>Fjern overflødige dubletter</span>
                    </div>
                    <p className="mt-2 text-xs text-[#A3A3A0]">
                      Fjerner {report.totalDuplicatesCount} etterfølgende identiske setninger,
                      og bevarer kun den første unike forekomsten for å forhindre overtilpasning.
                    </p>
                    {report.conflictingDuplicatesCount > 0 && (
                      <div className="mt-2 rounded border border-[#FF453A]/30 bg-[#FF453A]/10 p-2 text-[11px] text-[#FF453A]">
                        ⚠️ {report.conflictingDuplicatesCount} dubletter har motstridende klasser som
                        skader modellens konvergens.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-2">
                    <span className="font-mono text-xs text-[#888]">
                      {report.totalDuplicatesCount} rader berøres
                    </span>
                    <button
                      onClick={() => handleApplyClean("duplicates_only")}
                      disabled={isExecuting || report.totalDuplicatesCount === 0}
                      className="flex items-center gap-1.5 rounded-lg border border-[#FF9F0A]/40 bg-[#FF9F0A]/10 px-3 py-1.5 text-xs font-medium text-[#FF9F0A] transition-colors hover:bg-[#FF9F0A]/20 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Fjern kun dubletter</span>
                    </button>
                  </div>
                </div>

                {/* Clean Unlabeled Action Card */}
                <div className="flex flex-col justify-between rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171717] p-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <Tag className="h-4 w-4 text-[#FF453A]" />
                      <span>Fjern umerkede rader</span>
                    </div>
                    <p className="mt-2 text-xs text-[#A3A3A0]">
                      Fjerner {report.totalMissingLabelsCount} rader som mangler gyldig
                      intensjon eller etikett (f.eks. tomme felter, 'ukjent', 'null').
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-2">
                    <span className="font-mono text-xs text-[#888]">
                      {report.totalMissingLabelsCount} rader berøres
                    </span>
                    <button
                      onClick={() => handleApplyClean("unlabeled_only")}
                      disabled={isExecuting || report.totalMissingLabelsCount === 0}
                      className="flex items-center gap-1.5 rounded-lg border border-[#FF453A]/40 bg-[#FF453A]/10 px-3 py-1.5 text-xs font-medium text-[#FF453A] transition-colors hover:bg-[#FF453A]/20 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Fjern kun umerkede</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recommendation banner */}
              <div className="rounded-xl border border-[#77F23B]/30 bg-[#77F23B]/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-[#77F23B]" />
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      Anbefalt: Fullfør automatisk datasett-sanering
                    </h4>
                    <p className="mt-1 text-xs text-[#CCC]">
                      Ved å fjerne både de {report.totalDuplicatesCount} overflødige dublettene og
                      de {report.totalMissingLabelsCount} umerkede oppføringene, optimaliserer du
                      tensorspenn og ordforråd direkte for embedded inferens på mikrokontrollere.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DUPLICATES LIST */}
          {activeTab === "duplicates" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Duplikatgrupper ({report.duplicateGroups.length})
                  </h3>
                  <p className="text-xs text-[#888]">
                    Hver gruppe viser den opprinnelige oppføringen som beholdes, samt duplikater markert for fjerning.
                  </p>
                </div>
                <div className="text-xs text-[#888]">
                  Markert for fjerning: <span className="font-mono text-white">{selectedDuplicateIds.size}</span>
                </div>
              </div>

              {report.duplicateGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#171717] py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-[#77F23B]" />
                  <p className="mt-2 text-sm font-medium text-white">Ingen dubletter funnet</p>
                  <p className="text-xs text-[#888]">Alle setningene i datasettet er unike.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {report.duplicateGroups.map((group, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171717] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-xs text-[#39D9E6]">
                          Gruppe #{idx + 1} ({group.records.length} forekomster)
                        </span>
                        {group.hasConflictingLabels ? (
                          <span className="rounded bg-[#FF453A]/20 px-2 py-0.5 text-[10px] font-semibold text-[#FF453A]">
                            Motstridende etiketter: {group.distinctLabels.join(", ")}
                          </span>
                        ) : (
                          <span className="rounded bg-[#77F23B]/20 px-2 py-0.5 text-[10px] font-semibold text-[#77F23B]">
                            Samme etikett ({group.distinctLabels[0] || "n/a"})
                          </span>
                        )}
                      </div>

                      {/* Records within this group */}
                      <div className="divide-y divide-[rgba(255,255,255,0.04)] text-xs">
                        {group.records.map((r, rIdx) => {
                          const isCanonical = r.id === group.canonicalRecordId;
                          const isSelectedForRemoval = selectedDuplicateIds.has(r.id);

                          return (
                            <div
                              key={r.id}
                              className="flex items-center justify-between py-2"
                            >
                              <div className="flex items-center gap-3">
                                {isCanonical ? (
                                  <span className="rounded bg-[#77F23B]/20 px-2 py-0.5 text-[10px] font-medium text-[#77F23B]">
                                    Beholdes (Original)
                                  </span>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={isSelectedForRemoval}
                                    onChange={() => toggleDuplicateSelection(r.id)}
                                    className="h-3.5 w-3.5 rounded border-gray-600 text-[#8F2BFF] focus:ring-[#8F2BFF]"
                                    title="Merk for fjerning"
                                  />
                                )}
                                <span className="font-mono text-white">{r.text}</span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="rounded border border-[rgba(255,255,255,0.1)] bg-[#202020] px-2 py-0.5 font-mono text-[11px] text-[#A3A3A0]">
                                  {r.label || "–"}
                                </span>
                                <span className="font-mono text-[10px] text-[#666]">
                                  {r.id}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MISSING LABELS LIST */}
          {activeTab === "unlabeled" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Umerkede eller Ufullstendige Rader ({report.missingLabelFindings.length})
                  </h3>
                  <p className="text-xs text-[#888]">
                    Disse setningene mangler en gyldig målklasse som trengs for veiledet trening.
                  </p>
                </div>
                <div className="text-xs text-[#888]">
                  Markert for fjerning: <span className="font-mono text-white">{selectedMissingIds.size}</span>
                </div>
              </div>

              {report.missingLabelFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#171717] py-12 text-center">
                  <CheckCircle2 className="h-8 w-8 text-[#77F23B]" />
                  <p className="mt-2 text-sm font-medium text-white">Alle rader har gyldig merkelapp</p>
                  <p className="text-xs text-[#888]">Ingen umerkede eller ukjente datafelter oppdaget.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#171717]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] text-[#888]">
                      <tr>
                        <th className="w-10 px-4 py-3 text-center">Fjern</th>
                        <th className="px-4 py-3">Tekst</th>
                        <th className="px-4 py-3">Nåværende etikett</th>
                        <th className="px-4 py-3">Årsak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {report.missingLabelFindings.map((finding) => {
                        const isSelected = selectedMissingIds.has(finding.record.id);
                        return (
                          <tr key={finding.record.id} className="hover:bg-[#202020]">
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMissingSelection(finding.record.id)}
                                className="h-3.5 w-3.5 rounded border-gray-600 text-[#8F2BFF] focus:ring-[#8F2BFF]"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-white">
                              {finding.record.text || "<tom tekst>"}
                            </td>
                            <td className="px-4 py-3 font-mono text-[#FF453A]">
                              {finding.record.label ? `"${finding.record.label}"` : "– (tom)"}
                            </td>
                            <td className="px-4 py-3 text-[#A3A3A0]">
                              {finding.reason === "empty"
                                ? "Mangler helt etikett"
                                : finding.reason === "unknown_intent"
                                ? "Uspesifisert 'ukjent'-plassholder"
                                : "Ugyldig plassholder"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] bg-[#171717] px-6 py-4">
          <div className="text-xs text-[#888]">
            Totalt <span className="font-mono text-white">{totalSelectedRemovals}</span> rader valgt for fjerning.
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isExecuting}
              className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#202020] px-4 py-2 text-xs font-medium text-[#CCC] transition-colors hover:bg-[#2A2A28] hover:text-white disabled:opacity-50"
            >
              Lukk
            </button>

            <button
              onClick={() => handleApplyClean("all")}
              disabled={isExecuting || report.allRemovableIds.length === 0}
              className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8F2BFF]/30 transition-all hover:bg-[#A347FF] active:scale-[0.98] disabled:opacity-50"
            >
              {isExecuting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span>
                {isExecuting
                  ? "Renser datasett..."
                  : `Auto-rens datasett (${report.allRemovableIds.length} rader)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
