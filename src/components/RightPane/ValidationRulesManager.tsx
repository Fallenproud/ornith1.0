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
  Flame,
  CloudCheck,
  Info,
  Hash,
  Languages,
  CheckCircle2,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  saveProjectValidationRulesTransactional,
  updateValidationRule,
} from '../../lib/firebase';
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
  const [firestoreSavedTime, setFirestoreSavedTime] = useState<string | null>(
    activeProject?.validationConfig?.lastSavedToFirestore || null
  );
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
      if (activeProject.validationConfig.lastSavedToFirestore) {
        setFirestoreSavedTime(activeProject.validationConfig.lastSavedToFirestore);
      }
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
    const nowIso = new Date().toISOString();

    try {
      // 1. Persist directly to Firestore Database via concurrency-safe atomic transaction
      try {
        const savedConfig = await saveProjectValidationRulesTransactional(activeProject.id, {
          rules,
          strictMode,
          autoCleanWhitespace,
        });
        console.log(`[Firestore] Valideringsregler lagret i prosjekt ${activeProject.id}`);
        setFirestoreSavedTime(savedConfig.lastSavedToFirestore || nowIso);
      } catch (firestoreErr) {
        console.warn('[Firestore] Direkte Firestore-skriving ga feil (fortsetter via API):', firestoreErr);
      }

      // 2. Persist via backend API for local server synchronization
      const res = await API.updateProjectValidationRules(activeProject.id, {
        rules,
        strictMode,
        autoCleanWhitespace,
      });

      if (onProjectUpdated && res.project) {
        onProjectUpdated({
          ...res.project,
          validationConfig: {
            ...res.project.validationConfig,
            rules,
            strictMode,
            autoCleanWhitespace,
            lastSavedToFirestore: nowIso,
          },
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // 3. Re-apply immediately to active dataset
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
      type: 'range_limits',
      enabled: true,
      severity: 'error',
      params: {
        targetColumn: 'text',
        minLength: 3,
        maxLength: 200,
        minWords: 1,
        maxWords: 35,
        customErrorMessage: 'Teksten oppfyller ikke den egendefinerte grensen.',
      },
    };
    setEditingRule(newRule);
    setIsNewRule(true);
  };

  const handleSaveEditedRule = async (rule: DatasetValidationRule) => {
    let updatedRules: DatasetValidationRule[];
    if (isNewRule) {
      updatedRules = [...rules, rule];
    } else {
      updatedRules = rules.map((r) => (r.id === rule.id ? rule : r));
    }
    setRules(updatedRules);
    setEditingRule(null);
    setIsNewRule(false);

    // Persist single rule directly to Firestore using updateValidationRule
    if (activeProject) {
      try {
        await updateValidationRule(activeProject.id, rule);
        console.log(`[Firestore] updateValidationRule fullført for ${rule.id}`);
      } catch (err) {
        console.warn('[Firestore] Kunne ikke auto-lagre enkeltregel:', err);
      }
    }
  };

  // Dedicated constraint update handler using updateValidationRule
  const handleQuickConstraintUpdate = async (
    ruleType: ValidationRuleType,
    paramUpdates: Partial<DatasetValidationRule['params']>
  ) => {
    const existingIndex = rules.findIndex((r) => r.type === ruleType);
    let targetRule: DatasetValidationRule;

    if (existingIndex >= 0) {
      targetRule = {
        ...rules[existingIndex],
        enabled: true,
        params: {
          ...rules[existingIndex].params,
          ...paramUpdates,
        },
      };
    } else {
      targetRule = {
        id: `rule-${ruleType}-${Date.now().toString(36)}`,
        name: getRuleTypeMeta(ruleType).title,
        description: getRuleTypeMeta(ruleType).description,
        type: ruleType,
        enabled: true,
        severity: 'error',
        params: {
          targetColumn: 'text',
          ...paramUpdates,
        },
      };

    }

    const nextRules = existingIndex >= 0
      ? rules.map((r, i) => (i === existingIndex ? targetRule : r))
      : [...rules, targetRule];

    setRules(nextRules);

    if (activeProject) {
      try {
        await updateValidationRule(activeProject.id, targetRule);
        setFirestoreSavedTime(new Date().toISOString());
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      } catch (e) {
        console.error('Failed to update validation rule in Firestore:', e);
      }
    }
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
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">
                Datasett Valideringsregler
              </h2>
              <span className="flex items-center gap-1 rounded bg-[#FF9F0A]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#FF9F0A]">
                <Flame className="h-3 w-3" />
                <span>Firestore Synkronisert</span>
              </span>
            </div>
            <p className="text-[11px] text-[#A3A3A0]">
              Prosjekt: <span className="font-semibold text-white">{activeProject?.name || 'Standard'}</span> •{' '}
              <span className="text-[#77F23B]">{activeRulesCount} aktive regler</span>
              {firestoreSavedTime && (
                <span className="text-[#888]"> • Sist lagret: {new Date(firestoreSavedTime).toLocaleTimeString('nb-NO')}</span>
              )}
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
                <span>Lagret til Firestore!</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? 'Lagrer til Firestore...' : 'Lagre & Synkroniser'}</span>
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
        {/* Rules List & Constraint Form (Left 7 Cols) */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] lg:col-span-7">
          {/* Quick Constraint Configurator Form */}
          <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#171716] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#8F2BFF]" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Begrensningsskjema (Hurtigkonfigurasjon)
                </h3>
              </div>
              <span className="font-mono text-[10px] text-[#39D9E6]">
                Synkroniseres til Firestore med updateValidationRule()
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 1. Missing Values Constraints */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#1F1F1E] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-white mb-2">
                  <AlertCircle className="h-3.5 w-3.5 text-[#FF453A]" />
                  <span>Manglende verdier</span>
                </div>
                <div className="space-y-2 text-[11px] text-[#A3A3A0]">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={rules.some(r => r.type === 'missing_values' && r.enabled && r.params.disallowEmpty)}
                      onChange={(e) => {
                        handleQuickConstraintUpdate('missing_values', {
                          disallowEmpty: e.target.checked,
                          disallowWhitespaceOnly: true,
                          targetColumn: 'text',
                        });
                      }}
                      className="rounded border-[#444] bg-[#2A2A28] text-[#8F2BFF] focus:ring-0"
                    />
                    <span>Forby tomme strenger</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={rules.some(r => r.type === 'missing_values' && r.enabled && r.params.disallowWhitespaceOnly)}
                      onChange={(e) => {
                        handleQuickConstraintUpdate('missing_values', {
                          disallowWhitespaceOnly: e.target.checked,
                          targetColumn: 'text',
                        });
                      }}
                      className="rounded border-[#444] bg-[#2A2A28] text-[#8F2BFF] focus:ring-0"
                    />
                    <span>Forby kun mellomrom</span>
                  </label>
                </div>
              </div>

              {/* 2. Range Limits Constraints */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#1F1F1E] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-white mb-2">
                  <Hash className="h-3.5 w-3.5 text-[#39D9E6]" />
                  <span>Grenser (Lengde & Ord)</span>
                </div>
                <div className="space-y-2 text-[11px] text-[#A3A3A0]">
                  <div className="flex items-center justify-between gap-1">
                    <span>Maks tegn:</span>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      defaultValue={rules.find(r => r.type === 'range_limits')?.params.maxLength || 200}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10) || 200;
                        handleQuickConstraintUpdate('range_limits', {
                          maxLength: val,
                          minLength: 2,
                          targetColumn: 'text',
                        });
                      }}
                      className="w-16 rounded bg-[#2A2A28] px-1.5 py-0.5 font-mono text-[11px] text-white border border-[rgba(255,255,255,0.08)]"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span>Maks ord:</span>
                    <input
                      type="number"
                      min={1}
                      max={150}
                      defaultValue={rules.find(r => r.type === 'range_limits')?.params.maxWords || 35}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10) || 35;
                        handleQuickConstraintUpdate('range_limits', {
                          maxWords: val,
                          minWords: 1,
                          targetColumn: 'text',
                        });
                      }}
                      className="w-16 rounded bg-[#2A2A28] px-1.5 py-0.5 font-mono text-[11px] text-white border border-[rgba(255,255,255,0.08)]"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Norwegian Character Frequency & Dialect Authenticity */}
              <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-[#1F1F1E] p-3 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-white mb-2">
                  <Languages className="h-3.5 w-3.5 text-[#77F23B]" />
                  <span>Norsk tegnfrekvens</span>
                </div>
                <div className="space-y-2 text-[11px] text-[#A3A3A0]">
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={rules.some(r => r.type === 'norwegian_char_frequency' && r.enabled)}
                      onChange={(e) => {
                        const rule = rules.find(r => r.type === 'norwegian_char_frequency');
                        if (rule) {
                          handleToggleRule(rule.id);
                        } else {
                          handleQuickConstraintUpdate('norwegian_char_frequency', {
                            minNorwegianFrequencyPercent: 1.0,
                            minNorwegianChars: 1,
                            targetColumn: 'text',
                          });
                        }
                      }}
                      className="rounded border-[#444] bg-[#2A2A28] text-[#8F2BFF] focus:ring-0"
                    />
                    <span>Krev æ, ø, å frekvens</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                    <input
                      type="checkbox"
                      checked={rules.some(r => r.type === 'norwegian_vocabulary' && r.enabled)}
                      onChange={() => {
                        const rule = rules.find(r => r.type === 'norwegian_vocabulary');
                        if (rule) handleToggleRule(rule.id);
                      }}
                      className="rounded border-[#444] bg-[#2A2A28] text-[#8F2BFF] focus:ring-0"
                    />
                    <span>Forby svenske tegn (ä, ö)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-semibold text-white">
            <span>Alle Konfigurerte Regler ({filteredRules.length})</span>
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
                    {rule.type === 'missing_values' && (
                      <span className="font-mono text-[#E0E0DC]">
                        Mangler: {rule.params.disallowEmpty ? 'Forbyr tom' : 'Tillatt'} • {rule.params.disallowWhitespaceOnly ? 'Forbyr kun tomrom' : ''}
                        {rule.params.maxMissingPercent != null && ` • Maks feiltoleranse: ${rule.params.maxMissingPercent}%`}
                      </span>
                    )}
                    {rule.type === 'range_limits' && (
                      <span className="font-mono text-[#E0E0DC]">
                        Grenser: {rule.params.minLength ?? 1}–{rule.params.maxLength ?? 200} tegn • {rule.params.minWords ?? 1}–{rule.params.maxWords ?? 35} ord
                        {rule.params.maxTokens ? ` • Maks ${rule.params.maxTokens} tokens` : ''}
                      </span>
                    )}
                    {rule.type === 'norwegian_char_frequency' && (
                      <span className="font-mono text-[#B25CFF]">
                        Norsk frekvens: Min {rule.params.minNorwegianFrequencyPercent ?? 1}% tegn • Min {rule.params.minNorwegianChars ?? 1} av (æ, ø, å)
                        {rule.params.requiredNorwegianCharacters && ` • Påkrevd: [${rule.params.requiredNorwegianCharacters.join(', ')}]`}
                      </span>
                    )}
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
              <Sparkles className="h-4 w-4 text-[#8F2BFF]" />
              <span>Interaktiv Valideringssandkasse</span>
            </div>
            <span className="text-[10px] text-[#A3A3A0]">Sanntidstest</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4 custom-scrollbar">
            <div>
              <label className="block text-xs font-semibold text-[#E0E0DC]">
                Velg regel som skal testes
              </label>
              <select
                value={selectedRuleToTest?.id || (rules[0] ? rules[0].id : '')}
                onChange={(e) => {
                  const found = rules.find((r) => r.id === e.target.value);
                  setSelectedRuleToTest(found || null);
                }}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2 text-xs text-white focus:outline-none"
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({getRuleTypeMeta(r.type).title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E0E0DC]">
                Testytring (Norsk tekst)
              </label>
              <textarea
                rows={3}
                value={sandboxText}
                onChange={(e) => setSandboxText(e.target.value)}
                placeholder="Skriv en setning for å verifisere regelen..."
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 font-mono text-xs text-white focus:border-[#8F2BFF] focus:outline-none"
              />
              <div className="mt-1 flex items-center justify-between text-[10px] text-[#777]">
                <span>Lengde: {sandboxText.length} tegn</span>
                <span>Ord: {sandboxText.trim().split(/\s+/).filter(Boolean).length} ord</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#E0E0DC]">
                Klasse / Etikett
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8F2BFF] py-2.5 text-xs font-bold text-white shadow-md shadow-[#8F2BFF]/20 transition-all hover:bg-[#A347FF] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isTesting ? 'Validerer...' : 'Kjør Valideringstest'}</span>
            </button>

            {/* Test Result Output Box */}
            {testResult && (
              <div
                className={`rounded-xl border p-3.5 transition-all ${
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
// Subcomponent: Custom Validation Rule Editor Modal
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
  const [activeConfigTab, setActiveConfigTab] = useState<'constraints' | 'severity' | 'preview'>('constraints');

  const handleTypeChange = (newType: ValidationRuleType) => {
    const meta = getRuleTypeMeta(newType);
    let defaultParams = { ...formData.params };

    if (newType === 'missing_values') {
      defaultParams = {
        ...defaultParams,
        disallowEmpty: true,
        disallowWhitespaceOnly: true,
        maxMissingPercent: 0,
        customErrorMessage: 'Påkrevd verdi mangler eller er tom.',
      };
    } else if (newType === 'range_limits') {
      defaultParams = {
        ...defaultParams,
        minLength: 3,
        maxLength: 200,
        minWords: 1,
        maxWords: 35,
        maxTokens: 50,
        customErrorMessage: 'Teksten faller utenfor tillatt lengde- eller ordgrense.',
      };
    } else if (newType === 'norwegian_char_frequency') {
      defaultParams = {
        ...defaultParams,
        minNorwegianFrequencyPercent: 2.0,
        minNorwegianChars: 1,
        dialectTarget: 'Bokmål',
        requiredNorwegianCharacters: ['æ', 'ø', 'å'],
        customErrorMessage: 'Teksten oppfyller ikke kravet til norsk tegnfrekvens eller særnorske tegn.',
      };
    }

    setFormData((prev) => ({
      ...prev,
      type: newType,
      name: prev.name || meta.title,
      description: meta.description,
      severity: meta.defaultSeverity,
      params: defaultParams,
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

  const toggleRequiredChar = (char: 'æ' | 'ø' | 'å' | 'Æ' | 'Ø' | 'Å') => {
    const current = formData.params.requiredNorwegianCharacters || [];
    const updated = current.includes(char)
      ? current.filter((c) => c !== char)
      : [...current, char];
    handleParamChange('requiredNorwegianCharacters', updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#171716] p-6 shadow-2xl text-xs text-[#F4F4F2]">
        <div className="mb-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-[#8F2BFF]/20 p-1.5 text-[#B25CFF]">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isNew ? 'Definer ny valideringsregel' : 'Rediger valideringsregel'}
              </h3>
              <p className="text-[11px] text-[#A3A3A0]">
                Persisteres til Firestore og TinyML-kjøretid
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#888] hover:bg-[#222] hover:text-white">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(formData);
          }}
          className="space-y-4"
        >
          {/* Rule Name & Target Column */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

            <div>
              <label className="block font-medium text-[#E0E0DC]">Målkolonne</label>
              <select
                value={formData.params.targetColumn || 'text'}
                onChange={(e) => handleParamChange('targetColumn', e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="text">text (Ytring / Norsk inndata)</option>
                <option value="label">label (Klasse / Etikett)</option>
                <option value="meta">meta (Metadata / Kontekst)</option>
              </select>
            </div>
          </div>

          {/* Rule Type Category Selector */}
          <div>
            <label className="block font-medium text-[#E0E0DC]">Regeltype & Begrensning</label>
            <select
              value={formData.type}
              onChange={(e) => handleTypeChange(e.target.value as ValidationRuleType)}
              className="mt-1 w-full rounded-lg border border-[#8F2BFF]/30 bg-[#1F1F1E] p-2 text-white font-medium focus:outline-none"
            >
              <optgroup label="Hovedbegrensninger (Krav)">
                <option value="missing_values">🚫 Mangler verdier / Tomme felt (Missing Values Constraint)</option>
                <option value="range_limits">📏 Område- & Grensebegrensninger (Range Limits Constraint)</option>
                <option value="norwegian_char_frequency">🇳🇴 Norsk tegnfrekvens & ratio (Norwegian Frequency)</option>
              </optgroup>
              <optgroup label="Språk og Norsk NLP">
                <option value="norwegian_char_presence">Norske tegn tilstede (æ, ø, å)</option>
                <option value="norwegian_dialect">Dialekt- og språkformsjekk (Bokmål / Nynorsk)</option>
                <option value="ban_mojibake">Deteksjon av Mojibake / Feilkoding</option>
              </optgroup>
              <optgroup label="Andre valideringer">
                <option value="text_length">Enkel tegnlengde</option>
                <option value="word_count">Enkel ordtelling</option>
                <option value="unique_text">Duplikatsjekk</option>
                <option value="label_whitelist">Klasse-hvitliste</option>
                <option value="column_type">Kolonnetype-sjekk</option>
                <option value="regex_match">Regulært uttrykk (Regex)</option>
              </optgroup>
            </select>
          </div>

          {/* Dedicated Constraint Sections */}
          {/* 1. Missing Values Constraint Editor */}
          {formData.type === 'missing_values' && (
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="h-4 w-4 text-[#39D9E6]" />
                <span>Begrensninger for manglende og tomme verdier</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg bg-[#1F1F1E] p-2 text-xs text-[#CCC] cursor-pointer hover:bg-[#252524]">
                  <input
                    type="checkbox"
                    checked={formData.params.disallowEmpty !== false}
                    onChange={(e) => handleParamChange('disallowEmpty', e.target.checked)}
                    className="rounded border-[#444] bg-[#111] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Forby tomme strenger (&quot;&quot;)</span>
                </label>

                <label className="flex items-center gap-2 rounded-lg bg-[#1F1F1E] p-2 text-xs text-[#CCC] cursor-pointer hover:bg-[#252524]">
                  <input
                    type="checkbox"
                    checked={formData.params.disallowWhitespaceOnly !== false}
                    onChange={(e) => handleParamChange('disallowWhitespaceOnly', e.target.checked)}
                    className="rounded border-[#444] bg-[#111] text-[#8F2BFF] focus:ring-0"
                  />
                  <span>Forby kun mellomrom (&quot; &quot;)</span>
                </label>
              </div>

              <div>
                <label className="block text-[11px] text-[#A3A3A0]">
                  Maksimalt tillatt manglende prosentandel i datasettet (0% = strengt påkrevd for alle rader)
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={formData.params.maxMissingPercent ?? 0}
                    onChange={(e) => handleParamChange('maxMissingPercent', parseInt(e.target.value) || 0)}
                    className="flex-1 accent-[#8F2BFF]"
                  />
                  <span className="w-12 font-mono text-xs font-bold text-white">
                    {formData.params.maxMissingPercent ?? 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 2. Range Limits Constraint Editor */}
          {formData.type === 'range_limits' && (
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Hash className="h-4 w-4 text-[#77F23B]" />
                <span>Grenser og områdebegrensninger (Tegn, Ord, Buffer)</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Min. tegnlengde</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.params.minLength ?? 3}
                    onChange={(e) => handleParamChange('minLength', parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Maks. tegnlengde</label>
                  <input
                    type="number"
                    min={2}
                    value={formData.params.maxLength ?? 220}
                    onChange={(e) => handleParamChange('maxLength', parseInt(e.target.value) || 200)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Min. ord</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.params.minWords ?? 1}
                    onChange={(e) => handleParamChange('minWords', parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Maks. ord</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.params.maxWords ?? 35}
                    onChange={(e) => handleParamChange('maxWords', parseInt(e.target.value) || 35)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#A3A3A0]">
                  Maksimalt tillatt estimert token-buffer for mikrokontroller (RAM-sikring)
                </label>
                <input
                  type="number"
                  min={10}
                  max={512}
                  value={formData.params.maxTokens ?? 64}
                  onChange={(e) => handleParamChange('maxTokens', parseInt(e.target.value) || 64)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                />
              </div>
            </div>
          )}

          {/* 3. Norwegian Character Frequency & Ratio Editor */}
          {formData.type === 'norwegian_char_frequency' && (
            <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-3.5 space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <Languages className="h-4 w-4 text-[#B25CFF]" />
                <span>Norsk språkkonsistens & tegnfrekvens</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Min. frekvens av æ, ø, å (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="20"
                    value={formData.params.minNorwegianFrequencyPercent ?? 1.5}
                    onChange={(e) => handleParamChange('minNorwegianFrequencyPercent', parseFloat(e.target.value) || 1.0)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#A3A3A0]">Min. antall særnorske tegn</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.params.minNorwegianChars ?? 1}
                    onChange={(e) => handleParamChange('minNorwegianChars', parseInt(e.target.value) || 1)}
                    className="mt-1 w-full rounded bg-[#222] p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#A3A3A0] mb-1.5">
                  Spesifikt påkrevde norske tegn i ytringen
                </label>
                <div className="flex flex-wrap gap-2">
                  {(['æ', 'ø', 'å', 'Æ', 'Ø', 'Å'] as const).map((ch) => {
                    const isSelected = (formData.params.requiredNorwegianCharacters || []).includes(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => toggleRequiredChar(ch)}
                        className={`h-8 w-8 rounded-lg font-mono text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-[#8F2BFF] text-white shadow-md shadow-[#8F2BFF]/30'
                            : 'bg-[#222] text-[#888] hover:text-white'
                        }`}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#A3A3A0]">Språkformsmål</label>
                <select
                  value={formData.params.dialectTarget || 'Bokmål'}
                  onChange={(e) => handleParamChange('dialectTarget', e.target.value)}
                  className="mt-1 w-full rounded bg-[#222] p-1.5 text-xs text-white"
                >
                  <option value="Bokmål">Bokmål (flagger Nynorsk-spesifikke markører)</option>
                  <option value="Nynorsk">Nynorsk (flagger Bokmål-spesifikke markører)</option>
                  <option value="any">Både Bokmål og Nynorsk tillatt</option>
                </select>
              </div>
            </div>
          )}

          {/* Severity & State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#E0E0DC]">Alvorlighetsgrad</label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1F1F1E] p-2 text-white focus:outline-none"
              >
                <option value="error">Feil (Gjør raden ugyldig i TinyML-settet)</option>
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
              placeholder="f.eks. Ytringen overskrider maksimal lengde eller mangler norske tegn."
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
              className="flex items-center gap-1.5 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8F2BFF]/20 hover:bg-[#A347FF]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Lagre & Persister regel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
