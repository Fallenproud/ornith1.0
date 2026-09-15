/**
 * ULTIMATE ORNITH 1.0 — Boot Sequence & System Health Loader
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Cpu, Database, HardDrive, Sparkles, CheckCircle2 } from "lucide-react";

interface SplashLoaderProps {
  onComplete: () => void;
  systemStatus: any;
}

const STAGES = [
  {
    id: "backend",
    label: "Verifiserer lokal Node/FastAPI-kjerne og minnegrenser",
    icon: Cpu,
  },
  {
    id: "storage",
    label: "Sjekker JSON/JSONL-filsystem og datasettintegritet",
    icon: HardDrive,
  },
  {
    id: "tinyml",
    label: "Initialiserer TinyML nevralmatrisemotor (Dense + Softmax)",
    icon: Database,
  },
  {
    id: "nlp",
    label: "Laster norsk språkstøtte (Bokmål / Nynorsk, æ/ø/å, n-gram)",
    icon: Sparkles,
  },
];

export const SplashLoader: React.FC<SplashLoaderProps> = ({
  onComplete,
  systemStatus,
}) => {
  const [currentStageIdx, setCurrentStageIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStageIdx((prev) => {
        if (prev < STAGES.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(onComplete, 450);
          return prev;
        }
      });
    }, 380);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#090909] p-6 text-[#F4F4F2]"
    >
      <div className="w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111111] p-8 shadow-2xl shadow-black/80">
        {/* Brand header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#8F2BFF] to-[#39D9E6] text-white shadow-lg shadow-[#8F2BFF]/30">
              <Cpu className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-base font-bold tracking-tight text-white">
                  ULTIMATE ORNITH
                </h1>
                <span className="rounded bg-[#8F2BFF]/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#B25CFF]">
                  v1.0
                </span>
              </div>
              <p className="text-xs text-[#A3A3A0]">
                Lokal TinyML Treningsarbeidsflate
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] px-2.5 py-1 font-mono text-[11px] text-[#77F23B]">
            nb-NO
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-xs text-[#A3A3A0]">
            <span>Systeminitialisering</span>
            <span className="font-mono text-white">
              {Math.round(((currentStageIdx + 1) / STAGES.length) * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1F1F1E]">
            <motion.div
              className="h-full bg-gradient-to-r from-[#8F2BFF] via-[#39D9E6] to-[#77F23B]"
              initial={{ width: "0%" }}
              animate={{
                width: `${((currentStageIdx + 1) / STAGES.length) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Stage list */}
        <div className="space-y-3">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isDone = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors ${
                  isCurrent
                    ? "border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] text-white"
                    : isDone
                      ? "text-[#A3A3A0]"
                      : "text-[#555552]"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#77F23B]" />
                ) : (
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isCurrent
                        ? "animate-pulse text-[#39D9E6]"
                        : "text-[#6B6B67]"
                    }`}
                  />
                )}
                <span className="truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] pt-4 text-[11px] text-[#6B6B67]">
          <span>Lokal Edge-arkitektur</span>
          <span className="font-mono">100% Offline-klar</span>
        </div>
      </div>
    </motion.div>
  );
};
