/**
 * ULTIMATE ORNITH 1.0 — Project Creation Modal
 */

import React, { useState } from "react";
import { X, FolderPlus, Cpu, Layers } from "lucide-react";
import { ProjectMetadata, DatasetMetadata } from "../types";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Partial<ProjectMetadata>) => void;
  datasets: DatasetMetadata[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  datasets,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [targetArchitecture, setTargetArchitecture] = useState<
    "tinyml-dense" | "tinyml-cnn1d"
  >("tinyml-dense");
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    datasets[0]?.id || "",
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({
      name: name.trim(),
      description:
        description.trim() || "Lokalt TinyML eksperiment for kantprosessering.",
      targetArchitecture,
      datasetId: selectedDatasetId,
      locale: "nb-NO",
    });
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-[#8F2BFF]" />
            <h2 className="text-sm font-bold text-white">
              Opprett Nytt Norsk Prosjekt
            </h2>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#E0E0DC]">
              Prosjektnavn
            </label>
            <input
              type="text"
              required
              placeholder="f.eks. Norsk Stemmestyring for ESP32"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-[#E0E0DC]">
              Beskrivelse
            </label>
            <textarea
              rows={2}
              placeholder="Beskriv formålet med modellen..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 text-white placeholder-[#555] focus:border-[#8F2BFF] focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-medium text-[#E0E0DC]">
              Målarkitektur
            </label>
            <select
              value={targetArchitecture}
              onChange={(e) => setTargetArchitecture(e.target.value as any)}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 text-white focus:outline-none"
            >
              <option value="tinyml-dense">
                TinyML Dense (Softmax, &lt; 8 KB RAM)
              </option>
              <option value="tinyml-cnn1d">
                TinyML 1D-CNN (Edge n-gram, &lt; 16 KB RAM)
              </option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#E0E0DC]">
              Koblet Datasett
            </label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] p-2.5 text-white focus:outline-none"
            >
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.name} ({ds.rowCount} rader)
                </option>
              ))}
            </select>
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
              disabled={!name.trim()}
              className="rounded-lg bg-[#8F2BFF] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#8F2BFF]/20 hover:bg-[#A347FF] disabled:opacity-50"
            >
              Opprett prosjekt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
