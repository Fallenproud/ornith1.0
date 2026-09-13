/**
 * ULTIMATE ORNITH 1.0 — Dataset Upload & Norwegian Parser Modal
 */

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { API } from '../lib/api';
import { DatasetMetadata, ProjectMetadata } from '../types';

interface UploadDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (meta: DatasetMetadata) => void;
  activeProject?: ProjectMetadata | null;
}

export const UploadDatasetModal: React.FC<UploadDatasetModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  activeProject,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState<string>('');
  const [datasetName, setDatasetName] = useState<string>('');
  const [dialect, setDialect] = useState<'Bokmål' | 'Nynorsk'>('Bokmål');
  const [filterInvalid, setFilterInvalid] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleFileRead = (selectedFile: File) => {
    setFile(selectedFile);
    if (!datasetName) {
      setDatasetName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setContent(text || '');
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileRead(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !datasetName.trim()) return;

    setIsUploading(true);
    setErrorMsg(null);
    try {
      const ext = file?.name.split('.').pop() || 'jsonl';
      const result = await API.uploadDataset({
        name: datasetName.trim(),
        filename: file?.name || `${datasetName}.jsonl`,
        content,
        format: ext,
        dialect,
        projectId: activeProject?.id,
        filterInvalid,
      });
      onUploadSuccess(result.meta);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Opplasting feilet');
    } finally {
      setIsUploading(false);
    }
  };

  // Preview metrics
  const linesCount = content ? content.split('\n').filter((l) => l.trim()).length : 0;
  const norChars = content ? (content.match(/[æøåÆØÅ]/g) || []).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-[#39D9E6]" />
            <h2 className="text-sm font-bold text-white">Importer Norsk Datasett</h2>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#FF453A]/30 bg-[#FF453A]/10 p-3 text-xs text-[#FF453A]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? 'border-[#8F2BFF] bg-[#8F2BFF]/10'
                : 'border-[rgba(255,255,255,0.1)] bg-[#171717] hover:border-[rgba(255,255,255,0.2)]'
            }`}
          >
            <FileText className="mb-2 h-8 w-8 text-[#8F2BFF]" />
            <p className="text-xs font-medium text-white">
              {file ? file.name : 'Dra og slipp en JSONL-, CSV- eller JSON-fil her'}
            </p>
            <p className="mt-1 text-[11px] text-[#888]">eller trykk for å velge fra filutforsker</p>
            <input
              type="file"
              accept=".jsonl,.csv,.json,.txt"
              onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])}
              className="mt-3 cursor-pointer text-[11px] text-[#A3A3A0] file:mr-2 file:rounded-md file:border-0 file:bg-[#1F1F1E] file:px-2.5 file:py-1 file:text-xs file:text-white hover:file:bg-[#2A2A28]"
            />
          </div>

          {/* Dataset Live Stats Preview */}
          {content && (
            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] p-3 text-[11px]">
              <span className="text-[#A3A3A0]">
                Rader funnet: <strong className="font-mono text-white">{linesCount}</strong>
              </span>
              <span className="flex items-center gap-1 text-[#77F23B]">
                <Sparkles className="h-3 w-3" />
                <span>Norske spesialtegn: <strong className="font-mono">{norChars}</strong></span>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-[#E0E0DC]">Datasettnavn</label>
              <input
                type="text"
                required
                placeholder="f.eks. Norsk IoT Stemmekommandoer"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2 text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-medium text-[#E0E0DC]">Språkform</label>
              <select
                value={dialect}
                onChange={(e) => setDialect(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2 text-white focus:outline-none"
              >
                <option value="Bokmål">Norsk Bokmål (nb-NO)</option>
                <option value="Nynorsk">Norsk Nynorsk (nn-NO)</option>
              </select>
            </div>
          </div>

          {/* Project Validation Rules Banner */}
          <div className="rounded-lg border border-[#8F2BFF]/20 bg-[#8F2BFF]/10 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <ShieldCheck className="h-4 w-4 text-[#B25CFF]" />
              <span>Automatisk Norsk Valideringsmotor</span>
            </div>
            <p className="mt-1 text-[11px] text-[#A3A3A0]">
              Datasettet sjekkes automatisk mot gjeldende prosjektregler for æ/ø/å, mojibake,
              ordlengde og kolonnestruktur.
            </p>
            <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[11px] text-white">
              <input
                type="checkbox"
                checked={filterInvalid}
                onChange={(e) => setFilterInvalid(e.target.checked)}
                className="rounded border-[#444] bg-[#222] text-[#8F2BFF] focus:ring-0"
              />
              <span>Filtrer automatisk bort rader med kritiske valideringsfeil</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-transparent px-4 py-2 text-xs text-[#A3A3A0] hover:text-white"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isUploading || !content.trim() || !datasetName.trim()}
              className="rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8F2BFF]/20 hover:bg-[#A347FF] disabled:opacity-50"
            >
              {isUploading ? 'Analyserer & Lagrer...' : 'Valider & Importer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
