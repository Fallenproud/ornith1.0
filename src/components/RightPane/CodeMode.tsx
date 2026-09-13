/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Code Mode
 * 
 * Embedded C/C++ Header viewer & TinyML neural engine architecture code.
 */

import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  Download,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { API } from '../../lib/api';

const CODE_TABS = [
  { id: 'c-header', name: 'ornith_tinyml_model.h (Embedded C)', path: 'server/tinyml_engine.ts', lang: 'c' },
  { id: 'engine', name: 'tinyml_engine.ts (Kjerne & Backprop)', path: 'server/tinyml_engine.ts', lang: 'typescript' },
  { id: 'server', name: 'server.ts (REST & SSE Telemetri)', path: 'server.ts', lang: 'typescript' },
];

export const CodeMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState('c-header');
  const [code, setCode] = useState<string>('Laster kode...');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchCode = async () => {
      if (activeTab === 'c-header') {
        // Fetch generated artifact or sample
        try {
          const artifacts = await API.listArtifacts();
          const cArt = artifacts.find((a) => a.fileType === 'c-header');
          if (cArt) {
            const res = await fetch(cArt.downloadUrl);
            const text = await res.text();
            setCode(text);
            return;
          }
        } catch {
          // Fallback
        }
        // If not found yet, load sample C header
        setCode(`/*
 * ORNITH 1.0 — GENERATED TINYML INFERENCE HEADER
 * Arkitektur: Dense (Relu) -> Dense (Softmax)
 * Target: Arduino Nano 33 BLE / ESP32 (ARM Cortex-M / Xtensa)
 * RAM Footprint: ~4.2 KB
 */

#ifndef ORNITH_TINYML_MODEL_H
#define ORNITH_TINYML_MODEL_H

#include <stdint.h>
#include <string.h>
#include <math.h>

#define ORNITH_VOCAB_SIZE 256
#define ORNITH_NUM_CLASSES 9
#define ORNITH_EMBED_DIM 32

static const char* ORNITH_LABELS[ORNITH_NUM_CLASSES] = {
  "garasje_lukk", "garasje_åpne", "lys_av", "lys_på",
  "musikk_kontroll", "sikkerhetsalarm", "temp_sjekk", "varme_ned", "varme_opp"
};

/* Ren C inferensfunksjon uten eksterne avhengigheter */
int ornith_predict(const float* input_vector, float* output_probabilities);

#endif // ORNITH_TINYML_MODEL_H
`);
      } else if (activeTab === 'engine') {
        try {
          const res = await API.getFileContent('server/tinyml_engine.ts');
          setCode(res.content);
        } catch (e: any) {
          setCode(`// Feil ved lasting: ${e.message}`);
        }
      } else if (activeTab === 'server') {
        try {
          const res = await API.getFileContent('server.ts');
          setCode(res.content);
        } catch (e: any) {
          setCode(`// Feil ved lasting: ${e.message}`);
        }
      }
    };

    fetchCode();
  }, [activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const filename =
      activeTab === 'c-header'
        ? 'ornith_tinyml_model.h'
        : activeTab === 'engine'
        ? 'tinyml_engine.ts'
        : 'server.ts';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = code.split('\n');

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0A0A09]">
      {/* Tab bar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#111111] px-4">
        <div className="flex items-center gap-1">
          {CODE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#1C1C1A] text-white border border-[rgba(255,255,255,0.1)]'
                  : 'text-[#888] hover:text-[#DDD]'
              }`}
            >
              <FileCode2 className="h-3.5 w-3.5 text-[#8F2BFF]" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1 text-xs text-[#A3A3A0] transition-colors hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#77F23B]" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Kopiert' : 'Kopier'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-md bg-[#8F2BFF] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#A347FF]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Last ned</span>
          </button>
        </div>
      </div>

      {/* Code container */}
      <div className="flex flex-1 overflow-auto custom-scrollbar font-mono text-xs leading-5">
        <div className="select-none bg-[#0D0D0C] py-3 pl-3 pr-2 text-right text-[11px] text-[#444] border-r border-[rgba(255,255,255,0.04)]">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <pre className="flex-1 p-3 text-[#E0E0DC] overflow-x-auto whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
};
