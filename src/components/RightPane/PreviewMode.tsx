/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Preview Mode
 * 
 * Interactive TinyML Live Inference Playground & Norwegian Tokenizer Inspector.
 */

import React, { useState } from 'react';
import {
  Play,
  Sparkles,
  Cpu,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { API } from '../../lib/api';
import { formatPercent } from '../../lib/i18n';

const SAMPLE_PROMPTS = [
  'Slå på lyset i stuen',
  'Lukk igjen garasjeporten nå',
  'Hva er temperaturen på soverommet?',
  'Det brenner i kjelleren, aktiver alarm!',
  'Spill litt rolig musikk på kjøkkenet',
  'Skru ned varmen på panelovnen',
];

export const PreviewMode: React.FC = () => {
  const [inputText, setInputText] = useState('Slå på lyset i stuen');
  const [prediction, setPrediction] = useState<{
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
    normalizedTokens: string[];
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePredict = async (textToPredict?: string) => {
    const text = textToPredict || inputText;
    if (!text.trim()) return;

    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await API.runInference(text.trim());
      setPrediction(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Kunne ikke kjøre inferens');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0E0E0D] custom-scrollbar p-6 text-[#F4F4F2]">
      {/* Header */}
      <div className="mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-[#8F2BFF]" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            Interaktiv TinyML Inferens
          </h1>
          <span className="rounded bg-[#77F23B]/10 px-2 py-0.5 font-mono text-xs text-[#77F23B]">
            Edge-Klar
          </span>
        </div>
        <p className="mt-1 text-xs text-[#A3A3A0]">
          Test modellen direkte med vilkårlig norsk tekst. Matrisemultiplikasjonen og Softmax kjøres med de trente TinyML-vektene.
        </p>
      </div>

      {/* Input section */}
      <div className="mb-6 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4">
        <label className="mb-2 block text-xs font-semibold text-[#E0E0DC]">
          Testfrase (Bokmål / Nynorsk):
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePredict()}
            placeholder="F.eks: 'Skru på taklyset' eller 'Lås garasjen'..."
            className="flex-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] px-3.5 py-2 text-xs text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
          />
          <button
            onClick={() => handlePredict()}
            disabled={isRunning || !inputText.trim()}
            className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-medium text-white shadow-md shadow-[#8F2BFF]/20 transition-all hover:bg-[#A347FF] disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>{isRunning ? 'Kjører...' : 'Kjør inferens'}</span>
          </button>
        </div>

        {/* Quick sample chips */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-[#666]">Eksempler:</span>
          {SAMPLE_PROMPTS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(sample);
                handlePredict(sample);
              }}
              className="rounded-md border border-[rgba(255,255,255,0.06)] bg-[#1C1C1A] px-2 py-1 text-[#A3A3A0] transition-colors hover:border-[#8F2BFF]/40 hover:text-white"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 p-4 text-xs text-[#FF453A]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Prediction Output */}
      {prediction && (
        <div className="space-y-6">
          {/* Main Top Prediction Banner */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-gradient-to-r from-[#171717] to-[#141414] p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#A3A3A0]">Klassifisert Intent:</span>
              <span className="font-mono text-xs text-[#39D9E6]">
                Konfidens: {formatPercent(prediction.confidence, 1)}
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {prediction.label}
              </span>
              <span className="rounded bg-[#8F2BFF]/20 px-2 py-0.5 font-mono text-xs text-[#B25CFF]">
                Top Prediksjon
              </span>
            </div>

            {/* Tokenization breakdown chips */}
            <div className="mt-4 border-t border-[rgba(255,255,255,0.06)] pt-3">
              <span className="text-[11px] text-[#A3A3A0]">
                Normaliserte tokens (n-gram & æ/ø/å beholdt):
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {prediction.normalizedTokens.map((tok, i) => (
                  <span
                    key={i}
                    className="rounded bg-[#1F1F1E] border border-[rgba(255,255,255,0.06)] px-2 py-0.5 font-mono text-xs text-[#39D9E6]"
                  >
                    {tok}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Probability Distribution Bar Chart */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
            <h3 className="mb-4 text-xs font-semibold text-white">
              Sannsynlighetsfordeling (Softmax Output)
            </h3>
            <div className="space-y-3">
              {Object.entries(prediction.probabilities)
                .sort(([, a], [, b]) => Number(b) - Number(a))
                .map(([cls, rawProb]) => {
                  const prob = Number(rawProb);
                  const isTop = cls === prediction.label;
                  return (
                    <div key={cls}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span
                          className={`font-mono ${
                            isTop ? 'font-bold text-white' : 'text-[#A3A3A0]'
                          }`}
                        >
                          {cls}
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            isTop ? 'font-bold text-[#77F23B]' : 'text-[#888]'
                          }`}
                        >
                          {formatPercent(prob, 1)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#1F1F1E]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isTop
                              ? 'bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6]'
                              : 'bg-[rgba(255,255,255,0.15)]'
                          }`}
                          style={{ width: `${Math.max(prob * 100, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
