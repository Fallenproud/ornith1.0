/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Dataset Mode & Validation Inspector
 *
 * Comprehensive Norwegian NLP dataset viewer, rule configuration, live
 * re-validation against project rules, failure breakdown, and record-level
 * error diagnostics.
 */

import React, { useState, useEffect } from "react";
import {
  Database,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Sliders,
  Filter,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  Check,
  X,
  FileWarning,
} from "lucide-react";
import {
  DatasetMetadata,
  DatasetRecord,
  ProjectMetadata,
  DatasetValidationRule,
  RuleFailureStat,
  ValidationErrorDetail,
} from "../../types";
import { API } from "../../lib/api";
import { formatNumber, formatPercent } from "../../lib/i18n";
import { ValidationRulesManager } from "./ValidationRulesManager";
import { DatasetAnalysisModal } from "./DatasetAnalysisModal";

interface DatasetModeProps {
  activeDataset: DatasetMetadata | null;
  activeProject?: ProjectMetadata | null;
  onOpenUploadModal: () => void;
  onProjectUpdated?: (p: ProjectMetadata) => void;
  onDatasetUpdated?: (meta: DatasetMetadata) => void;
}

export const DatasetMode: React.FC<DatasetModeProps> = ({
  activeDataset,
  activeProject,
  onOpenUploadModal,
  onProjectUpdated,
  onDatasetUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<"records" | "rules">("records");
  const [datasetData, setDatasetData] = useState<{
    meta: DatasetMetadata;
    records: DatasetRecord[];
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "errors" | "warnings" | "valid"
  >("all");
  const [selectedRuleFilter, setSelectedRuleFilter] = useState<string | null>(
    null,
  );
  const [onlyNorwegianChars, setOnlyNorwegianChars] = useState(false);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [revalidationNotice, setRevalidationNotice] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!activeDataset) return;
    const fetchFullDataset = async () => {
      setIsLoading(true);
      try {
        const data = await API.getDataset(activeDataset.id);
        setDatasetData(data);
      } catch (e) {
        console.error("Failed to load dataset details", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFullDataset();
  }, [activeDataset?.id]);

  const handleRevalidateDataset = async (
    customRules?: DatasetValidationRule[],
  ) => {
    if (!activeDataset) return;
    setIsRevalidating(true);
    setRevalidationNotice(null);
    try {
      const res = await API.revalidateDataset(activeDataset.id, {
        projectId: activeProject?.id,
        rules: customRules,
        strictMode: activeProject?.validationConfig?.strictMode,
      });
      setDatasetData({ meta: res.meta, records: res.records });
      if (onDatasetUpdated) {
        onDatasetUpdated(res.meta);
      }
      setRevalidationNotice(
        `Datasettet ble validert på nytt! ${res.summary.validRows} gyldige, ${res.summary.invalidRows} med feil, ${res.summary.warningRows || 0} med advarsler.`,
      );
      setTimeout(() => setRevalidationNotice(null), 5000);
    } catch (e: any) {
      console.error("Re-validation error:", e);
      setRevalidationNotice(`Validering feilet: ${e.message}`);
    } finally {
      setIsRevalidating(false);
    }
  };

  const meta = datasetData?.meta || activeDataset;
  const records = datasetData?.records || [];
  const validationSummary = meta?.validation;

  // Compute counts
  const totalCount = records.length;
  const invalidCount = records.filter((r) => !r.isValid).length;
  const warningCount = records.filter(
    (r) =>
      r.validationFailures &&
      r.validationFailures.some((f) => f.severity === "warning"),
  ).length;
  const validCount = records.filter((r) => r.isValid).length;

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (
      searchQuery &&
      !r.text.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    if (selectedLabel !== "all" && r.label !== selectedLabel) {
      return false;
    }
    if (
      onlyNorwegianChars &&
      (!r.norwegianCharCount || r.norwegianCharCount.total === 0)
    ) {
      return false;
    }
    if (statusFilter === "errors" && r.isValid) {
      return false;
    }
    if (statusFilter === "warnings") {
      const hasWarn = r.validationFailures?.some(
        (f) => f.severity === "warning",
      );
      if (!hasWarn) return false;
    }
    if (statusFilter === "valid" && !r.isValid) {
      return false;
    }
    if (selectedRuleFilter) {
      const failedThisRule = r.validationFailures?.some(
        (f) => f.ruleId === selectedRuleFilter,
      );
      if (!failedThisRule) return false;
    }
    return true;
  });

  const classDist = validationSummary?.classDistribution || {};
  const charDist = validationSummary?.charDistribution || {
    ae: 0,
    oe: 0,
    aa: 0,
    capitalizedNorwegian: 0,
  };
  const ruleFailures = validationSummary?.ruleFailures || [];

  return (
    <div className="flex h-full flex-col bg-[#0E0E0D] text-[#F4F4F2]">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] bg-[#141414] px-6 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold text-white tracking-tight">
              {meta?.name || "Norsk Datasett"}
            </h1>
            <span className="rounded bg-[#8F2BFF]/20 px-2 py-0.5 font-mono text-xs font-semibold text-[#B25CFF]">
              {meta?.format?.toUpperCase() || "JSONL"}
            </span>
            <span className="rounded border border-[#77F23B]/30 bg-[#77F23B]/10 px-2 py-0.5 font-mono text-xs text-[#77F23B]">
              {meta?.dialect || "Bokmål"}
            </span>
            {validationSummary?.rulesAppliedCount !== undefined && (
              <span className="rounded border border-[rgba(255,255,255,0.1)] bg-[#1F1F1E] px-2 py-0.5 font-mono text-xs text-[#A3A3A0]">
                {validationSummary.rulesAppliedCount} valideringsregler
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#A3A3A0]">
            Kilde: {meta?.source || "Lokalt korpus"} • Lisens:{" "}
            {meta?.license || "CC-BY-4.0"} • Opprettet:{" "}
            {meta?.createdAt
              ? new Date(meta.createdAt).toLocaleDateString("nb-NO")
              : "Nå"}
          </p>
        </div>

        {/* Action Buttons & Tab Switch */}
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-1 text-xs">
            <button
              onClick={() => setActiveTab("records")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all ${
                activeTab === "records"
                  ? "bg-[#8F2BFF] text-white shadow-sm"
                  : "text-[#888] hover:text-white"
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Datasett & Valideringsfeil</span>
            </button>
            <button
              onClick={() => setActiveTab("rules")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-all ${
                activeTab === "rules"
                  ? "bg-[#8F2BFF] text-white shadow-sm"
                  : "text-[#888] hover:text-white"
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Valideringsregler</span>
            </button>
          </div>

          <button
            onClick={() => setIsAnalysisModalOpen(true)}
            disabled={!activeDataset || records.length === 0}
            title="Heuristisk analyse for dubletter og manglende merkelapper"
            className="flex items-center gap-1.5 rounded-lg border border-[#8F2BFF]/40 bg-[#8F2BFF]/15 px-3 py-2 text-xs font-semibold text-[#B25CFF] transition-all hover:bg-[#8F2BFF]/25 hover:text-white disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#B25CFF]" />
            <span>Analyse & Opprydding</span>
          </button>

          <button
            onClick={() => handleRevalidateDataset()}
            disabled={isRevalidating || !activeDataset}
            title="Kjør alle prosjektets valideringsregler på nytt over dette datasettet"
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1F1F1E] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#2A2A28] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#39D9E6] ${isRevalidating ? "animate-spin" : ""}`}
            />
            <span>
              {isRevalidating ? "Validerer..." : "Kjør Validering på nytt"}
            </span>
          </button>

          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-3.5 py-2 text-xs font-medium text-white shadow-md shadow-[#8F2BFF]/20 transition-all hover:bg-[#A347FF]"
          >
            <Upload className="h-4 w-4" />
            <span>Last opp nytt datasett</span>
          </button>
        </div>
      </div>

      {/* Notice Bar if recently re-validated */}
      {revalidationNotice && (
        <div className="flex items-center justify-between border-b border-[#39D9E6]/30 bg-[#39D9E6]/10 px-6 py-2.5 text-xs text-[#39D9E6]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{revalidationNotice}</span>
          </div>
          <button
            onClick={() => setRevalidationNotice(null)}
            className="text-[#39D9E6] hover:opacity-80"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tab 2: Validation Rules Management View */}
      {activeTab === "rules" && (
        <div className="flex-1 overflow-hidden">
          <ValidationRulesManager
            activeProject={activeProject || null}
            onProjectUpdated={onProjectUpdated}
            onApplyRulesToActiveDataset={(newRules) =>
              handleRevalidateDataset(newRules)
            }
          />
        </div>
      )}

      {/* Tab 1: Dataset Inspection & Record-level Validation Details */}
      {activeTab === "records" && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {/* Metrics Grid */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
                <span>Norsk Språkskår</span>
                <Sparkles className="h-3.5 w-3.5 text-[#77F23B]" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="font-mono text-xl font-bold text-white">
                  {formatPercent(validationSummary?.norwegianScore || 1.0, 0)}
                </span>
                <span className="text-[10px] text-[#77F23B]">
                  Kvalitetssikret
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
                <span>Gyldige vs. Feil</span>
                <Database className="h-3.5 w-3.5 text-[#39D9E6]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-[#77F23B]">
                  {validCount}
                </span>
                <span className="font-mono text-xs text-[#A3A3A0]">
                  / {totalCount}
                </span>
                {invalidCount > 0 && (
                  <span className="rounded bg-[#FF453A]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#FF453A]">
                    {invalidCount} feil
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
                <span>Norske tegn (æ, ø, å)</span>
                <span className="font-mono text-xs text-[#B25CFF]">æøå</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-white">
                  {charDist.ae + charDist.oe + charDist.aa}
                </span>
                <span className="font-mono text-[10px] text-[#A3A3A0]">
                  æ:{charDist.ae} ø:{charDist.oe} å:{charDist.aa}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
              <div className="flex items-center justify-between text-xs text-[#A3A3A0]">
                <span>Advarsler & Duplikater</span>
                <AlertTriangle className="h-3.5 w-3.5 text-[#FF9F0A]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-xl font-bold text-[#FF9F0A]">
                  {warningCount}
                </span>
                <span className="font-mono text-[10px] text-[#A3A3A0]">
                  {validationSummary?.duplicateRows || 0} dupl.
                </span>
                {(validationSummary?.mojibakeCount || 0) > 0 && (
                  <span className="rounded bg-[#FF453A]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#FF453A]">
                    {validationSummary?.mojibakeCount} mojibake
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Validation Rule Failures Breakdown Panel */}
          {ruleFailures.length > 0 && (
            <div className="mb-6 rounded-xl border border-[#FF453A]/20 bg-[#171414] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <FileWarning className="h-4 w-4 text-[#FF453A]" />
                  <span>
                    Oppdagede Regelbrudd ({ruleFailures.length} regler med
                    utslag)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("rules")}
                    className="flex items-center gap-1 rounded bg-[#8F2BFF]/20 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#B25CFF] hover:bg-[#8F2BFF]/30 transition-colors"
                    title="Åpne terskelskjema og valideringsregler"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>Konfigurer terskler</span>
                  </button>
                  {selectedRuleFilter && (
                    <button
                      onClick={() => setSelectedRuleFilter(null)}
                      className="flex items-center gap-1 font-mono text-[11px] text-[#39D9E6] hover:underline"
                    >
                      <span>Nullstill filter</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-[11px] text-[#A3A3A0]">
                Klikk på et regelkort for å filtrere tabellen til kun postene
                som feilet den regelen:
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                {ruleFailures.map((rf: RuleFailureStat) => {
                  const isSelected = selectedRuleFilter === rf.ruleId;
                  return (
                    <button
                      key={rf.ruleId}
                      onClick={() =>
                        setSelectedRuleFilter(isSelected ? null : rf.ruleId)
                      }
                      className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-[#8F2BFF] bg-[#8F2BFF]/20 ring-1 ring-[#8F2BFF]"
                          : rf.severity === "error"
                            ? "border-[#FF453A]/30 bg-[#1A1414] hover:bg-[#221616]"
                            : "border-[#FF9F0A]/30 bg-[#1A1814] hover:bg-[#241F16]"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              rf.severity === "error"
                                ? "bg-[#FF453A]"
                                : "bg-[#FF9F0A]"
                            }`}
                          />
                          <span className="truncate text-xs font-semibold text-white">
                            {rf.ruleName}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-[#888]">
                          Type: {rf.ruleType}
                        </span>
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                          rf.severity === "error"
                            ? "bg-[#FF453A]/20 text-[#FF453A]"
                            : "bg-[#FF9F0A]/20 text-[#FF9F0A]"
                        }`}
                      >
                        {rf.failedCount} rader
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Class distribution visual breakdown */}
          <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <h3 className="mb-3 text-xs font-semibold text-white">
              Klassefordeling i treningskorpuset
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(classDist).map(([cls, count]) => {
                const countNum = Number(count) || 0;
                const percent = (
                  (countNum / (meta?.rowCount || 1)) *
                  100
                ).toFixed(0);
                return (
                  <div key={cls} className="rounded-lg bg-[#1A1A1A] p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-[#E0E0DC] truncate max-w-[130px]">
                        {cls}
                      </span>
                      <span className="font-mono text-xs text-[#B25CFF]">
                        {countNum} ({percent}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#262624]">
                      <div
                        className="h-full bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Records Table with Enhanced Validation Diagnostics */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
            {/* Table Filters Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#666]" />
                  <input
                    type="text"
                    placeholder="Søk i norske eksempler..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] py-1.5 pl-8 pr-3 text-xs text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
                  />
                </div>

                {/* Class selector */}
                <select
                  value={selectedLabel}
                  onChange={(e) => setSelectedLabel(e.target.value)}
                  className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
                >
                  <option value="all">Alle klasser ({records.length})</option>
                  {Object.keys(classDist).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls} ({classDist[cls]})
                    </option>
                  ))}
                </select>

                {/* Status Filter Tabs */}
                <div className="flex rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#171716] p-0.5 text-[11px]">
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      statusFilter === "all"
                        ? "bg-[#8F2BFF] text-white"
                        : "text-[#888] hover:text-[#CCC]"
                    }`}
                  >
                    Alle ({records.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter("errors")}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      statusFilter === "errors"
                        ? "bg-[#FF453A] text-white font-bold"
                        : "text-[#FF453A] hover:bg-[#221616]"
                    }`}
                  >
                    Feil ({invalidCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("warnings")}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      statusFilter === "warnings"
                        ? "bg-[#FF9F0A] text-black font-bold"
                        : "text-[#FF9F0A] hover:bg-[#241F16]"
                    }`}
                  >
                    Advarsler ({warningCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter("valid")}
                    className={`rounded px-2 py-1 font-medium transition-colors ${
                      statusFilter === "valid"
                        ? "bg-[#77F23B] text-black font-bold"
                        : "text-[#77F23B] hover:bg-[#1A2216]"
                    }`}
                  >
                    Gyldige ({validCount})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#A3A3A0]">
                  <input
                    type="checkbox"
                    checked={onlyNorwegianChars}
                    onChange={(e) => setOnlyNorwegianChars(e.target.checked)}
                    className="rounded border-[#333] bg-[#222] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Kun rader med æ, ø, å</span>
                </label>
              </div>
            </div>

            {/* Active Rule Filter Banner */}
            {selectedRuleFilter && (
              <div className="flex items-center justify-between bg-[#8F2BFF]/10 px-4 py-2 text-xs text-[#B25CFF] border-b border-[#8F2BFF]/20">
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5" />
                  <span>
                    Filtrerer på regel:{" "}
                    <strong>
                      {ruleFailures.find((r) => r.ruleId === selectedRuleFilter)
                        ?.ruleName || selectedRuleFilter}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => setSelectedRuleFilter(null)}
                  className="text-xs hover:underline text-white"
                >
                  Vis alle
                </button>
              </div>
            )}

            {/* Table rows */}
            <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="sticky top-0 z-10 border-b border-[rgba(255,255,255,0.06)] bg-[#171716] font-mono text-[11px] text-[#A3A3A0]">
                    <th className="w-8 py-2.5 pl-4 pr-2 font-medium"></th>
                    <th className="w-12 py-2.5 px-2 font-medium">#</th>
                    <th className="py-2.5 px-3 font-medium">
                      Norsk Tekst (Input)
                    </th>
                    <th className="py-2.5 px-3 font-medium">Etikett</th>
                    <th className="py-2.5 px-3 font-medium">
                      Validering & Regler
                    </th>
                    <th className="py-2.5 pr-4 text-right font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)] font-sans">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#888]">
                        Ingen poster matcher de valgte filtrene.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((rec, i) => {
                      const isExpanded =
                        expandedRecordId === (rec.id || String(i));
                      const failures = rec.validationFailures || [];
                      const hasErrors = !rec.isValid;
                      const hasWarnings = failures.some(
                        (f) => f.severity === "warning",
                      );

                      return (
                        <React.Fragment key={rec.id || i}>
                          <tr
                            onClick={() =>
                              setExpandedRecordId(
                                isExpanded ? null : rec.id || String(i),
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              hasErrors
                                ? "bg-[#FF453A]/5 hover:bg-[#FF453A]/10"
                                : hasWarnings
                                  ? "bg-[#FF9F0A]/5 hover:bg-[#FF9F0A]/10"
                                  : "hover:bg-[#1A1A19]"
                            }`}
                          >
                            <td className="py-2.5 pl-3 pr-1 text-[#666]">
                              {failures.length > 0 ? (
                                isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-white" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-[#A3A3A0]" />
                                )
                              ) : null}
                            </td>
                            <td className="py-2.5 px-2 font-mono text-[11px] text-[#666]">
                              {i + 1}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-white max-w-md break-words">
                              {rec.text || (
                                <span className="italic text-[#FF453A]">
                                  [Tom tekst]
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="rounded bg-[#8F2BFF]/15 px-2 py-0.5 font-mono text-[11px] text-[#B25CFF]">
                                {rec.label || "mangler"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {failures.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {failures.map((f, fIdx) => (
                                    <span
                                      key={fIdx}
                                      className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                        f.severity === "error"
                                          ? "bg-[#FF453A]/20 text-[#FF453A]"
                                          : "bg-[#FF9F0A]/20 text-[#FF9F0A]"
                                      }`}
                                      title={f.message}
                                    >
                                      {f.ruleName}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="font-mono text-[10px] text-[#77F23B]">
                                  Alle regler godkjent
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-right">
                              {rec.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#77F23B]">
                                  <CheckCircle2 className="h-3 w-3" /> Gyldig
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-[#FF453A]">
                                  <AlertCircle className="h-3 w-3" /> Feil (
                                  {failures.length})
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded failure detail row */}
                          {isExpanded && failures.length > 0 && (
                            <tr className="bg-[#171414] border-b border-[rgba(255,255,255,0.06)]">
                              <td colSpan={6} className="px-6 py-3">
                                <div className="space-y-2 rounded-lg bg-[#1F1717] p-3 text-xs">
                                  <div className="flex items-center justify-between text-[#A3A3A0] border-b border-[rgba(255,255,255,0.06)] pb-1.5">
                                    <span className="font-bold text-white">
                                      Detaljert Valideringsrapport for Rad #
                                      {i + 1}
                                    </span>
                                    <span className="font-mono text-[10px]">
                                      {rec.norwegianCharCount?.total || 0}{" "}
                                      norske tegn (æ:
                                      {rec.norwegianCharCount?.ae || 0}, ø:
                                      {rec.norwegianCharCount?.oe || 0}, å:
                                      {rec.norwegianCharCount?.aa || 0})
                                    </span>
                                  </div>

                                  <div className="space-y-1.5 pt-1">
                                    {failures.map((f, failIdx) => (
                                      <div
                                        key={failIdx}
                                        className="flex items-start gap-2 text-[11px]"
                                      >
                                        <span
                                          className={`mt-0.5 rounded px-1.5 py-0.2 font-mono text-[10px] uppercase font-bold ${
                                            f.severity === "error"
                                              ? "bg-[#FF453A] text-white"
                                              : "bg-[#FF9F0A] text-black"
                                          }`}
                                        >
                                          {f.severity}
                                        </span>
                                        <div className="flex-1">
                                          <strong className="text-white">
                                            {f.ruleName}:{" "}
                                          </strong>
                                          <span className="text-[#E0E0DC]">
                                            {f.message}
                                          </span>
                                          {f.actualValue && (
                                            <div className="mt-0.5 font-mono text-[10px] text-[#A3A3A0]">
                                              Detektert verdi:{" "}
                                              <span className="text-[#FF9F0A]">
                                                {f.actualValue}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Heuristic Dataset Analysis & Remediation Modal */}
      <DatasetAnalysisModal
        isOpen={isAnalysisModalOpen}
        onClose={() => setIsAnalysisModalOpen(false)}
        datasetMeta={meta}
        records={records}
        projectId={activeProject?.id}
        onDatasetCleaned={(updatedMeta, updatedRecords, removedCount) => {
          setDatasetData({ meta: updatedMeta, records: updatedRecords });
          if (onDatasetUpdated) {
            onDatasetUpdated(updatedMeta);
          }
          setRevalidationNotice(
            `Datasett optimalisert! ${removedCount} overflødige/umerkede rader ble fjernet (${updatedRecords.length} gjenværende rader).`
          );
          setTimeout(() => setRevalidationNotice(null), 6000);
        }}
      />
    </div>
  );
};
