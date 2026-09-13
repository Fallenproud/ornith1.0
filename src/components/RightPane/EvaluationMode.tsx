/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Evaluation Mode
 * 
 * Confusion matrix heatmap, per-class F1/Precision/Recall & test prediction audit.
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { EvaluationResult, TrainingRun } from '../../types';
import { API } from '../../lib/api';
import { formatNumber, formatPercent } from '../../lib/i18n';

interface EvaluationModeProps {
  activeRun: TrainingRun | null;
}

export const EvaluationMode: React.FC<EvaluationModeProps> = ({ activeRun }) => {
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (!activeRun?.id) return;
    const fetchEval = async () => {
      setIsLoading(true);
      try {
        const res = await API.getEvaluation(activeRun.id);
        setEvalResult(res);
      } catch (err) {
        console.warn('No eval result yet for run', activeRun.id);
      } finally {
        setIsLoading(false);
      }
    };
    fetchEval();
  }, [activeRun?.id, activeRun?.status]);

  if (!evalResult) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-[#A3A3A0]">
        <BarChart3 className="mb-3 h-10 w-10 text-[#6B6B67]" />
        <h3 className="text-sm font-semibold text-white">Ingen evaluering funnet</h3>
        <p className="mt-1 max-w-sm text-xs text-[#888]">
          Fullfør en modelltrening for å generere automatisk forvekslingsmatrise og testsett-evaluering.
        </p>
      </div>
    );
  }

  const { labels, matrix } = evalResult.confusionMatrix;
  const filteredSamples = evalResult.samplePredictions.filter((s) =>
    s.text.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0E0E0D] custom-scrollbar p-6 text-[#F4F4F2]">
      {/* Header */}
      <div className="mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-[#39D9E6]" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            Modellevaluering & Forvekslingsmatrise
          </h1>
          <span className="rounded bg-[#77F23B]/15 px-2 py-0.5 font-mono text-xs text-[#77F23B]">
            Testsett ({evalResult.testSamplesCount} eksempler)
          </span>
        </div>
        <p className="mt-1 text-xs text-[#A3A3A0]">
          Generert på uavhengig testsett med nøytral fordeling.
        </p>
      </div>

      {/* Summary Score Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Testnøyaktighet</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-white">
              {formatPercent(evalResult.testAccuracy, 1)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Testtap (Loss)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#39D9E6]">
              {evalResult.testLoss.toFixed(4)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Antall klasser</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-[#B25CFF]">
              {labels.length}
            </span>
            <span className="text-[10px] text-[#A3A3A0]">kategorier</span>
          </div>
        </div>
      </div>

      {/* Confusion Matrix Section */}
      <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        <h3 className="mb-3 text-xs font-semibold text-white">
          Forvekslingsmatrise (Sann klasse vs. Predikert klasse)
        </h3>
        <div className="overflow-x-auto">
          <table className="border-collapse font-mono text-[10px]">
            <thead>
              <tr>
                <th className="p-1 text-left text-[#666]">Sann \ Pred</th>
                {labels.map((l) => (
                  <th key={l} className="p-1 text-center font-normal text-[#A3A3A0] max-w-[50px] truncate" title={l}>
                    {l.slice(0, 5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((rowLabel, rIdx) => (
                <tr key={rowLabel}>
                  <td className="p-1 text-left text-[#A3A3A0] max-w-[80px] truncate" title={rowLabel}>
                    {rowLabel}
                  </td>
                  {labels.map((_, cIdx) => {
                    const count = matrix[rIdx]?.[cIdx] || 0;
                    const isDiagonal = rIdx === cIdx;
                    return (
                      <td
                        key={cIdx}
                        className={`border border-[rgba(255,255,255,0.04)] p-2 text-center transition-colors ${
                          count > 0 && isDiagonal
                            ? 'bg-[#77F23B]/30 text-white font-bold'
                            : count > 0 && !isDiagonal
                            ? 'bg-[#FF453A]/20 text-[#FF8577]'
                            : 'bg-[#181817] text-[#444]'
                        }`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-Class Metrics */}
      <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        <h3 className="mb-3 text-xs font-semibold text-white">
          Klassevise Metrikker (Precision, Recall & F1-score)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)] text-[11px] text-[#A3A3A0]">
                <th className="py-2 pl-3">Klasse (Intent)</th>
                <th className="py-2 px-3">Presisjon</th>
                <th className="py-2 px-3">Recall</th>
                <th className="py-2 px-3">F1-Skår</th>
                <th className="py-2 pr-3 text-right">Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {Object.entries(evalResult.perClassMetrics).map(([cls, rawM]) => {
                const m = rawM as { precision: number; recall: number; f1Score: number; support: number };
                return (
                  <tr key={cls} className="hover:bg-[#1A1A19]">
                    <td className="py-2 pl-3 font-medium text-white">{cls}</td>
                    <td className="py-2 px-3 text-[#A3A3A0]">{(m.precision * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-[#A3A3A0]">{(m.recall * 100).toFixed(1)}%</td>
                    <td className="py-2 px-3 text-[#77F23B]">{(m.f1Score * 100).toFixed(1)}%</td>
                    <td className="py-2 pr-3 text-right text-[#666]">{m.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sample Predictions Audit */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white">
            Individuelle Prediksjoner på Testsettet
          </h3>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-[#666]" />
            <input
              type="text"
              placeholder="Filtrer testsettrader..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] py-1 pl-7 pr-2 text-xs text-white placeholder-[#555] focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)] font-mono text-[11px] text-[#A3A3A0]">
                <th className="py-2 pl-3">Testtekst</th>
                <th className="py-2 px-3">Faktisk Klasse</th>
                <th className="py-2 px-3">Predikert Klasse</th>
                <th className="py-2 px-3">Konfidens</th>
                <th className="py-2 pr-3 text-right">Resultat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
              {filteredSamples.map((s, idx) => (
                <tr key={idx} className="hover:bg-[#1A1A19]">
                  <td className="py-2.5 pl-3 font-medium text-white">{s.text}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[#A3A3A0]">{s.actual}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[#B25CFF]">{s.predicted}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[#39D9E6]">
                    {formatPercent(s.confidence, 1)}
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    {s.isCorrect ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#77F23B]">
                        <CheckCircle2 className="h-3 w-3" /> Riktig
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[#FF453A]">
                        <AlertTriangle className="h-3 w-3" /> Feil
                      </span>
                    )}
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
