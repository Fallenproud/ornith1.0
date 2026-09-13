/**
 * ULTIMATE ORNITH 1.0 — Left Pane (Conversation & Control)
 */

import React, { useRef, useEffect } from 'react';
import { MessageItem } from './MessageItem';
import { PromptComposer } from './PromptComposer';
import {
  ChatMessage,
  ProjectMetadata,
  DatasetMetadata,
  TrainingRun,
  RightPaneMode,
} from '../../types';
import {
  Layers,
  HardDrive,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
} from 'lucide-react';

interface LeftPaneProps {
  messages: ChatMessage[];
  activeProject: ProjectMetadata | null;
  activeDataset: DatasetMetadata | null;
  activeRun: TrainingRun | null;
  isLoading: boolean;
  onSendMessage: (text: string, attachments?: File[]) => void;
  onCancelLoading: () => void;
  onQuickAction: (action: string) => void;
  onNavigateToMode: (mode: RightPaneMode) => void;
  onStartTrainingShortcut: () => void;
}

export const LeftPane: React.FC<LeftPaneProps> = ({
  messages,
  activeProject,
  activeDataset,
  activeRun,
  isLoading,
  onSendMessage,
  onCancelLoading,
  onQuickAction,
  onNavigateToMode,
  onStartTrainingShortcut,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <aside className="flex h-full flex-col bg-[#0F0F0E] overflow-hidden">
      {/* Top Project & Model Context Banner */}
      <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] bg-[#141414] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#77F23B]" />
            <h2 className="text-xs font-semibold text-white">
              {activeProject?.name || 'Aktivt Prosjekt'}
            </h2>
          </div>
          <span className="font-mono text-[10px] text-[#A3A3A0]">
            {activeProject?.targetArchitecture || 'tinyml-dense'}
          </span>
        </div>

        {/* Mini stats row */}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          <div
            onClick={() => onNavigateToMode('dataset')}
            className="flex cursor-pointer items-center justify-between rounded-md border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] p-1.5 transition-colors hover:border-[#8F2BFF]/40"
          >
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3 w-3 text-[#39D9E6]" />
              <span className="text-[#A3A3A0]">Datasett</span>
            </div>
            <span className="font-mono font-medium text-white">
              {activeDataset?.rowCount || 40} rader
            </span>
          </div>

          <div
            onClick={() => onNavigateToMode('training')}
            className="flex cursor-pointer items-center justify-between rounded-md border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] p-1.5 transition-colors hover:border-[#8F2BFF]/40"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="h-3 w-3 text-[#B25CFF]" />
              <span className="text-[#A3A3A0]">Status</span>
            </div>
            <span
              className={`font-mono font-medium ${
                activeRun?.status === 'running'
                  ? 'text-[#39D9E6] animate-pulse'
                  : activeRun?.status === 'completed'
                  ? 'text-[#77F23B]'
                  : 'text-[#A3A3A0]'
              }`}
            >
              {activeRun?.status === 'running'
                ? `Trener ${activeRun.progressPercent}%`
                : activeRun?.status === 'completed'
                ? 'Klar'
                : 'Klar for start'}
            </span>
          </div>
        </div>

        {/* Active training quick bar */}
        {activeRun && activeRun.status === 'running' && (
          <div className="mt-2 rounded-md border border-[#39D9E6]/30 bg-[#39D9E6]/10 p-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-[#39D9E6]">Aktiv Trening pågår...</span>
              <span className="font-mono text-white">
                Epoke {activeRun.currentEpoch}/{activeRun.totalEpochs} ({activeRun.progressPercent}%)
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#111]">
              <div
                className="h-full bg-[#39D9E6] transition-all duration-200"
                style={{ width: `${activeRun.progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Conversation Timeline */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onRetry={(text) => onSendMessage(text)}
            onNavigateToMode={onNavigateToMode}
          />
        ))}

        {isLoading && (
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8F2BFF] to-[#39D9E6] text-white">
              <Activity className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] px-3.5 py-2.5 text-xs text-[#A3A3A0]">
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#8F2BFF]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#39D9E6] [animation-delay:0.2s]" />
              <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#77F23B] [animation-delay:0.4s]" />
              <span className="ml-1 text-[11px]">Ornith analyserer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Prompt Composer at Bottom */}
      <PromptComposer
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        onCancelLoading={onCancelLoading}
        onQuickAction={onQuickAction}
      />
    </aside>
  );
};
