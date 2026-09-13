/**
 * ULTIMATE ORNITH 1.0 — Right Pane Container
 * 
 * Houses the 7 canonical modes with tabbed navigation and status badges.
 */

import React from 'react';
import {
  FolderTree,
  FileCode2,
  Database,
  Play,
  Activity,
  BarChart3,
  Package,
} from 'lucide-react';
import {
  RightPaneMode,
  DatasetMetadata,
  ProjectMetadata,
  TrainingRun,
  TrainingHyperparameters,
} from '../../types';
import { FilesMode } from './FilesMode';
import { CodeMode } from './CodeMode';
import { DatasetMode } from './DatasetMode';
import { PreviewMode } from './PreviewMode';
import { TrainingMode } from './TrainingMode';
import { EvaluationMode } from './EvaluationMode';
import { ArtifactsMode } from './ArtifactsMode';
import { PerformanceTelemetryMonitor } from './PerformanceTelemetryMonitor';

interface RightPaneProps {
  activeMode: RightPaneMode;
  onSelectMode: (mode: RightPaneMode) => void;
  activeProject: ProjectMetadata | null;
  activeDataset: DatasetMetadata | null;
  activeRun: TrainingRun | null;
  onOpenUploadModal: () => void;
  onStartTraining: (hp: TrainingHyperparameters) => void;
  onCancelTraining: () => void;
  onProjectUpdated?: (p: ProjectMetadata) => void;
  onDatasetUpdated?: (d: DatasetMetadata) => void;
}

const MODES = [
  { id: 'dataset' as RightPaneMode, label: 'Datasett', icon: Database },
  { id: 'training' as RightPaneMode, label: 'Trening', icon: Activity },
  { id: 'preview' as RightPaneMode, label: 'Forhåndsvisning', icon: Play },
  { id: 'evaluation' as RightPaneMode, label: 'Evaluering', icon: BarChart3 },
  { id: 'code' as RightPaneMode, label: 'Kode', icon: FileCode2 },
  { id: 'artifacts' as RightPaneMode, label: 'Artefakter', icon: Package },
  { id: 'files' as RightPaneMode, label: 'Filer', icon: FolderTree },
];

export const RightPane: React.FC<RightPaneProps> = ({
  activeMode,
  onSelectMode,
  activeProject,
  activeDataset,
  activeRun,
  onOpenUploadModal,
  onStartTraining,
  onCancelTraining,
  onProjectUpdated,
  onDatasetUpdated,
}) => {
  return (
    <main className="flex h-full flex-1 flex-col overflow-hidden bg-[#0D0D0C]">
      {/* Top Tab Bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#111111] px-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = activeMode === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border border-[rgba(255,255,255,0.1)] bg-[#1F1F1E] text-white shadow-sm'
                    : 'text-[#888] hover:bg-[#161616] hover:text-[#CCC]'
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-[#8F2BFF]' : 'text-[#777]'
                  }`}
                />
                <span>{mode.label}</span>
                {mode.id === 'training' && activeRun?.status === 'running' && (
                  <span className="flex h-2 w-2 rounded-full bg-[#39D9E6] animate-ping" />
                )}
              </button>
            );
          })}
        </div>

        {/* Quick status pill */}
        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-[#A3A3A0]">
          <span>Modus:</span>
          <span className="rounded bg-[#1A1A1A] px-2 py-0.5 text-white">
            {activeMode.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Mode Viewport */}
      <div className="flex-1 overflow-hidden">
        {activeMode === 'dataset' && (
          <DatasetMode
            activeDataset={activeDataset}
            activeProject={activeProject}
            onOpenUploadModal={onOpenUploadModal}
            onProjectUpdated={onProjectUpdated}
            onDatasetUpdated={onDatasetUpdated}
          />
        )}
        {activeMode === 'training' && (
          <TrainingMode
            activeProject={activeProject}
            activeDataset={activeDataset}
            activeRun={activeRun}
            onStartTraining={onStartTraining}
            onCancelTraining={onCancelTraining}
          />
        )}
        {activeMode === 'preview' && <PreviewMode />}
        {activeMode === 'evaluation' && <EvaluationMode activeRun={activeRun} />}
        {activeMode === 'code' && <CodeMode />}
        {activeMode === 'artifacts' && <ArtifactsMode activeRun={activeRun} />}
        {activeMode === 'files' && <FilesMode />}
      </div>

      {/* Persistent Firestore Read Latency & Concurrency Telemetry Monitor */}
      <PerformanceTelemetryMonitor compact={false} />
    </main>
  );
};

