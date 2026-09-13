/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Training Mode
 * 
 * Real TinyML training orchestration, hyperparameter tuning & live SSE curves.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Activity,
  Sliders,
  Terminal,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Zap,
  Package,
  FolderArchive,
  Download,
} from 'lucide-react';
import {
  TrainingRun,
  TrainingHyperparameters,
  ProjectMetadata,
  DatasetMetadata,
} from '../../types';
import { SvgLossChart, SvgAccuracyChart } from '../SvgCharts';
import { API } from '../../lib/api';
import { formatNumber, formatPercent } from '../../lib/i18n';
import { ExportModal } from '../ExportModal';

interface TrainingModeProps {
  activeProject: ProjectMetadata | null;
  activeDataset: DatasetMetadata | null;
  activeRun: TrainingRun | null;
  onStartTraining: (hp: TrainingHyperparameters) => void;
  onCancelTraining: () => void;
}

export const TrainingMode: React.FC<TrainingModeProps> = ({
  activeProject,
  activeDataset,
  activeRun,
  onStartTraining,
  onCancelTraining,
}) => {
  const [hyperparameters, setHyperparameters] = useState<TrainingHyperparameters>({
    epochs: 25,
    batchSize: 8,
    learningRate: 0.02,
    optimizer: 'adam',
    seed: 42,
    earlyStoppingPatience: 6,
  });

  const [activeTab, setActiveTab] = useState<'curves' | 'logs'>('curves');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'logs') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeRun?.logLines?.length, activeTab]);

  const isRunning = activeRun?.status === 'running';
  const isCompleted = activeRun?.status === 'completed';

  const history = activeRun?.history || [];
  const latestMetric = history[history.length - 1];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0E0E0D] custom-scrollbar p-6 text-[#F4F4F2]">
      {/* Header with status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#8F2BFF]" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              TinyML Modelltrening
            </h1>
            <span
              className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                isRunning
                  ? 'bg-[#39D9E6]/20 text-[#39D9E6] animate-pulse'
                  : isCompleted
                  ? 'bg-[#77F23B]/20 text-[#77F23B]'
                  : 'bg-[#222] text-[#888]'
              }`}
            >
              {isRunning
                ? `Kjører: Epoke ${activeRun?.currentEpoch}/${activeRun?.totalEpochs}`
                : isCompleted
                ? 'Fullført'
                : 'Klar for start'}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#A3A3A0]">
            Sanntids gradient descent og Adam-optimalisering med direkte tilbakemelding over Server-Sent Events.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {isCompleted && (
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#8F2BFF]/40 bg-[#8F2BFF]/15 px-3.5 py-2 text-xs font-semibold text-[#B25CFF] transition-all hover:bg-[#8F2BFF]/25 shadow-sm"
            >
              <FolderArchive className="h-4 w-4 text-[#8F2BFF]" />
              <span>Eksporter Modellpakke (.ZIP)</span>
            </button>
          )}

          {isRunning ? (
            <button
              onClick={onCancelTraining}
              className="flex items-center gap-1.5 rounded-lg bg-[#FF453A]/20 px-4 py-2 text-xs font-medium text-[#FF453A] transition-colors hover:bg-[#FF453A]/30"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              <span>Avbryt trening</span>
            </button>
          ) : (
            <button
              onClick={() => onStartTraining(hyperparameters)}
              disabled={!activeDataset}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#8F2BFF]/25 transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isCompleted ? 'Tren På Nytt' : 'Start Modelltrening'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Completion Banner */}
      {isCompleted && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#77F23B]/30 bg-[#77F23B]/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#77F23B]/20 text-[#77F23B]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Trening Fullført!</h3>
              <p className="text-[11px] text-[#A3A3A0]">
                Modellen er klar for eksport i <strong>TensorFlow Lite (.tflite)</strong>, <strong>SavedModel</strong> og <strong>C-header</strong> med metadata og testlogger.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-95 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Konfigurer & Last ned Pakke</span>
            </button>
          </div>
        </div>
      )}

      {/* Real-time Telemetry Stat Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Tap (Loss)</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-white">
              {latestMetric ? latestMetric.loss.toFixed(4) : '-'}
            </span>
            {latestMetric && (
              <span className="font-mono text-[10px] text-[#77F23B]">
                val: {latestMetric.valLoss.toFixed(4)}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Nøyaktighet</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-white">
              {latestMetric ? formatPercent(latestMetric.accuracy, 1) : '-'}
            </span>
            {latestMetric && (
              <span className="font-mono text-[10px] text-[#39D9E6]">
                val: {formatPercent(latestMetric.valAccuracy, 1)}
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Beregnet RAM på enhet</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#77F23B]">
              ~{activeRun?.finalMetrics?.memoryKb || 4.2} KB
            </span>
            <span className="text-[10px] text-[#A3A3A0]">mikrokontroller</span>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3.5">
          <span className="text-[11px] text-[#A3A3A0]">Parametere</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-bold text-[#B25CFF]">
              {activeRun?.finalMetrics?.parameterCount || 8521}
            </span>
            <span className="text-[10px] text-[#A3A3A0]">vekter</span>
          </div>
        </div>
      </div>

      {/* Hyperparameter Controls (Foldable or side-by-side) */}
      <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[#39D9E6]" />
            <h3 className="text-xs font-semibold text-white">Hyperparametre & Konfigurasjon</h3>
          </div>
          <span className="font-mono text-[11px] text-[#A3A3A0]">
            Mål: Arduino Nano 33 BLE / ESP32
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="text-[11px] text-[#A3A3A0]">Epoker (Epochs)</label>
            <input
              type="number"
              min={5}
              max={100}
              disabled={isRunning}
              value={hyperparameters.epochs}
              onChange={(e) =>
                setHyperparameters({ ...hyperparameters, epochs: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#A3A3A0]">Batch Størrelse</label>
            <select
              disabled={isRunning}
              value={hyperparameters.batchSize}
              onChange={(e) =>
                setHyperparameters({ ...hyperparameters, batchSize: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
            >
              <option value={4}>4 (Edge minneoptimal)</option>
              <option value={8}>8 (Standard)</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[#A3A3A0]">Læringsrate (Learning Rate)</label>
            <input
              type="number"
              step={0.005}
              min={0.001}
              max={0.2}
              disabled={isRunning}
              value={hyperparameters.learningRate}
              onChange={(e) =>
                setHyperparameters({ ...hyperparameters, learningRate: Number(e.target.value) })
              }
              className="mt-1 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1.5 font-mono text-xs text-white focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-[#A3A3A0]">Optimalisator</label>
            <select
              disabled={isRunning}
              value={hyperparameters.optimizer}
              onChange={(e) =>
                setHyperparameters({ ...hyperparameters, optimizer: e.target.value as any })
              }
              className="mt-1 w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1.5 font-mono text-xs text-white focus:outline-none"
            >
              <option value="adam">Adam (Anbefalt)</option>
              <option value="sgd">SGD + Momentum</option>
            </select>
          </div>
        </div>
      </div>

      {/* Telemetry Switcher (Curves vs Live Logs) */}
      <div className="mb-4 flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-2">
        <button
          onClick={() => setActiveTab('curves')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
            activeTab === 'curves'
              ? 'bg-[#1C1C1A] text-white border border-[rgba(255,255,255,0.08)]'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5 text-[#8F2BFF]" />
          <span>Sanntidskurver (Tap & Nøyaktighet)</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors ${
            activeTab === 'logs'
              ? 'bg-[#1C1C1A] text-white border border-[rgba(255,255,255,0.08)]'
              : 'text-[#888] hover:text-white'
          }`}
        >
          <Terminal className="h-3.5 w-3.5 text-[#39D9E6]" />
          <span>Konsolllogger ({activeRun?.logLines?.length || 0})</span>
        </button>
      </div>

      {/* Content depending on tab */}
      {activeTab === 'curves' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Loss Curve */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <h3 className="mb-2 text-xs font-semibold text-white">Tapskurve (Cross-Entropy Loss)</h3>
            <SvgLossChart history={history} />
          </div>

          {/* Accuracy Curve */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <h3 className="mb-2 text-xs font-semibold text-white">Nøyaktighetskurve (Categorical Accuracy)</h3>
            <SvgAccuracyChart history={history} />
          </div>
        </div>
      ) : (
        /* Console Log Terminal */
        <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#090909] p-4 font-mono text-xs">
          <div className="max-h-96 overflow-y-auto space-y-1 custom-scrollbar text-[#A3A3A0]">
            {activeRun?.logLines && activeRun.logLines.length > 0 ? (
              activeRun.logLines.map((line, i) => (
                <div key={i} className="leading-5">
                  <span className="text-[#555] select-none mr-2">{i + 1}</span>
                  <span
                    className={
                      line.includes('FEIL')
                        ? 'text-[#FF453A]'
                        : line.includes('fullført')
                        ? 'text-[#77F23B]'
                        : line.includes('Epoke')
                        ? 'text-[#F4F4F2]'
                        : 'text-[#A3A3A0]'
                    }
                  >
                    {line}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-[#555]">Ingen logglinjer tilgjengelig ennå.</div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Comprehensive Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        run={activeRun}
      />
    </div>
  );
};
