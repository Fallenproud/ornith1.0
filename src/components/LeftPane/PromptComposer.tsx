/**
 * ULTIMATE ORNITH 1.0 — Prompt Composer
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Square,
  Paperclip,
  Sparkles,
  X,
  FileText,
  Upload,
} from 'lucide-react';

interface PromptComposerProps {
  onSendMessage: (text: string, attachments?: File[]) => void;
  isLoading: boolean;
  onCancelLoading: () => void;
  onQuickAction: (action: string) => void;
}

const QUICK_SUGGESTIONS = [
  'Analyser det norske datasettet',
  'Start TinyML-trening (25 epoker)',
  'Generer C-header for Arduino Nano',
  'Hvordan fungerer sammensatt ord-tokenisering i TinyML?',
];

export const PromptComposer: React.FC<PromptComposerProps> = ({
  onSendMessage,
  isLoading,
  onCancelLoading,
  onQuickAction,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem('ornith_prompt_draft');
    if (draft) setText(draft);
  }, []);

  // Persist draft
  useEffect(() => {
    localStorage.setItem('ornith_prompt_draft', text);
  }, [text]);

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading) return;
    onSendMessage(text.trim(), attachments);
    setText('');
    setAttachments([]);
    localStorage.removeItem('ornith_prompt_draft');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-adjust height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments((prev) => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#111111] p-3">
      {/* Quick suggestions pills */}
      <div className="mb-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        <Sparkles className="h-3 w-3 shrink-0 text-[#8F2BFF]" />
        {QUICK_SUGGESTIONS.map((sugg, i) => (
          <button
            key={i}
            onClick={() => onQuickAction(sugg)}
            className="shrink-0 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1 text-[#A3A3A0] transition-colors hover:border-[#8F2BFF]/40 hover:text-white"
          >
            {sugg}
          </button>
        ))}
      </div>

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] px-2 py-1 text-xs text-[#E0E0DC]"
            >
              <FileText className="h-3.5 w-3.5 text-[#39D9E6]" />
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(idx)}
                className="text-[#888] hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input container */}
      <div className="relative rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#171717] p-2 transition-all focus-within:border-[#8F2BFF]">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Spør Ornith om norsk TinyML, datasett, trening eller mikrokontrollere... (Enter for å sende)"
          rows={2}
          className="w-full resize-none bg-transparent text-xs leading-relaxed text-white placeholder-[#666] focus:outline-none"
        />

        <div className="flex items-center justify-between pt-1.5">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,.jsonl,.csv,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Legg ved datasett eller fil"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A3A3A0] transition-colors hover:bg-[#222] hover:text-white"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#555]">
              {text.length > 0 && `${text.length} tegn`}
            </span>
            {isLoading ? (
              <button
                onClick={onCancelLoading}
                title="Stopp generering"
                className="flex h-7 items-center gap-1.5 rounded-lg bg-[#FF453A]/20 px-2.5 text-xs font-medium text-[#FF453A] transition-colors hover:bg-[#FF453A]/30"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Stopp</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim() && attachments.length === 0}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8F2BFF] text-white transition-all hover:bg-[#A347FF] disabled:cursor-not-allowed disabled:bg-[rgba(255,255,255,0.06)] disabled:text-[#555]"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
