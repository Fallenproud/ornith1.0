/**
 * ULTIMATE ORNITH 1.0 — Conversation Message Item
 */

import React from 'react';
import {
  Cpu,
  User,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Activity,
  FileCode2,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { ChatMessage, RightPaneMode } from '../../types';
import { formatTimeOnly } from '../../lib/i18n';

interface MessageItemProps {
  message: ChatMessage;
  onRetry?: (text: string) => void;
  onNavigateToMode?: (mode: RightPaneMode) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onRetry,
  onNavigateToMode,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  if (isSystem) {
    return (
      <div className="my-2 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.06)] bg-[#141414] px-3 py-1 text-[11px] text-[#A3A3A0]">
          <Activity className="h-3 w-3 text-[#39D9E6]" />
          <span>{message.text}</span>
          <span className="font-mono text-[#555]">{formatTimeOnly(message.timestamp)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`group mb-4 flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
          isUser
            ? 'bg-[#1F1F1E] text-white border border-[rgba(255,255,255,0.1)]'
            : 'bg-gradient-to-br from-[#8F2BFF] to-[#39D9E6] text-white shadow-sm'
        }`}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
      </div>

      {/* Message Body */}
      <div className={`max-w-[85%] space-y-1.5 ${isUser ? 'items-end text-right' : 'items-start'}`}>
        {/* Header meta */}
        <div className={`flex items-center gap-2 text-[11px] ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="font-medium text-[#A3A3A0]">
            {isUser ? 'Deg' : 'Ornith TinyML'}
          </span>
          {message.modelUsed && (
            <span className="rounded bg-[#8F2BFF]/15 px-1 py-0.2 font-mono text-[9px] text-[#B25CFF]">
              {message.modelUsed}
            </span>
          )}
          <span className="font-mono text-[10px] text-[#6B6B67]">
            {formatTimeOnly(message.timestamp)}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
            isUser
              ? 'bg-[#1F1F1E] text-[#F4F4F2] border border-[rgba(255,255,255,0.08)]'
              : 'bg-[#141414] text-[#E0E0DC] border border-[rgba(255,255,255,0.06)]'
          }`}
        >
          <div className="whitespace-pre-wrap">{message.text}</div>

          {/* Attached files / datasets */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.06)]">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 rounded bg-[#1C1C1A] px-2 py-1 text-[11px] text-[#A3A3A0]"
                >
                  <Database className="h-3 w-3 text-[#39D9E6]" />
                  <span className="truncate max-w-[140px]">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Training Event Card Embedded */}
          {message.trainingEvent && (
            <div className="mt-2.5 rounded-lg border border-[#8F2BFF]/30 bg-[#8F2BFF]/10 p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#F4F4F2]">
                  {message.trainingEvent.type === 'run_completed'
                    ? 'Trening Fullført'
                    : 'Aktiv Treningsøkt'}
                </span>
                <span className="font-mono text-[#B25CFF]">
                  Økt: {message.trainingEvent.runId.slice(0, 12)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-[#A3A3A0]">
                  Gå direkte til telemetri og forvekslingsmatrise:
                </span>
                <button
                  onClick={() => onNavigateToMode && onNavigateToMode('training')}
                  className="flex items-center gap-1 rounded bg-[#8F2BFF] px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-[#A347FF]"
                >
                  <span>Åpne trening</span>
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons on hover */}
        {!isUser && (
          <div className="flex items-center gap-1.5 pt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded p-1 text-[10px] text-[#A3A3A0] transition-colors hover:text-white"
              title="Kopier svar"
            >
              {copied ? <Check className="h-3 w-3 text-[#77F23B]" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Kopiert' : 'Kopier'}</span>
            </button>
            {onRetry && (
              <button
                onClick={() => onRetry(message.text)}
                className="flex items-center gap-1 rounded p-1 text-[10px] text-[#A3A3A0] transition-colors hover:text-white"
                title="Generer på nytt"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Prøv igjen</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
