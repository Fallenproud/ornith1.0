/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Files Mode
 *
 * Interactive project file explorer & code viewer/editor with live save.
 */

import React, { useState, useEffect } from "react";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  Search,
  Save,
  Check,
  RefreshCw,
  Clock,
  HardDrive,
} from "lucide-react";
import { FileTreeItem } from "../../types";
import { API } from "../../lib/api";
import { formatBytes, formatTimeOnly } from "../../lib/i18n";

export const FilesMode: React.FC = () => {
  const [tree, setTree] = useState<FileTreeItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>(
    "server/tinyml_engine.ts",
  );
  const [fileContent, setFileContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    new Set(["", "server", "src"]),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const loadTree = async () => {
    try {
      const data = await API.getFileTree();
      setTree(data);
    } catch (e) {
      console.error("Failed to load file tree", e);
    }
  };

  const loadFileContent = async (path: string) => {
    setIsLoadingFile(true);
    try {
      const res = await API.getFileContent(path);
      setFileContent(res.content);
      setSelectedFile(path);
    } catch (e) {
      console.error("Failed to read file", e);
    } finally {
      setIsLoadingFile(false);
    }
  };

  useEffect(() => {
    loadTree();
    loadFileContent("server/tinyml_engine.ts");
  }, []);

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await API.saveFileContent(selectedFile, fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error("Failed to save file", e);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderTree = (
    item: FileTreeItem,
    depth: number = 0,
  ): React.ReactNode => {
    if (
      searchQuery &&
      !item.isDirectory &&
      !item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return null;
    }

    const isExpanded = expandedPaths.has(item.path);
    const isSelected = selectedFile === item.path;

    if (item.isDirectory) {
      return (
        <div key={item.id} className="select-none">
          <div
            onClick={() => toggleExpand(item.path)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="flex cursor-pointer items-center gap-1.5 py-1 text-xs text-[#A3A3A0] transition-colors hover:bg-[#1A1A1A] hover:text-white"
          >
            {isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#8F2BFF]" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0 text-[#A3A3A0]" />
            )}
            <span className="truncate font-mono">{item.name}</span>
          </div>
          {isExpanded && item.children && (
            <div>
              {item.children.map((child) => renderTree(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    const getFileIcon = () => {
      if (item.name.endsWith(".ts") || item.name.endsWith(".tsx")) {
        return <FileCode className="h-3.5 w-3.5 shrink-0 text-[#39D9E6]" />;
      }
      if (item.name.endsWith(".json") || item.name.endsWith(".jsonl")) {
        return <FileJson className="h-3.5 w-3.5 shrink-0 text-[#B25CFF]" />;
      }
      return <FileText className="h-3.5 w-3.5 shrink-0 text-[#A3A3A0]" />;
    };

    return (
      <div
        key={item.id}
        onClick={() => loadFileContent(item.path)}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`flex cursor-pointer items-center justify-between py-1 pr-2 text-xs transition-colors ${
          isSelected
            ? "border-l-2 border-[#8F2BFF] bg-[#1F1F1E] font-medium text-white"
            : "text-[#C5C5C2] hover:bg-[#1A1A1A] hover:text-white"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          {getFileIcon()}
          <span className="truncate font-mono text-[11px]">{item.name}</span>
        </div>
        {item.sizeBytes !== undefined && (
          <span className="font-mono text-[9px] text-[#666]">
            {formatBytes(item.sizeBytes)}
          </span>
        )}
      </div>
    );
  };

  const lines = fileContent.split("\n");

  return (
    <div className="flex h-full overflow-hidden bg-[#111111]">
      {/* Left sidebar: File Tree */}
      <div className="w-64 shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[#0D0D0C] flex flex-col">
        {/* Search & Actions */}
        <div className="border-b border-[rgba(255,255,255,0.06)] p-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#666]" />
            <input
              type="text"
              placeholder="Filtrer filer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[rgba(255,255,255,0.08)] bg-[#171717] py-1 pl-8 pr-2 text-xs text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>
        </div>

        {/* Tree Container */}
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
          {tree ? (
            renderTree(tree)
          ) : (
            <div className="p-4 text-xs text-[#666]">Laster filtre...</div>
          )}
        </div>

        <div className="border-t border-[rgba(255,255,255,0.06)] p-2 text-[10px] text-[#555] flex justify-between">
          <span>Lokal arbeidsmappe</span>
          <button
            onClick={loadTree}
            className="hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="h-2.5 w-2.5" /> Oppdater
          </button>
        </div>
      </div>

      {/* Right area: Code Viewer / Editor */}
      <div className="flex flex-1 flex-col overflow-hidden bg-[#0A0A09]">
        {/* Editor Top Bar */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#141414] px-4">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-[#39D9E6]" />
            <span className="font-mono text-xs font-semibold text-white">
              {selectedFile}
            </span>
            <span className="rounded bg-[#222] px-1.5 py-0.5 font-mono text-[10px] text-[#888]">
              {lines.length} linjer
            </span>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccess && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-[#77F23B]">
                <Check className="h-3 w-3" /> Lagret
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving || isLoadingFile}
              className="flex items-center gap-1.5 rounded-md bg-[#8F2BFF] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[#A347FF] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Lagrer..." : "Lagre endringer"}</span>
            </button>
          </div>
        </div>

        {/* Code Editor Body with Line Numbers */}
        <div className="flex flex-1 overflow-auto custom-scrollbar font-mono text-xs">
          {/* Line numbers column */}
          <div className="select-none bg-[#0D0D0C] py-3 pl-3 pr-2 text-right text-[11px] text-[#444] border-r border-[rgba(255,255,255,0.04)]">
            {lines.map((_, i) => (
              <div key={i} className="leading-5">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Editable text container */}
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            spellCheck={false}
            className="flex-1 resize-none bg-transparent p-3 leading-5 text-[#E0E0DC] focus:outline-none selection:bg-[#8F2BFF]/30"
          />
        </div>
      </div>
    </div>
  );
};
