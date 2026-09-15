/**
 * ULTIMATE ORNITH 1.0 — Workspace Header
 */

import React from "react";
import {
  FolderGit2,
  Plus,
  Cpu,
  Sparkles,
  Sun,
  Moon,
  Activity,
  HardDrive,
  ChevronDown,
} from "lucide-react";
import { ProjectMetadata, RuntimeSystemStatus, AuthUser } from "../types";
import { UserAuthBadge } from "./UserAuthBadge";

interface HeaderProps {
  projects: ProjectMetadata[];
  activeProject: ProjectMetadata | null;
  onSelectProject: (proj: ProjectMetadata) => void;
  onNewProjectClick: () => void;
  systemStatus: RuntimeSystemStatus | null;
  isDark: boolean;
  onToggleTheme: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  useThinking: boolean;
  onToggleThinking: () => void;
  authUser: AuthUser | null;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onNewProjectClick,
  systemStatus,
  isDark,
  onToggleTheme,
  selectedModel,
  onSelectModel,
  useThinking,
  onToggleThinking,
  authUser,
  onOpenAuthModal,
}) => {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#111111] px-4">
      {/* Left: Brand & Project Selector */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8F2BFF] to-[#39D9E6] text-white shadow-md shadow-[#8F2BFF]/20">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-mono text-sm font-bold tracking-tight text-white">
                ORNITH
              </span>
              <span className="rounded bg-[#8F2BFF]/20 px-1 py-0.5 font-mono text-[9px] font-semibold text-[#B25CFF]">
                1.0
              </span>
            </div>
            <span className="text-[10px] text-[#A3A3A0]">TinyML Studio</span>
          </div>
        </div>

        <div className="h-4 w-px bg-[rgba(255,255,255,0.1)]" />

        {/* Project Dropdown */}
        <div className="relative flex items-center">
          <FolderGit2 className="mr-1.5 h-3.5 w-3.5 text-[#39D9E6]" />
          <select
            value={activeProject?.id || ""}
            onChange={(e) => {
              const selected = projects.find((p) => p.id === e.target.value);
              if (selected) onSelectProject(selected);
            }}
            className="cursor-pointer appearance-none rounded-md border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] py-1 pl-2.5 pr-7 font-sans text-xs font-medium text-white transition-colors hover:border-[#8F2BFF]/50 focus:border-[#8F2BFF] focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-[#A3A3A0]" />
        </div>

        <button
          onClick={onNewProjectClick}
          title="Opprett nytt prosjekt"
          className="flex items-center gap-1 rounded-md border border-dashed border-[rgba(255,255,255,0.15)] bg-transparent px-2 py-1 text-xs text-[#A3A3A0] transition-colors hover:border-white hover:text-white"
        >
          <Plus className="h-3 w-3" />
          <span>Ny</span>
        </button>
      </div>

      {/* Right: AI Model, Status & Theme */}
      <div className="flex items-center gap-3">
        {/* Model Selector Pill */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2 py-1 text-xs">
          <Sparkles className="h-3.5 w-3.5 text-[#8F2BFF]" />
          <select
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
            className="cursor-pointer bg-transparent font-mono text-[11px] text-[#F4F4F2] focus:outline-none"
          >
            <option
              value="gemini-3.8-flash"
              className="bg-[#1A1A1A] text-white"
            >
              Gemini 3.8 Flash (Anbefalt)
            </option>
            <option
              value="gemini-3.1-pro-preview"
              className="bg-[#1A1A1A] text-white"
            >
              Gemini 3.1 Pro (Resonnering)
            </option>
            <option
              value="gemini-3.1-flash-lite"
              className="bg-[#1A1A1A] text-white"
            >
              Gemini 3.1 Flash-Lite (Lav latens)
            </option>
            <option
              value="local-ornith-engine"
              className="bg-[#1A1A1A] text-white"
            >
              Lokal Ornith Motor (Offline)
            </option>
          </select>

          {selectedModel === "gemini-3.1-pro-preview" && (
            <button
              onClick={onToggleThinking}
              title="Aktiver dyp resonnering (ThinkingLevel.HIGH)"
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors ${
                useThinking
                  ? "bg-[#8F2BFF] text-white"
                  : "bg-[rgba(255,255,255,0.06)] text-[#A3A3A0] hover:text-white"
              }`}
            >
              Thinking: {useThinking ? "PÅ" : "AV"}
            </button>
          )}
        </div>

        {/* Runtime Diagnostics Pill */}
        <div className="hidden items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2.5 py-1 text-xs sm:flex">
          <div className="flex items-center gap-1 text-[11px] text-[#A3A3A0]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#77F23B]" />
            <span className="font-mono">Kjerne OK</span>
          </div>
          <span className="text-[#444]">|</span>
          <div className="flex items-center gap-1 text-[11px] text-[#A3A3A0]">
            <HardDrive className="h-3 w-3 text-[#39D9E6]" />
            <span className="font-mono">
              {systemStatus?.memoryUsageMb || 120} MB
            </span>
          </div>
        </div>

        {/* Norwegian Locale Pill */}
        <span className="rounded border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-2 py-1 font-mono text-[11px] font-medium text-[#77F23B]">
          nb-NO
        </span>

        {/* OAuth2 User Authentication Badge */}
        <UserAuthBadge user={authUser} onOpenAuthModal={onOpenAuthModal} />

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          title={isDark ? "Bytt til lys modus" : "Bytt til mørk modus"}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] text-[#A3A3A0] transition-colors hover:text-white"
        >
          {isDark ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </header>
  );
};
