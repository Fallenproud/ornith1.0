import React, { useState, useEffect } from "react";
import {
  Sliders,
  AlertCircle,
  AlertTriangle,
  Hash,
  Languages,
  CheckCircle2,
  Flame,
  Check,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Info,
} from "lucide-react";
import { DatasetValidationRule, ValidationRuleType } from "../../types";

export interface TransactionStatusState {
  status: "idle" | "saving" | "success" | "error";
  message?: string;
  timestamp?: string;
}

interface ThresholdConfigFormProps {
  rules: DatasetValidationRule[];
  projectId: string;
  onUpdateRuleTransactional: (rule: DatasetValidationRule) => Promise<void>;
  onTestRuleInSandbox?: (sampleText: string, ruleName: string) => void;
  transactionStatus: Record<string, TransactionStatusState>;
}

export const ThresholdConfigForm: React.FC<ThresholdConfigFormProps> = ({
  rules,
  projectId,
  onUpdateRuleTransactional,
  onTestRuleInSandbox,
  transactionStatus,
}) => {
  const [activeTab, setActiveTab] = useState<
    "missing_values" | "range_limits" | "norwegian_char_frequency"
  >("missing_values");

  // Local draft states for each threshold rule to allow fluid adjustments before/during save
  const [missingForm, setMissingForm] = useState<{
    targetColumn: string;
    maxMissingPercent: number;
    disallowEmpty: boolean;
    disallowWhitespaceOnly: boolean;
    allowNull: boolean;
    severity: "error" | "warning";
    enabled: boolean;
    customErrorMessage: string;
  }>({
    targetColumn: "text",
    maxMissingPercent: 0,
    disallowEmpty: true,
    disallowWhitespaceOnly: true,
    allowNull: false,
    severity: "error",
    enabled: true,
    customErrorMessage: "Feltet kan ikke være tomt eller mangle verdi.",
  });

  const [rangeForm, setRangeForm] = useState<{
    targetColumn: string;
    minLength: number;
    maxLength: number;
    minWords: number;
    maxWords: number;
    maxTokens: number;
    minValue: string;
    maxValue: string;
    severity: "error" | "warning";
    enabled: boolean;
    customErrorMessage: string;
  }>({
    targetColumn: "text",
    minLength: 3,
    maxLength: 220,
    minWords: 1,
    maxWords: 35,
    maxTokens: 64,
    minValue: "",
    maxValue: "",
    severity: "error",
    enabled: true,
    customErrorMessage:
      "Ytringen overskrider tillatte grenseverdier for lengde, ord eller token-ramme.",
  });

  const [norwegianForm, setNorwegianForm] = useState<{
    targetColumn: string;
    minNorwegianFrequencyPercent: number;
    minNorwegianChars: number;
    requiredNorwegianCharacters: string[];
    dialectTarget: "Bokmål" | "Nynorsk" | "any";
    severity: "error" | "warning";
    enabled: boolean;
    customErrorMessage: string;
  }>({
    targetColumn: "text",
    minNorwegianFrequencyPercent: 1.0,
    minNorwegianChars: 1,
    requiredNorwegianCharacters: ["æ", "ø", "å"],
    dialectTarget: "Bokmål",
    severity: "warning",
    enabled: true,
    customErrorMessage:
      "Teksten oppfyller ikke terskelverdiene for særnorske tegn (æ, ø, å) eller språkform.",
  });

  // Sync draft forms when rules prop updates
  useEffect(() => {
    // Missing values rule
    const missingRule = rules.find(
      (r) => r.type === "missing_values" && (r.params.targetColumn === "text" || !r.params.targetColumn),
    ) || rules.find((r) => r.type === "missing_values");

    if (missingRule) {
      setMissingForm({
        targetColumn: missingRule.params.targetColumn || "text",
        maxMissingPercent: missingRule.params.maxMissingPercent ?? 0,
        disallowEmpty: missingRule.params.disallowEmpty ?? true,
        disallowWhitespaceOnly: missingRule.params.disallowWhitespaceOnly ?? true,
        allowNull: missingRule.params.allowNull ?? false,
        severity: missingRule.severity,
        enabled: missingRule.enabled,
        customErrorMessage:
          missingRule.params.customErrorMessage ||
          "Feltet kan ikke være tomt eller mangle verdi.",
      });
    }

    // Range limits rule
    const rangeRule = rules.find((r) => r.type === "range_limits");
    if (rangeRule) {
      setRangeForm({
        targetColumn: rangeRule.params.targetColumn || "text",
        minLength: rangeRule.params.minLength ?? 3,
        maxLength: rangeRule.params.maxLength ?? 220,
        minWords: rangeRule.params.minWords ?? 1,
        maxWords: rangeRule.params.maxWords ?? 35,
        maxTokens: rangeRule.params.maxTokens ?? 64,
        minValue: rangeRule.params.minValue != null ? String(rangeRule.params.minValue) : "",
        maxValue: rangeRule.params.maxValue != null ? String(rangeRule.params.maxValue) : "",
        severity: rangeRule.severity,
        enabled: rangeRule.enabled,
        customErrorMessage:
          rangeRule.params.customErrorMessage ||
          "Ytringen overskrider tillatte grenseverdier for lengde, ord eller token-ramme.",
      });
    }

    // Norwegian char frequency rule
    const norwegianRule = rules.find((r) => r.type === "norwegian_char_frequency");
    if (norwegianRule) {
      setNorwegianForm({
        targetColumn: norwegianRule.params.targetColumn || "text",
        minNorwegianFrequencyPercent:
          norwegianRule.params.minNorwegianFrequencyPercent ?? 1.0,
        minNorwegianChars: norwegianRule.params.minNorwegianChars ?? 1,
        requiredNorwegianCharacters:
          norwegianRule.params.requiredNorwegianCharacters || ["æ", "ø", "å"],
        dialectTarget:
          (norwegianRule.params.dialectTarget as "Bokmål" | "Nynorsk" | "any") ||
          "Bokmål",
        severity: norwegianRule.severity,
        enabled: norwegianRule.enabled,
        customErrorMessage:
          norwegianRule.params.customErrorMessage ||
          "Teksten oppfyller ikke terskelverdiene for særnorske tegn (æ, ø, å) eller språkform.",
      });
    }
  }, [rules]);

  // Handler to persist missing values rule via runTransaction
  const handleSaveMissingRule = async () => {
    const existingRule =
      rules.find((r) => r.type === "missing_values" && r.params.targetColumn === missingForm.targetColumn) ||
      rules.find((r) => r.type === "missing_values");

    const ruleToSave: DatasetValidationRule = {
      id: existingRule?.id || `rule-missing-values-${Date.now().toString(36)}`,
      name: `Mangler verdier (${missingForm.targetColumn})`,
      description: `Terskel: Maks ${missingForm.maxMissingPercent}% manglende, ${missingForm.disallowEmpty ? "ingen tomme felt" : "tomme tillatt"}, ${missingForm.disallowWhitespaceOnly ? "ikke kun mellomrom" : ""}.`,
      type: "missing_values",
      enabled: missingForm.enabled,
      severity: missingForm.severity,
      params: {
        targetColumn: missingForm.targetColumn,
        maxMissingPercent: missingForm.maxMissingPercent,
        disallowEmpty: missingForm.disallowEmpty,
        disallowWhitespaceOnly: missingForm.disallowWhitespaceOnly,
        allowNull: missingForm.allowNull,
        customErrorMessage: missingForm.customErrorMessage,
      },
    };

    await onUpdateRuleTransactional(ruleToSave);
  };

  // Handler to persist range limits rule via runTransaction
  const handleSaveRangeRule = async () => {
    const existingRule = rules.find((r) => r.type === "range_limits");

    const ruleToSave: DatasetValidationRule = {
      id: existingRule?.id || `rule-range-limits-${Date.now().toString(36)}`,
      name: "Område- og grensebegrensninger",
      description: `Terskel: ${rangeForm.minLength}–${rangeForm.maxLength} tegn, ${rangeForm.minWords}–${rangeForm.maxWords} ord, maks ${rangeForm.maxTokens} tokens.`,
      type: "range_limits",
      enabled: rangeForm.enabled,
      severity: rangeForm.severity,
      params: {
        targetColumn: rangeForm.targetColumn,
        minLength: rangeForm.minLength,
        maxLength: rangeForm.maxLength,
        minWords: rangeForm.minWords,
        maxWords: rangeForm.maxWords,
        maxTokens: rangeForm.maxTokens,
        minValue: rangeForm.minValue !== "" ? parseFloat(rangeForm.minValue) : undefined,
        maxValue: rangeForm.maxValue !== "" ? parseFloat(rangeForm.maxValue) : undefined,
        customErrorMessage: rangeForm.customErrorMessage,
      },
    };

    await onUpdateRuleTransactional(ruleToSave);
  };

  // Handler to persist norwegian char frequency rule via runTransaction
  const handleSaveNorwegianRule = async () => {
    const existingRule = rules.find((r) => r.type === "norwegian_char_frequency");

    const ruleToSave: DatasetValidationRule = {
      id: existingRule?.id || `rule-norwegian-freq-${Date.now().toString(36)}`,
      name: "Norsk tegnfrekvens og særtegn",
      description: `Terskel: Min ${norwegianForm.minNorwegianFrequencyPercent}% frekvens, min ${norwegianForm.minNorwegianChars} av (${norwegianForm.requiredNorwegianCharacters.join(", ")}), mål: ${norwegianForm.dialectTarget}.`,
      type: "norwegian_char_frequency",
      enabled: norwegianForm.enabled,
      severity: norwegianForm.severity,
      params: {
        targetColumn: norwegianForm.targetColumn,
        minNorwegianFrequencyPercent: norwegianForm.minNorwegianFrequencyPercent,
        minNorwegianChars: norwegianForm.minNorwegianChars,
        requiredNorwegianCharacters: norwegianForm.requiredNorwegianCharacters,
        dialectTarget: norwegianForm.dialectTarget,
        customErrorMessage: norwegianForm.customErrorMessage,
      },
    };

    await onUpdateRuleTransactional(ruleToSave);
  };

  // Active status per tab
  const activeTxStatus = transactionStatus[activeTab] || { status: "idle" };

  // Helper to toggle Norwegian characters in selection
  const toggleNorwegianChar = (char: string) => {
    setNorwegianForm((prev) => {
      const exists = prev.requiredNorwegianCharacters.includes(char);
      const nextChars = exists
        ? prev.requiredNorwegianCharacters.filter((c) => c !== char)
        : [...prev.requiredNorwegianCharacters, char];
      return {
        ...prev,
        requiredNorwegianCharacters: nextChars.length > 0 ? nextChars : [char],
      };
    });
  };

  return (
    <div
      id="threshold-config-form"
      className="border-b border-[rgba(255,255,255,0.06)] bg-[#171716] p-4.5"
    >
      {/* Header with status badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-[#8F2BFF]/20 p-2 text-[#B25CFF]">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Terskelverdiskjema & Grenser
              </h3>
              <span className="inline-flex items-center gap-1 rounded bg-[#FF9F0A]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#FF9F0A]">
                <Flame className="h-3 w-3" />
                <span>updateValidationRule</span>
              </span>
            </div>
            <p className="text-[11px] text-[#A3A3A0]">
              Konfigurer terskelverdier for manglende verdier, intervaller og norsk tegnfrekvens.
            </p>
          </div>
        </div>

        {/* Transaction state readout */}
        <div className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1C1C1B] px-3 py-1.5 text-xs">
          {activeTxStatus.status === "saving" ? (
            <div className="flex items-center gap-2 text-[#39D9E6]">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span className="font-medium text-[11px]">Kjører runTransaction()...</span>
            </div>
          ) : activeTxStatus.status === "success" ? (
            <div className="flex items-center gap-1.5 text-[#77F23B]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-medium text-[11px]">
                {activeTxStatus.message || "Lagret i Firestore"}
                {activeTxStatus.timestamp && ` (${activeTxStatus.timestamp})`}
              </span>
            </div>
          ) : activeTxStatus.status === "error" ? (
            <div className="flex items-center gap-1.5 text-[#FF453A]">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="font-medium text-[11px]">
                {activeTxStatus.message || "Feil under transaksjon"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#888]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#8F2BFF]" />
              <span className="text-[11px] font-mono">
                {activeTxStatus.timestamp
                  ? `Sist synkronisert: ${activeTxStatus.timestamp}`
                  : `Klar for prosjekt: ${projectId}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Primary 3-Way Category Tab Switcher */}
      <div className="flex items-center gap-2 mb-4 border-b border-[rgba(255,255,255,0.06)] pb-2.5">
        <button
          type="button"
          onClick={() => setActiveTab("missing_values")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "missing_values"
              ? "bg-[#8F2BFF] text-white shadow-sm shadow-[#8F2BFF]/30"
              : "bg-[#1E1E1D] text-[#A3A3A0] hover:bg-[#262625] hover:text-white"
          }`}
        >
          <AlertCircle className="h-3.5 w-3.5 text-[#FF453A]" />
          <span>1. Manglende verdier</span>
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
              missingForm.enabled
                ? "bg-[#77F23B]/20 text-[#77F23B]"
                : "bg-[#333] text-[#777]"
            }`}
          >
            {missingForm.enabled ? "Aktiv" : "Av"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("range_limits")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "range_limits"
              ? "bg-[#8F2BFF] text-white shadow-sm shadow-[#8F2BFF]/30"
              : "bg-[#1E1E1D] text-[#A3A3A0] hover:bg-[#262625] hover:text-white"
          }`}
        >
          <Hash className="h-3.5 w-3.5 text-[#39D9E6]" />
          <span>2. Range-begrensninger</span>
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
              rangeForm.enabled
                ? "bg-[#77F23B]/20 text-[#77F23B]"
                : "bg-[#333] text-[#777]"
            }`}
          >
            {rangeForm.enabled ? "Aktiv" : "Av"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("norwegian_char_frequency")}
          className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            activeTab === "norwegian_char_frequency"
              ? "bg-[#8F2BFF] text-white shadow-sm shadow-[#8F2BFF]/30"
              : "bg-[#1E1E1D] text-[#A3A3A0] hover:bg-[#262625] hover:text-white"
          }`}
        >
          <Languages className="h-3.5 w-3.5 text-[#77F23B]" />
          <span>3. Norsk tegnfrekvens</span>
          <span
            className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] ${
              norwegianForm.enabled
                ? "bg-[#77F23B]/20 text-[#77F23B]"
                : "bg-[#333] text-[#777]"
            }`}
          >
            {norwegianForm.enabled ? "Aktiv" : "Av"}
          </span>
        </button>
      </div>

      {/* Form Content Area */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        {/* ======================= TAB 1: MISSING VALUES ======================= */}
        {activeTab === "missing_values" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Terskelverdier for manglende & tomme data</span>
                  <span className="rounded bg-[#FF453A]/20 px-2 py-0.5 font-mono text-[10px] text-[#FF453A]">
                    missing_values
                  </span>
                </h4>
                <p className="text-[11px] text-[#A3A3A0]">
                  Styrer toleranse for manglende felt og definerer hva som klassifiseres som ugyldig.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#E0E0DC]">
                  <input
                    type="checkbox"
                    checked={missingForm.enabled}
                    onChange={(e) =>
                      setMissingForm((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Regel aktivert</span>
                </label>

                <div className="flex items-center gap-1 rounded bg-[#1C1C1B] p-0.5 border border-[rgba(255,255,255,0.08)]">
                  <button
                    type="button"
                    onClick={() => setMissingForm((prev) => ({ ...prev, severity: "error" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      missingForm.severity === "error"
                        ? "bg-[#FF453A] text-white"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Feil (Error)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMissingForm((prev) => ({ ...prev, severity: "warning" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      missingForm.severity === "warning"
                        ? "bg-[#FF9F0A] text-black"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Advarsel (Warning)
                  </button>
                </div>
              </div>
            </div>

            {/* Threshold Slider: maxMissingPercent */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Maksimalt tillatt manglende prosentandel (Terskelverdi):
                  </span>
                  <span className="rounded bg-[#8F2BFF]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#B25CFF]">
                    {missingForm.maxMissingPercent}%
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#A3A3A0]">
                  {missingForm.maxMissingPercent === 0
                    ? "0% = 100% fullstendighet påkrevd (Ingen mangler tolereres)"
                    : `Tolererer inntil ${missingForm.maxMissingPercent}% ufullstendige rader`}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={25}
                  step={1}
                  value={missingForm.maxMissingPercent}
                  onChange={(e) =>
                    setMissingForm((prev) => ({
                      ...prev,
                      maxMissingPercent: parseInt(e.target.value, 10),
                    }))
                  }
                  className="h-2 flex-1 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#8F2BFF]"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={missingForm.maxMissingPercent}
                    onChange={(e) =>
                      setMissingForm((prev) => ({
                        ...prev,
                        maxMissingPercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                      }))
                    }
                    className="w-16 rounded bg-[#2A2A28] px-2 py-1 font-mono text-xs text-white border border-[rgba(255,255,255,0.08)] text-right"
                  />
                  <span className="font-mono text-xs text-[#888]">%</span>
                </div>
              </div>
            </div>

            {/* Constraints Checkboxes */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex items-start gap-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3 cursor-pointer hover:bg-[#202020] transition-colors">
                <input
                  type="checkbox"
                  checked={missingForm.disallowEmpty}
                  onChange={(e) =>
                    setMissingForm((prev) => ({
                      ...prev,
                      disallowEmpty: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Forby tomme strenger
                  </span>
                  <span className="text-[10px] text-[#888] block">
                    Avviser rader der feltet er tom streng (<code>""</code>).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3 cursor-pointer hover:bg-[#202020] transition-colors">
                <input
                  type="checkbox"
                  checked={missingForm.disallowWhitespaceOnly}
                  onChange={(e) =>
                    setMissingForm((prev) => ({
                      ...prev,
                      disallowWhitespaceOnly: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Forby kun mellomrom
                  </span>
                  <span className="text-[10px] text-[#888] block">
                    Avviser rader med kun tomrom (<code>"   "</code>).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3 cursor-pointer hover:bg-[#202020] transition-colors">
                <input
                  type="checkbox"
                  checked={missingForm.allowNull}
                  onChange={(e) =>
                    setMissingForm((prev) => ({
                      ...prev,
                      allowNull: e.target.checked,
                    }))
                  }
                  className="mt-0.5 h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Tillat null-verdier
                  </span>
                  <span className="text-[10px] text-[#888] block">
                    {missingForm.allowNull
                      ? "Eksplisitt null godtas som gyldig verdi."
                      : "Eksplisitt null avvises som ugyldig."}
                  </span>
                </div>
              </label>
            </div>

            {/* Target Column & Custom Message */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-[#A3A3A0] block mb-1">
                  Målkolonne for manglende sjekk:
                </label>
                <select
                  value={missingForm.targetColumn}
                  onChange={(e) =>
                    setMissingForm((prev) => ({ ...prev, targetColumn: e.target.value }))
                  }
                  className="w-full rounded-lg bg-[#2A2A28] px-3 py-2 text-xs text-white border border-[rgba(255,255,255,0.08)] focus:border-[#8F2BFF] focus:outline-none"
                >
                  <option value="text">text (Ytring / Treningsdata)</option>
                  <option value="label">label (Klasseetikett)</option>
                  <option value="meta">meta (Metadata)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#A3A3A0] block mb-1">
                  Tilpasset feilmelding:
                </label>
                <input
                  type="text"
                  value={missingForm.customErrorMessage}
                  onChange={(e) =>
                    setMissingForm((prev) => ({
                      ...prev,
                      customErrorMessage: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg bg-[#2A2A28] px-3 py-2 text-xs text-white border border-[rgba(255,255,255,0.08)] focus:border-[#8F2BFF] focus:outline-none"
                  placeholder="F.eks.: Tekstfeltet kan ikke være tomt."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  onTestRuleInSandbox?.(
                    "   ",
                    "Manglende verdier (Tomt/Mellomrom-test)",
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] px-3 py-1.5 text-xs text-[#A3A3A0] hover:bg-[#2A2A28] hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#39D9E6]" />
                <span>Test tom verdi i sandkasse</span>
              </button>

              <button
                type="button"
                onClick={handleSaveMissingRule}
                disabled={activeTxStatus.status === "saving"}
                className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8F2BFF]/30 hover:bg-[#A347FF] transition-all disabled:opacity-50"
              >
                {activeTxStatus.status === "saving" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Oppdaterer via runTransaction()...</span>
                  </>
                ) : (
                  <>
                    <Flame className="h-3.5 w-3.5 text-[#FF9F0A]" />
                    <span>Oppdater regel i Firestore (Transaksjonell)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================= TAB 2: RANGE LIMITS ======================= */}
        {activeTab === "range_limits" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Terskelverdier for tegnlengde, ord og TinyML-tokens</span>
                  <span className="rounded bg-[#39D9E6]/20 px-2 py-0.5 font-mono text-[10px] text-[#39D9E6]">
                    range_limits
                  </span>
                </h4>
                <p className="text-[11px] text-[#A3A3A0]">
                  Sikrer at treningsdata passer innenfor mikrokontrollerens SRAM-buffer og inferensgrenser.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#E0E0DC]">
                  <input
                    type="checkbox"
                    checked={rangeForm.enabled}
                    onChange={(e) =>
                      setRangeForm((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Regel aktivert</span>
                </label>

                <div className="flex items-center gap-1 rounded bg-[#1C1C1B] p-0.5 border border-[rgba(255,255,255,0.08)]">
                  <button
                    type="button"
                    onClick={() => setRangeForm((prev) => ({ ...prev, severity: "error" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      rangeForm.severity === "error"
                        ? "bg-[#FF453A] text-white"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Feil (Error)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRangeForm((prev) => ({ ...prev, severity: "warning" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      rangeForm.severity === "warning"
                        ? "bg-[#FF9F0A] text-black"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Advarsel (Warning)
                  </button>
                </div>
              </div>
            </div>

            {/* Threshold Group 1: Character Length Slider & Inputs */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  Terskel for tegnlengde (Min – Maks tegn):
                </span>
                <span className="font-mono text-xs font-bold text-[#39D9E6]">
                  {rangeForm.minLength} – {rangeForm.maxLength} tegn
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#A3A3A0] mb-1">
                    <span>Minimum tegn:</span>
                    <span className="font-mono font-bold text-white">
                      {rangeForm.minLength}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={50}
                    value={rangeForm.minLength}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        minLength: Math.min(
                          parseInt(e.target.value, 10),
                          prev.maxLength - 1,
                        ),
                      }))
                    }
                    className="w-full h-2 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#39D9E6]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#A3A3A0] mb-1">
                    <span>Maksimum tegn:</span>
                    <span className="font-mono font-bold text-white">
                      {rangeForm.maxLength}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={500}
                    value={rangeForm.maxLength}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        maxLength: Math.max(
                          parseInt(e.target.value, 10),
                          prev.minLength + 1,
                        ),
                      }))
                    }
                    className="w-full h-2 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#39D9E6]"
                  />
                </div>
              </div>
            </div>

            {/* Threshold Group 2: Word Count Slider & Inputs */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  Terskel for ordtelling (Min – Maks ord):
                </span>
                <span className="font-mono text-xs font-bold text-[#77F23B]">
                  {rangeForm.minWords} – {rangeForm.maxWords} ord
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#A3A3A0] mb-1">
                    <span>Minimum ord:</span>
                    <span className="font-mono font-bold text-white">
                      {rangeForm.minWords}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    value={rangeForm.minWords}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        minWords: Math.min(
                          parseInt(e.target.value, 10),
                          prev.maxWords - 1,
                        ),
                      }))
                    }
                    className="w-full h-2 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#77F23B]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] text-[#A3A3A0] mb-1">
                    <span>Maksimum ord:</span>
                    <span className="font-mono font-bold text-white">
                      {rangeForm.maxWords}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    value={rangeForm.maxWords}
                    onChange={(e) =>
                      setRangeForm((prev) => ({
                        ...prev,
                        maxWords: Math.max(
                          parseInt(e.target.value, 10),
                          prev.minWords + 1,
                        ),
                      }))
                    }
                    className="w-full h-2 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#77F23B]"
                  />
                </div>
              </div>
            </div>

            {/* Threshold Group 3: TinyML Max Tokens & Numerical Range */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-white">
                    Maks tokens (TinyML RAM buffer):
                  </span>
                  <span className="font-mono text-xs font-bold text-[#FF9F0A]">
                    {rangeForm.maxTokens} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min={16}
                  max={256}
                  step={8}
                  value={rangeForm.maxTokens}
                  onChange={(e) =>
                    setRangeForm((prev) => ({
                      ...prev,
                      maxTokens: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full h-2 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#FF9F0A]"
                />
                <span className="text-[10px] text-[#888] mt-1 block">
                  Beregningsgrunnlag: ~4 tegn per token. Forhindrer OOM i mikrokontroller.
                </span>
              </div>

              <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
                <span className="text-xs font-semibold text-white block mb-1.5">
                  Numerisk verdiområde (Valgfritt):
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#888] block">Min verdi:</label>
                    <input
                      type="number"
                      value={rangeForm.minValue}
                      onChange={(e) =>
                        setRangeForm((prev) => ({ ...prev, minValue: e.target.value }))
                      }
                      placeholder="Ubegrenset"
                      className="w-full rounded bg-[#2A2A28] px-2 py-1 font-mono text-xs text-white border border-[rgba(255,255,255,0.08)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#888] block">Maks verdi:</label>
                    <input
                      type="number"
                      value={rangeForm.maxValue}
                      onChange={(e) =>
                        setRangeForm((prev) => ({ ...prev, maxValue: e.target.value }))
                      }
                      placeholder="Ubegrenset"
                      className="w-full rounded bg-[#2A2A28] px-2 py-1 font-mono text-xs text-white border border-[rgba(255,255,255,0.08)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Error Message */}
            <div>
              <label className="text-[11px] font-semibold text-[#A3A3A0] block mb-1">
                Tilpasset feilmelding ved brudd på grenseverdier:
              </label>
              <input
                type="text"
                value={rangeForm.customErrorMessage}
                onChange={(e) =>
                  setRangeForm((prev) => ({
                    ...prev,
                    customErrorMessage: e.target.value,
                  }))
                }
                className="w-full rounded-lg bg-[#2A2A28] px-3 py-2 text-xs text-white border border-[rgba(255,255,255,0.08)] focus:border-[#8F2BFF] focus:outline-none"
                placeholder="F.eks.: Ytringen overskrider tillatt tegnlengde."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  onTestRuleInSandbox?.(
                    "Dette er en altfor lang setning som bevisst overskrider grensen for maksimalt antall ord og tegn for å validere at TinyML mikrokontroller-filteret avviser sekvensen.",
                    "Grenser (Lengde-test)",
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] px-3 py-1.5 text-xs text-[#A3A3A0] hover:bg-[#2A2A28] hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#39D9E6]" />
                <span>Test overskridelse i sandkasse</span>
              </button>

              <button
                type="button"
                onClick={handleSaveRangeRule}
                disabled={activeTxStatus.status === "saving"}
                className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8F2BFF]/30 hover:bg-[#A347FF] transition-all disabled:opacity-50"
              >
                {activeTxStatus.status === "saving" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Oppdaterer via runTransaction()...</span>
                  </>
                ) : (
                  <>
                    <Flame className="h-3.5 w-3.5 text-[#FF9F0A]" />
                    <span>Oppdater regel i Firestore (Transaksjonell)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: NORWEGIAN CHAR FREQUENCY ======================= */}
        {activeTab === "norwegian_char_frequency" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.04)] pb-3">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Terskelverdier for norsk tegnfrekvens & autentisitet</span>
                  <span className="rounded bg-[#77F23B]/20 px-2 py-0.5 font-mono text-[10px] text-[#77F23B]">
                    norwegian_char_frequency
                  </span>
                </h4>
                <p className="text-[11px] text-[#A3A3A0]">
                  Overvåker og krever forekomst av særnorske tegn (æ, ø, å) for å sikre ekte norsk språktilpasning.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#E0E0DC]">
                  <input
                    type="checkbox"
                    checked={norwegianForm.enabled}
                    onChange={(e) =>
                      setNorwegianForm((prev) => ({ ...prev, enabled: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Regel aktivert</span>
                </label>

                <div className="flex items-center gap-1 rounded bg-[#1C1C1B] p-0.5 border border-[rgba(255,255,255,0.08)]">
                  <button
                    type="button"
                    onClick={() => setNorwegianForm((prev) => ({ ...prev, severity: "error" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      norwegianForm.severity === "error"
                        ? "bg-[#FF453A] text-white"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Feil (Error)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNorwegianForm((prev) => ({ ...prev, severity: "warning" }))}
                    className={`px-2 py-1 text-[10px] font-bold rounded ${
                      norwegianForm.severity === "warning"
                        ? "bg-[#FF9F0A] text-black"
                        : "text-[#888] hover:text-white"
                    }`}
                  >
                    Advarsel (Warning)
                  </button>
                </div>
              </div>
            </div>

            {/* Threshold Slider: Frequency Percentage */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white">
                    Minimum frekvens av æ, ø, å i teksten (Terskelverdi):
                  </span>
                  <span className="rounded bg-[#77F23B]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#77F23B]">
                    {norwegianForm.minNorwegianFrequencyPercent.toFixed(1)}%
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#A3A3A0]">
                  Formel: (antall æ + ø + å) / tegnlengde
                </span>
              </div>

              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0.2}
                  max={15.0}
                  step={0.2}
                  value={norwegianForm.minNorwegianFrequencyPercent}
                  onChange={(e) =>
                    setNorwegianForm((prev) => ({
                      ...prev,
                      minNorwegianFrequencyPercent: parseFloat(e.target.value),
                    }))
                  }
                  className="h-2 flex-1 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#77F23B]"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={0.1}
                    value={norwegianForm.minNorwegianFrequencyPercent}
                    onChange={(e) =>
                      setNorwegianForm((prev) => ({
                        ...prev,
                        minNorwegianFrequencyPercent: Math.max(
                          0,
                          parseFloat(e.target.value) || 0,
                        ),
                      }))
                    }
                    className="w-16 rounded bg-[#2A2A28] px-2 py-1 font-mono text-xs text-white border border-[rgba(255,255,255,0.08)] text-right"
                  />
                  <span className="font-mono text-xs text-[#888]">%</span>
                </div>
              </div>
            </div>

            {/* Threshold 2: Minimum Norwegian Chars Stepper */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">
                  Minimum antall særnorske tegn per ytring:
                </span>
                <span className="font-mono text-xs font-bold text-[#B25CFF]">
                  {norwegianForm.minNorwegianChars} tegn
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={norwegianForm.minNorwegianChars}
                  onChange={(e) =>
                    setNorwegianForm((prev) => ({
                      ...prev,
                      minNorwegianChars: parseInt(e.target.value, 10),
                    }))
                  }
                  className="h-2 flex-1 cursor-pointer rounded-lg bg-[#2A2A28] accent-[#B25CFF]"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={norwegianForm.minNorwegianChars}
                    onChange={(e) =>
                      setNorwegianForm((prev) => ({
                        ...prev,
                        minNorwegianChars: Math.max(1, parseInt(e.target.value, 10) || 1),
                      }))
                    }
                    className="w-16 rounded bg-[#2A2A28] px-2 py-1 font-mono text-xs text-white border border-[rgba(255,255,255,0.08)] text-right"
                  />
                  <span className="font-mono text-xs text-[#888]">stk</span>
                </div>
              </div>
            </div>

            {/* Required Character Selection (Interactive Chips) */}
            <div className="rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#1A1A1A] p-3">
              <span className="text-xs font-semibold text-white block mb-2">
                Påkrevde særnorske tegn (Klikk for å aktivere/deaktivere):
              </span>
              <div className="flex flex-wrap gap-2">
                {["æ", "ø", "å", "Æ", "Ø", "Å"].map((char) => {
                  const isSelected = norwegianForm.requiredNorwegianCharacters.includes(char);
                  return (
                    <button
                      key={char}
                      type="button"
                      onClick={() => toggleNorwegianChar(char)}
                      className={`flex h-9 w-12 items-center justify-center rounded-lg font-mono text-sm font-bold transition-all ${
                        isSelected
                          ? "bg-[#77F23B] text-black shadow-md shadow-[#77F23B]/30 ring-1 ring-[#77F23B]"
                          : "border border-[rgba(255,255,255,0.08)] bg-[#262624] text-[#A3A3A0] hover:bg-[#333] hover:text-white"
                      }`}
                    >
                      {char}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-[#888] mt-2 block">
                Valgte tegn: [
                {norwegianForm.requiredNorwegianCharacters.join(", ")}
                ]. Ytringer må inneholde minst {norwegianForm.minNorwegianChars} av disse.
              </span>
            </div>

            {/* Dialect / Language Form Target */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-[#A3A3A0] block mb-1">
                  Målspråkform / Dialekt:
                </label>
                <select
                  value={norwegianForm.dialectTarget}
                  onChange={(e) =>
                    setNorwegianForm((prev) => ({
                      ...prev,
                      dialectTarget: e.target.value as "Bokmål" | "Nynorsk" | "any",
                    }))
                  }
                  className="w-full rounded-lg bg-[#2A2A28] px-3 py-2 text-xs text-white border border-[rgba(255,255,255,0.08)] focus:border-[#8F2BFF] focus:outline-none"
                >
                  <option value="Bokmål">Bokmål (Flagger nynorske særord)</option>
                  <option value="Nynorsk">Nynorsk (Flagger bokmåls-spesifikke ord)</option>
                  <option value="any">Begge tillatt (Ingen formblandingssjekk)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#A3A3A0] block mb-1">
                  Tilpasset feilmelding:
                </label>
                <input
                  type="text"
                  value={norwegianForm.customErrorMessage}
                  onChange={(e) =>
                    setNorwegianForm((prev) => ({
                      ...prev,
                      customErrorMessage: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg bg-[#2A2A28] px-3 py-2 text-xs text-white border border-[rgba(255,255,255,0.08)] focus:border-[#8F2BFF] focus:outline-none"
                  placeholder="F.eks.: Teksten mangler særnorske tegn."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  onTestRuleInSandbox?.(
                    "Turn on the lights in the garage",
                    "Norsk frekvens (Engelsk tekst uten æ, ø, å)",
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] px-3 py-1.5 text-xs text-[#A3A3A0] hover:bg-[#2A2A28] hover:text-white transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#39D9E6]" />
                <span>Test utenlandsk tekst i sandkasse</span>
              </button>

              <button
                type="button"
                onClick={handleSaveNorwegianRule}
                disabled={activeTxStatus.status === "saving"}
                className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#8F2BFF]/30 hover:bg-[#A347FF] transition-all disabled:opacity-50"
              >
                {activeTxStatus.status === "saving" ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Oppdaterer via runTransaction()...</span>
                  </>
                ) : (
                  <>
                    <Flame className="h-3.5 w-3.5 text-[#FF9F0A]" />
                    <span>Oppdater regel i Firestore (Transaksjonell)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
