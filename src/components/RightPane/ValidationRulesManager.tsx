/**
 * ULTIMATE ORNITH 1.0 — Validation Rules Manager & Interactive Sandbox
 * 
 * Allows users to inspect, configure, add, edit, test, and persist custom
 * validation rules for column types, missing values, range bounds, and authentic
 * Norwegian language characteristics.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Play,
  RotateCcw,
  Check,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Sliders,
  Type,
  FileCheck,
  Save,
} from 'lucide-react';
import {
  DatasetValidationRule,
  ProjectMetadata,
  ProjectValidationConfig,
  ValidationRuleType,
  ValidationErrorDetail,
} from '../../types';
import {
  DEFAULT_NORWEGIAN_VALIDATION_RULES,
  getRuleTypeMeta,
} from '../../lib/validation';
import { API } from '../../lib/api';

interface ValidationRulesManagerProps {
  activeProject: ProjectMetadata | null;
  onProjectUpdated?: (updated: ProjectMetadata) => void;
  onApplyRulesToActiveDataset?: (rules: DatasetValidationRule[]) => void;
  onClose?: () => void;
}

export const ValidationRulesManager: React.FC<ValidationRulesManagerProps> = ({
  activeProject,
  onProjectUpdated,
  onApplyRulesToActiveDataset,
  onClose,
}) => {
  const [rules, setRules] = useState<DatasetValidationRule[]>(
    activeProject?.validationConfig?.rules || DEFAULT_NORWEGIAN_VALIDATION_RULES
  );
  const [strictMode, setStrictMode] = useState<boolean>(
    activeProject?.validationConfig?.strictMode || false
  );
  const [autoCleanWhitespace, setAutoCleanWhitespace] = useState<boolean>(
    activeProject?.validationConfig?.autoCleanWhitespace !== false
  );

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingRule, setEditingRule] = useState<DatasetValidationRule | null>(null);
  const [isNewRule, setIsNewRule] = useState(false);

  // Sandbox testing state
  const [sandboxText, setSandboxText] = useState('Skru av lyset i garasjen før du går ut');
  const [sandboxLabel, setSandboxLabel] = useState('lys_kontroll');
  const [selectedRuleToTest, setSelectedRuleToTest] = useState<DatasetValidationRule | null>(null);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    passed: boolean;
    hasWarnings: boolean;
    errors: string[];
    failures: ValidationErrorDetail[];
    norwegianCharCount?: { ae: number; oe: number; aa: number; total: number };
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Sync if activeProject updates
  useEffect(() => {
    if (activeProject?.validationConfig?.rules) {
      setRules(activeProject.validationConfig.rules);
      setStrictMode(!!activeProject.validationConfig.strictMode);
      setAutoCleanWhitespace(activeProject.validationConfig.autoCleanWhitespace !== false);
    }
  }, [activeProject?.id]);

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleToggleSeverity = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === ruleId
          ? { ...r, severity: r.severity === 'error' ? 'warning' : 'error' }
          : r
      )
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleResetDefaults = () => {
    if (window.confirm('Vil du tilbakestille alle valideringsregler til standard norske TinyML-regler?')) {
      setRules(DEFAULT_NORWEGIAN_VALIDATION_RULES);
      setStrictMode(false);
      setAutoCleanWhitespace(true);
    }
  };

  const handleSaveToProject = async () => {
    if (!activeProject) return;
    setIsSaving(true);
    try {
      const res = await API.updateProjectValidationRules(activeProject.id, {
        rules,
        strictMode,
        autoCleanWhitespace,
      });
      if (onProjectUpdated && res.project) {
        onProjectUpdated(res.project);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);

      // Re-apply immediately if requested
      if (onApplyRulesToActiveDataset) {
        onApplyRulesToActiveDataset(rules);
      }
    } catch (e) {
      console.error('Failed to save validation rules to project', e);
      alert('Kunne ikke lagre regler til prosjektkonfigurasjonen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSandboxTest = async (rule?: DatasetValidationRule) => {
    const targetRule = rule || selectedRuleToTest || rules[0];
    if (!targetRule) return;

    setIsTesting(true);
    try {
      const res = await API.testValidationRule({
        rule: targetRule,
        sampleText: sandboxText,
        sampleLabel: sandboxLabel,
      });
      setTestResult({
        tested: true,
        passed: res.passed,
        hasWarnings: res.hasWarnings,
        errors: res.errors,
        failures: res.failures,
        norwegianCharCount: res.norwegianCharCount,
      });
    } catch (e) {
      console.error('Failed to test rule', e);
    } finally {
      setIsTesting(false);
    }
  };

  const openNewRuleModal = () => {
    const newRule: DatasetValidationRule = {
      id: `custom-rule-${Date.now().toString(36)}`,
      name: 'Egendefinert regel',
      description: 'Brukerdefinert valideringsregel for TinyML.',
      type: 'text_length',
      enabled: true,
      severity: 'error',
      params: {
        targetColumn: 'text',
        minLength: 3,
        maxLength: 180,
        customErrorMessage: 'Teksten oppfyller ikke den egendefinerte lengderegelen.',
      },
    };
    setEditingRule(newRule);
    setIsNewRule(true);
  };

  const handleSaveEditedRule = (rule: DatasetValidationRule) => {
    if (isNewRule) {
      setRules((prev) => [...prev, rule]);
    } else {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)));
    }
    setEditingRule(null);
    setIsNewRule(false);
  };

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const filteredRules = rules.filter((rule) => {
    if (categoryFilter === 'all') return true;
    const meta = getRuleTypeMeta(rule.type);
    return meta.category.toLowerCase().includes(categoryFilter.toLowerCase());
  });

  return (
    <div className="flex h-full flex-col bg-[#121212] text-[#F4F4F2]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] bg-[#171716] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#8F2BFF]/20 p-2 text-[#B25CFF]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Datasett Valideringsregler
            </h2>
            <p className="text-[11px] text-[#A3A3A0]">
              Prosjekt: <span className="font-semibold text-white">{activeProject?.name || 'Standard'}</span> •{' '}
              <span className="text-[#77F23B]">{activeRulesCount} aktive regler</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetDefaults}
            title="Gjenopprett anbefalte norske standardregler"
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-3 py-1.5 text-xs text-[#A3A3A0] transition-colors hover:bg-[#222] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Standard</span>
          </button>

          <button
            onClick={openNewRuleModal}
            className="flex items-center gap-1.5 rounded-lg border border-[#39D9E6]/30 bg-[#39D9E6]/10 px-3 py-1.5 text-xs font-medium text-[#39D9E6] transition-colors hover:bg-[#39D9E6]/20"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Ny regel</span>
          </button>

          <button
            onClick={handleSaveToProject}
            disabled={isSaving}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              saveSuccess
                ? 'bg-[#77F23B] text-black shadow-md shadow-[#77F23B]/20'
                : 'bg-[#8F2BFF] text-white shadow-md shadow-[#8F2BFF]/20 hover:bg-[#A347FF]'
            } disabled:opacity-50`}
          >
            {saveSuccess ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Lagret til prosjekt!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Lagrer...' : 'Lagre konfigurasjon'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Flags Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] bg-[#141414] px-6 py-2.5 text-xs">
        <div className="flex items-center gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-[#A3A3A0] hover:text-white">
            <input
              type="checkbox"
              checked={strictMode}
              onChange={(e) => setStrictMode(e.target.checked)}
              className="rounded border-[#333] bg-[#222] text-[#8F2BFF] focus:ring-0"
            />
            <span>Streng modus (Advarsler avviser også rader)</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-[#A3A3A0] hover:text-white">
            <input
              type="checkbox"
              checked={autoCleanWhitespace}
              onChange={(e) => setAutoCleanWhitespace(e.target.checked)}
              className="rounded border-[#333] bg-[#222] text-[#8F2BFF] focus:ring-0"
            />
            <span>Automatisk rensing av ledende/avsluttende mellomrom</span>
          </label>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1">
          {['all', 'Norsk NLP', 'Grenser', 'Struktur', 'Skjema'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#8F2BFF] text-white'
                  : 'bg-[#1F1F1E] text-[#888] hover:text-[#CCC]'
              }`}
            >
              {cat === 'all' ? 'Alle regler' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area: Two-column layout (Rules list on left, Live Sandbox on right) */}
      <div className="grid flex-1 grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-12">
        {/* Rules List (Left 7 Cols) */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] lg:col-span-7">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-semibold text-white">
            <span>Konfigurerte Regler ({filteredRules.length})</span>
            <span className="text-[11px] font-normal text-[#A3A3A0]">
              Klikk feil/advarsel for å veksle alvorlighetsgrad
            </span>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto p-4 custom-scrollbar">
            {filteredRules.map((rule) => {
              const meta = getRuleTypeMeta(rule.type);
              return (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-3.5 transition-all ${
                    rule.enabled
                      ? 'border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] shadow-sm'
                      : 'border-[rgba(255,255,255,0.03)] bg-[#141414]/60 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="mt-1 h-4 w-4 rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
                        title={rule.enabled ? 'Deaktiver regel' : 'Aktiver regel'}
                      />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-bold text-white">{rule.name}</h4>
                          <span className="rounded bg-[#222] px-1.5 py-0.5 font-mono text-[10px] text-[#A3A3A0]">
                            {meta.category}
                          </span>
                          <span className="font-mono text-[10px] text-[#39D9E6]">
                            Kolonne: {rule.params.targetColumn || 'text'}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#888]">{rule.description}</p>
                      </div>
                    </div>

                    {/* Actions & Severity toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleSeverity(rule.id)}
                        title="Klikk for å endre alvorlighetsgrad mellom Feil og Advarsel"
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-all ${
                          rule.severity === 'error'
                            ? 'border border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]'
                            : 'border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-[#FF9F0A]'
                        }`}
                      >
                        {rule.severity === 'error' ? 'Feil (Error)' : 'Advarsel (Warn)'}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRuleToTest(rule);
                          handleRunSandboxTest(rule);
                        }}
                        title="Test denne regelen i sandkassen"
                        className="rounded p-1 text-[#A3A3A0] hover:bg-[#262624] hover:text-[#39D9E6]"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setEditingRule(rule);
                          setIsNewRule(false);
                        }}
                        title="Rediger regel"
                        className="rounded p-1 text-[#A3A3A0] hover:bg-[#262624] hover:text-white"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        title="Fjern regel"
                        className="rounded p-1 text-[#A3A3A0] hover:bg-[#262624] hover:text-[#FF453A]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Rule Parameters Summary */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[rgba(255,255,255,0.04)] pt-2 text-[11px] text-[#A3A3A0]">
                    {rule.type === 'text_length' && (
                      <span className="font-mono text-[#E0E0DC]">
                        Lengdegrense: {rule.params.minLength || 1} – {rule.params.maxLength || 250} tegn
                      </span>
                    )}
                    {rule.type === 'word_count' && (
                      <span className="font-mono text-[#E0E0DC]">
                        Ordtelling: {rule.params.minWords || 1} – {rule.params.maxWords || 50} ord
                      </span>
                    )}
                    {rule.type === 'norwegian_dialect' && (
                      <span className="font-mono text-[#77F23B]">
                        Forventet språkform: {rule.params.dialectTarget || 'Bokmål'}
                      </span>
                    )}
                    {rule.type === 'ban_mojibake' && (
                      <span className="font-mono text-[#FF453A]">
                        Filter: Ã¦, Ã¸, Ã¥, Â og UTF-8 feilkoding
                      </span>
                    )}
                    {rule.type === 'norwegian_char_presence' && (
                      <span className="font-mono text-[#B25CFF]">
                        Minst {rule.params.minNorwegianChars || 1} av tegnene (æ, ø, å)
                      </span>
                    )}
                    {rule.type === 'column_type' && (
                      <span className="font-mono text-[#39D9E6]">
                        Forventer type: {rule.params.expectedType || 'string'}
                      </span>
                    )}
                    {rule.type === 'missing_values' && (
                      <span className="font-mono text-[#A3A3A0]">
                        Forbyr tom streng og tomrom
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Interactive Sandbox (Right 5 Cols) */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-semibold text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#77F23B]" />
              <span>Interaktiv Regelsandkasse</span>
            </div>
            <span className="font-mono text-[10px] text-[#A3A3A0]">Live Evaluering</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar text-xs">
            {/* Rule Selector */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A0]">
                Velg regel som skal testes
              </label>
              <select
                value={selectedRuleToTest?.id || rules[0]?.id || ''}
                onChange={(e) => {
                  const r = rules.find((item) => item.id === e.target.value);
                  if (r) setSelectedRuleToTest(r);
                }}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2 text-xs text-white focus:outline-none"
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.severity})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Sample Presets */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A0]">
                Hurtigeksempler for testing:
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {[
                  { label: 'Gyldig Bokmål', text: 'Skru på varmekablene på badet', l: 'varme_på' },
                  { label: 'Med Mojibake', text: 'SlÃ¥ pÃ¥ lyset i stua nÃ¥', l: 'lys_på' },
                  { label: 'Nynorsk form', text: 'Kva gjer du heime i dag?', l: 'spørsmål' },
                  { label: 'For lang ytring', text: 'Dette er en altfor lang setning ment for testing av mikrokontroller-bufferen som overskrider maksimale antall tegn for SRAM-minne og dermed skal flagges av valideringsregelen umiddelbart.', l: 'test' },
                  { label: 'Uten æ, ø, å', text: 'Turn off the lights please', l: 'lys_av' },
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSandboxText(sample.text);
                      setSandboxLabel(sample.l);
                    }}
                    className="rounded bg-[#20201F] px-2 py-1 text-[10px] text-[#B25CFF] hover:bg-[#2A2A28] hover:text-white"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Text Area */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A0]">
                Testsetning (text)
              </label>
              <textarea
                rows={3}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 font-mono text-xs text-white focus:border-[#8F2BFF] focus:outline-none"
                placeholder="Skriv inn en setning..."
              />
            </div>

            {/* Input Label Field */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A0]">
                Etikett / Klasse (label)
              </label>
              <input
                type="text"
                value={sandboxLabel}
                onChange={(e) => setSandboxLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2 font-mono text-xs text-white focus:outline-none"
              />
            </div>

            <button
              onClick={() => handleRunSandboxTest()}
              disabled={isTesting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#39D9E6] py-2 text-xs font-bold text-black shadow-md shadow-[#39D9E6]/20 transition-all hover:bg-[#5CE5EE] disabled:opacity-50"
            >
              <Play className="h-4 w-4 fill-current" />
              <span>{isTesting ? 'Validerer i sandkasse...' : 'Kjør Valideringstest'}</span>
            </button>

            {/* Test Result Display */}
            {testResult && (
              <div
                className={`rounded-xl border p-4 ${
                  testResult.passed
                    ? 'border-[#77F23B]/30 bg-[#77F23B]/10 text-white'
                    : testResult.hasWarnings
                    ? 'border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-white'
                    : 'border-[#FF453A]/30 bg-[#FF453A]/10 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {testResult.passed ? (
                      <Check className="h-4 w-4 text-[#77F23B]" />
                    ) : testResult.hasWarnings ? (
                      <AlertTriangle className="h-4 w-4 text-[#FF9F0A]" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-[#FF453A]" />
                    )}
                    <span className="font-bold text-xs">
                      {testResult.passed
                        ? 'Testen BESTÅTT — Ingen feil'
                        : testResult.hasWarnings
                        ? 'ADVARSEL — Regelen slo ut med varsel'
                        : 'AVVIST — Kritisk valideringsfeil'}
                    </span>
                  </div>
                  {testResult.norwegianCharCount && (
                    <span className="font-mono text-[10px] text-[#A3A3A0]">
                      æ:{testResult.norwegianCharCount.ae} ø:{testResult.norwegianCharCount.oe} å:
                      {testResult.norwegianCharCount.aa}
                    </span>
                  )}
                </div>

                {testResult.failures && testResult.failures.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-[rgba(255,255,255,0.08)] pt-2.5">
                    {testResult.failures.map((f, i) => (
                      <div key={i} className="text-[11px] flex items-start gap-1.5">
                        <span className="font-mono text-[#FF9F0A]">•</span>
                        <div>
                          <strong className="text-white">{f.ruleName}:</strong>{' '}
                          <span className="text-[#E0E0DC]">{f.message}</span>
                          {f.actualValue && (
                            <span className="ml-1 rounded bg-black/40 px-1 font-mono text-[10px] text-[#FF453A]">
                              Detektert: {f.actualValue}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Rule Modal */}
      {editingRule && (
        <RuleEditorModal
          rule={editingRule}
          isNew={isNewRule}
          onClose={() => setEditingRule(null)}
          onSave={handleSaveEditedRule}
        />
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Subcomponent: Add / Edit Rule Modal
// -------------------------------------------------------------
interface RuleEditorModalProps {
  rule: DatasetValidationRule;
  isNew: boolean;
  onClose: () => void;
  onSave: (rule: DatasetValidationRule) => void;
}

const RuleEditorModal: React.FC<RuleEditorModalProps> = ({
  rule,
  isNew,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<DatasetValidationRule>({ ...rule });

  const handleTypeChange = (newType: ValidationRuleType) => {
    const meta = getRuleTypeMeta(newType);
    setFormData((prev) => ({
      ...prev,
      type: newType,
      name: prev.name || meta.title,
      description: meta.description,
      severity: meta.defaultSeverity,
      params: {
        ...prev.params,
        customErrorMessage: `Feilet validering: ${meta.title}`,
      },
    }));
  };

  const handleParamChange = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      params: {
        ...prev.params,
        [key]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#171716] p-6 shadow-2xl text-xs text-[#F4F4F2]">
        <div className="mb-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
          <h3 className="text-sm font-bold text-white">
            {isNew ? 'Definer ny valideringsregel' : 'Rediger valideringsregel'}
          </h3>
          <button onClick={onClose} className="text-[#888] hover:text-white">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-3.5"
        >
          {/* Rule Name */}
          <div>
            <label className="block font-medium text-[#E0E0DC]">Regelnavn</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>

          {/* Rule Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#E0E0DC]">Regeltype</label>
              <select
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value as ValidationRuleType)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="missing_values">Mangler verdier / Tomme felt</option>
                <option value="column_type">Kolonnetype-sjekk</option>
                <option value="text_length">Lengdebegrensning (Tegn)</option>
                <option value="word_count">Ordtellingsgrenser (Ord)</option>
                <option value="ban_mojibake">Deteksjon av Mojibake / Feilkoding</option>
                <option value="norwegian_char_presence">Norske tegn (æ, ø, å)</option>
                <option value="norwegian_dialect">Dialekt- og språkformskonsistens</option>
                <option value="unique_text">Duplikatsjekk</option>
                <option value="label_whitelist">Klasse-hvitliste</option>
                <option value="regex_match">Regulært uttrykk (Regex)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#E0E0DC]">Målkolonne</label>
              <select
                value={formData.params.targetColumn || 'text'}
                onChange={(e) => handleParamChange('targetColumn', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="text">text (Ytring/Input)</option>
                <option value="label">label (Etikett/Klasse)</option>
              </select>
            </div>
          </div>

          {/* Dynamic Parameters according to rule type */}
          {formData.type === 'text_length' && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#141414] p-3">
              <div>
                <label className="block text-[11px] text-[#A3A3A0]">Minimum tegn</label>
                <input
                  type="number"
                  min={1}
                  value={formData.params.minLength ?? 3}
                  onChange={(e) => handleParamChange('minLength', parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#A3A3A0]">Maksimum tegn</label>
                <input
                  type="number"
                  min={2}
                  value={formData.params.maxLength ?? 220}
                  onChange={(e) => handleParamChange('maxLength', parseInt(e.target.value) || 200)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                />
              </div>
            </div>
          )}

          {formData.type === 'word_count' && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-[#141414] p-3">
              <div>
                <label className="block text-[11px] text-[#A3A3A0]">Minimum ord</label>
                <input
                  type="number"
                  min={1}
                  value={formData.params.minWords ?? 1}
                  onChange={(e) => handleParamChange('minWords', parseInt(e.target.value) || 1)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#A3A3A0]">Maksimum ord</label>
                <input
                  type="number"
                  min={1}
                  value={formData.params.maxWords ?? 35}
                  onChange={(e) => handleParamChange('maxWords', parseInt(e.target.value) || 35)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                />
              </div>
            </div>
          )}

          {formData.type === 'norwegian_dialect' && (
            <div className="rounded-lg bg-[#141414] p-3">
              <label className="block text-[11px] text-[#A3A3A0]">Forventet språkform</label>
              <select
                value={formData.params.dialectTarget || 'Bokmål'}
                onChange={(e) => handleParamChange('dialectTarget', e.target.value)}
                className="mt-1 w-full rounded bg-[#222] p-2 text-white"
              >
                <option value="Bokmål">Bokmål (flagger nynorske særord som 'ikkje', 'eg', 'korleis')</option>
                <option value="Nynorsk">Nynorsk (flagger bokmålsord som 'ikke', 'jeg', 'hvordan')</option>
              </select>
            </div>
          )}

          {formData.type === 'norwegian_char_presence' && (
            <div className="rounded-lg bg-[#141414] p-3">
              <label className="block text-[11px] text-[#A3A3A0]">Minst antall særnorske tegn (æ, ø, å)</label>
              <input
                type="number"
                min={1}
                value={formData.params.minNorwegianChars ?? 1}
                onChange={(e) => handleParamChange('minNorwegianChars', parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded bg-[#222] p-2 font-mono text-white"
              />
            </div>
          )}

          {/* Severity & Error Message */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#E0E0DC]">Alvorlighetsgrad</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="error">Feil (Gjør raden ugyldig)</option>
                <option value="warning">Advarsel (Flagges med gul varsel)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#E0E0DC]">Tilstand</label>
              <select
                value={formData.enabled ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.value === 'true' })}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="true">Aktivert</option>
                <option value="false">Deaktivert</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-[#E0E0DC]">Brukertilpasset feilmelding</label>
            <input
              type="text"
              value={formData.params.customErrorMessage || ''}
              onChange={(e) => handleParamChange('customErrorMessage', e.target.value)}
              placeholder="f.eks. Ytringen overskrider maksimal lengde for mikrokontroller."
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white placeholder-[#555] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[rgba(255,255,255,0.06)]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 text-xs text-[#A3A3A0] hover:text-white"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8F2BFF]/20 hover:bg-[#A347FF]"
            >
              Lagre regel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
