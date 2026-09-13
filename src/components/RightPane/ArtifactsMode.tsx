/**
 * ULTIMATE ORNITH 1.0 — Right Pane: Artifacts Mode
 * 
 * Comprehensive Model Export & Artifact Hub:
 * - TensorFlow Lite (.tflite) binary FlatBuffer export
 * - TensorFlow SavedModel bundle export (saved_model.pb, variables, assets)
 * - Autonomous C/C++ Header (.h) for Microcontrollers (Arduino, ESP32, STM32)
 * - JSON Weights & Vocabulary for Web/Node.js runtimes
 * - Complete Model Package (.zip) with metadata, training configs, evaluation metrics, logs & quickstart scripts
 */

import React, { useState, useEffect } from 'react';
import {
  Package,
  Download,
  FileCode,
  FileJson,
  CheckCircle2,
  Cpu,
  Layers,
  Terminal,
  ExternalLink,
  Sparkles,
  FolderArchive,
  Code2,
  Copy,
  Check,
  BookOpen,
  Info,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  AlertCircle,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import { ModelArtifact, TrainingRun } from '../../types';
import { API } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/i18n';
import { ExportModal } from '../ExportModal';
import { ModelExportController } from './ModelExportController';

interface ArtifactsModeProps {
  activeRun?: TrainingRun | null;
}

export const ArtifactsMode: React.FC<ArtifactsModeProps> = ({ activeRun }) => {
  const [artifacts, setArtifacts] = useState<ModelArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>('tflite');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'exporting'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchArtifacts = async () => {
    setIsLoading(true);
    try {
      const list = await API.listArtifacts();
      setArtifacts(list);
    } catch (err) {
      console.error('Failed to list artifacts', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, [activeRun?.id]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownload = (art: ModelArtifact) => {
    setDownloadingId(art.id);
    const link = document.createElement('a');
    link.href = art.downloadUrl;
    link.setAttribute('download', art.name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingId(null), 1200);
  };

  const handleDownloadBundle = (runId: string, format: 'tflite' | 'saved-model' | 'all') => {
    setDownloadingId(`bundle-${runId}-${format}`);
    let url = '';
    let fileName = '';
    if (format === 'tflite') {
      url = API.getTfliteWithMetricsBundleUrl(runId);
      fileName = `ornith_tflite_metrics_bundle_${runId}.zip`;
    } else if (format === 'saved-model') {
      url = API.getSavedModelWithMetricsBundleUrl(runId);
      fileName = `ornith_savedmodel_metrics_bundle_${runId}.zip`;
    } else {
      url = API.getExportPackageUrl(runId);
      fileName = `ornith_complete_package_${runId}.zip`;
    }

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloadingId(null), 1500);
  };

  // Helper to render format-specific icons
  const getArtifactIcon = (type: ModelArtifact['fileType']) => {
    switch (type) {
      case 'tflite':
        return <Cpu className="h-5 w-5 text-[#39D9E6]" />;
      case 'saved-model':
        return <Layers className="h-5 w-5 text-[#B25CFF]" />;
      case 'c-header':
        return <FileCode className="h-5 w-5 text-[#77F23B]" />;
      case 'zip-package':
        return <FolderArchive className="h-5 w-5 text-[#FF9F0A]" />;
      case 'json-weights':
      default:
        return <FileJson className="h-5 w-5 text-[#A3A3A0]" />;
    }
  };

  // Helper to render format badges
  const getArtifactBadge = (type: ModelArtifact['fileType']) => {
    switch (type) {
      case 'tflite':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#39D9E6]/15 border border-[#39D9E6]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#39D9E6]">
            <Cpu className="h-3 w-3" />
            <span>TensorFlow Lite (.tflite)</span>
          </span>
        );
      case 'saved-model':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#8F2BFF]/15 border border-[#8F2BFF]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#B25CFF]">
            <Layers className="h-3 w-3" />
            <span>TensorFlow SavedModel</span>
          </span>
        );
      case 'c-header':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#77F23B]/15 border border-[#77F23B]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#77F23B]">
            <FileCode className="h-3 w-3" />
            <span>Embedded C/C++ Header (.h)</span>
          </span>
        );
      case 'zip-package':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#FF9F0A]/15 border border-[#FF9F0A]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF9F0A]">
            <FolderArchive className="h-3 w-3" />
            <span>Komplett Eksportpakke (.zip)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-[#222] px-2 py-0.5 font-mono text-[10px] text-[#A3A3A0]">
            <FileJson className="h-3 w-3" />
            <span>{type}</span>
          </span>
        );
    }
  };

  // Helper to get visual status icon and badge
  const getReadinessIndicator = (art: ModelArtifact) => {
    const status = art.status || art.readinessState || 'ready';
    switch (status) {
      case 'ready':
        return {
          label: 'Klar (Ready)',
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#77F23B]" />,
          badgeClass: 'border-[#77F23B]/30 bg-[#77F23B]/10 text-[#77F23B]',
          dotClass: 'bg-[#77F23B]',
          description: 'Modell ferdig validert og klar for distribusjon',
        };
      case 'exporting':
        return {
          label: 'Eksporterer (Exporting)',
          icon: <RefreshCw className="h-3.5 w-3.5 text-[#FF9F0A] animate-spin" />,
          badgeClass: 'border-[#FF9F0A]/30 bg-[#FF9F0A]/10 text-[#FF9F0A]',
          dotClass: 'bg-[#FF9F0A] animate-pulse',
          description: 'Serialiserer og pakker artefakt',
        };
      case 'pending':
      case 'stale':
        return {
          label: 'Venter / Arkivert',
          icon: <Clock className="h-3.5 w-3.5 text-[#A3A3A0]" />,
          badgeClass: 'border-[#A3A3A0]/30 bg-[#A3A3A0]/10 text-[#A3A3A0]',
          dotClass: 'bg-[#A3A3A0]',
          description: 'Tidligere versjon eller venter på kompilering',
        };
      case 'failed':
        return {
          label: 'Feilet (Failed)',
          icon: <AlertCircle className="h-3.5 w-3.5 text-[#FF453A]" />,
          badgeClass: 'border-[#FF453A]/30 bg-[#FF453A]/10 text-[#FF453A]',
          dotClass: 'bg-[#FF453A]',
          description: 'Eksport feilet under kompilering',
        };
      default:
        return {
          label: 'Klar (Ready)',
          icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#77F23B]" />,
          badgeClass: 'border-[#77F23B]/30 bg-[#77F23B]/10 text-[#77F23B]',
          dotClass: 'bg-[#77F23B]',
          description: 'Klar for distribusjon',
        };
    }
  };

  const readyCount = artifacts.filter((a) => (a.status || a.readinessState || 'ready') === 'ready').length;
  const exportingCount = artifacts.filter((a) => (a.status || a.readinessState) === 'exporting').length;

  const filteredArtifacts = artifacts.filter((art) => {
    if (statusFilter === 'all') return true;
    const st = art.status || art.readinessState || 'ready';
    return st === statusFilter;
  });

  const tfliteSnippet = `import numpy as np
import tensorflow.lite as tflite

# 1. Last modellen
interpreter = tflite.Interpreter(model_path="ornith_model.tflite")
interpreter.allocate_tensors()

# 2. Hent inn- og utgangsdetaljer
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# 3. Klargjør input (BOW/TF-IDF vektor tilpasset norsk vokabular)
sample_input = np.zeros(input_details[0]['shape'], dtype=np.float32)
interpreter.set_tensor(input_details[0]['index'], sample_input)

# 4. Utfør inferens
interpreter.invoke()
output_probs = interpreter.get_tensor(output_details[0]['index'])[0]
print("Klasse-sannsynligheter:", output_probs)`;

  const arduinoSnippet = `#include "ornith_tinyml_model.h"

void setup() {
  Serial.begin(115200);
}

void loop() {
  static float input_features[ORNITH_INPUT_DIM] = {0};
  static float probabilities[ORNITH_OUTPUT_DIM];

  // ornith_predict utfører inferens uten dynamisk heapallokering
  int predicted_class = ornith_predict(input_features, probabilities);

  Serial.print("Predikert klasse: ");
  Serial.println(ORNITH_CLASS_LABELS[predicted_class]);
  delay(1000);
}`;

  const savedModelSnippet = `import tensorflow as tf

# Last SavedModel direkte
model = tf.saved_model.load("saved_model")
infer = model.signatures["serving_default"]

# Utfør prediksjon med input_vector signaturen
test_input = tf.zeros([1, 256], dtype=tf.float32)
predictions = infer(input_vector=test_input)
print(predictions["probabilities"].numpy())`;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#0E0E0D] custom-scrollbar p-6 text-[#F4F4F2]">
      {/* Header with Export CTA */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-[#8F2BFF]" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Modellartefakter & TensorFlow-eksport
            </h1>
            <span className="rounded bg-[#8F2BFF]/20 px-2 py-0.5 font-mono text-xs font-semibold text-[#B25CFF]">
              TFLite, SavedModel & C++
            </span>
          </div>
          <p className="mt-1 text-xs text-[#A3A3A0] max-w-2xl">
            Eksporter ferdigtrente modeller i universelle formater: <strong>TensorFlow Lite (.tflite)</strong> for edge-enheter, <strong>TensorFlow SavedModel</strong> for TF-Serving, og <strong>C-Header</strong> for mikrokontrollere. Pakken inkluderer metadata, konfigurasjon, evalueringsmetrikker og logger.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#8F2BFF]/20 transition-all hover:opacity-95"
          >
            <FolderArchive className="h-4 w-4" />
            <span>Avansert Pakkedialog (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Multi-Format Model Export Controller */}
      <div className="mb-8">
        <ModelExportController
          activeRun={activeRun || null}
          onOpenFullModal={() => setIsExportModalOpen(true)}
        />
      </div>

      {/* Artifacts List */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Genererte Filer & Modeller ({artifacts.length})
            </h2>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="flex items-center gap-1 rounded-full bg-[#77F23B]/10 px-2 py-0.5 text-[10px] font-medium text-[#77F23B] border border-[#77F23B]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#77F23B]"></span>
                {readyCount} Klar
              </span>
              {exportingCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-[#FF9F0A]/10 px-2 py-0.5 text-[10px] font-medium text-[#FF9F0A] border border-[#FF9F0A]/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF9F0A] animate-pulse"></span>
                  {exportingCount} Eksporterer
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center rounded-lg bg-[#181818] p-0.5 border border-[rgba(255,255,255,0.08)]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-[#282828] text-white shadow-sm'
                    : 'text-[#888] hover:text-[#CCC]'
                }`}
              >
                Alle ({artifacts.length})
              </button>
              <button
                onClick={() => setStatusFilter('ready')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  statusFilter === 'ready'
                    ? 'bg-[#77F23B]/20 text-[#77F23B] shadow-sm'
                    : 'text-[#888] hover:text-[#CCC]'
                }`}
              >
                <CheckCircle2 className="h-3 w-3 text-[#77F23B]" />
                Klare ({readyCount})
              </button>
              {exportingCount > 0 && (
                <button
                  onClick={() => setStatusFilter('exporting')}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                    statusFilter === 'exporting'
                      ? 'bg-[#FF9F0A]/20 text-[#FF9F0A] shadow-sm'
                      : 'text-[#888] hover:text-[#CCC]'
                  }`}
                >
                  <RefreshCw className="h-3 w-3 text-[#FF9F0A] animate-spin" />
                  Eksporterer ({exportingCount})
                </button>
              )}
            </div>

            <button
              onClick={fetchArtifacts}
              disabled={isLoading}
              className="flex items-center gap-1 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#181818] px-2.5 py-1 text-[11px] text-[#8F2BFF] hover:bg-[#202020] disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Oppdater</span>
            </button>
          </div>
        </div>

        {filteredArtifacts.length > 0 ? (
          <div className="space-y-3">
            {filteredArtifacts.map((art) => {
              const indicator = getReadinessIndicator(art);
              const isDownloading = downloadingId === art.id;

              return (
                <div
                  key={art.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4 transition-all hover:border-[rgba(255,255,255,0.14)] hover:bg-[#161616]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A1A1A] text-white border border-[rgba(255,255,255,0.08)]">
                      {getArtifactIcon(art.fileType)}
                      {/* Readiness status dot on format icon corner */}
                      <span
                        className={`absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border border-[#141414] ${indicator.dotClass}`}
                        title={indicator.label}
                      />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{art.name}</span>
                        {getArtifactBadge(art.fileType)}
                        {/* Visual Readiness state badge with status icon */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${indicator.badgeClass}`}
                          title={indicator.description}
                        >
                          {indicator.icon}
                          <span>{indicator.label}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#A3A3A0] max-w-xl">{art.description}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-[#777]">
                        <span>Størrelse: <strong className="text-[#CCC]">{formatBytes(art.sizeBytes)}</strong></span>
                        <span>•</span>
                        <span>Generert: {formatDateTime(art.createdAt)}</span>
                        {art.runId && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[#888]">Økt: {art.runId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Secondary: If it's a trained model artifact with a runId, allow packaging with metrics & metadata */}
                    {art.runId && (art.fileType === 'tflite' || art.fileType === 'saved-model') && (
                      <button
                        onClick={() =>
                          handleDownloadBundle(
                            art.runId!,
                            art.fileType === 'tflite' ? 'tflite' : 'saved-model'
                          )
                        }
                        disabled={downloadingId === `bundle-${art.runId}-${art.fileType}`}
                        className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#191918] px-3 py-2 text-xs font-semibold text-[#A3A3A0] transition-all hover:border-[rgba(255,255,255,0.25)] hover:bg-[#222221] hover:text-white disabled:opacity-60"
                        title="Pakk modellfilen sammen med metadata.json, MODEL_CARD.md og evaluation_metrics.json i en ZIP"
                      >
                        {downloadingId === `bundle-${art.runId}-${art.fileType}` ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#8F2BFF]" />
                        ) : (
                          <Package className="h-3.5 w-3.5 text-[#8F2BFF]" />
                        )}
                        <span>Pakk med metrikker (.zip)</span>
                      </button>
                    )}

                    {/* Primary: Direct Model File Download Trigger */}
                    <button
                      onClick={() => handleDownload(art)}
                      disabled={isDownloading}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1F1F1E] border border-[rgba(255,255,255,0.1)] px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-[#282828] hover:border-[rgba(255,255,255,0.2)] disabled:opacity-60"
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 text-[#39D9E6] animate-spin" />
                          <span>Laster ned...</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5 text-[#39D9E6]" />
                          <span>Last ned fil</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#121212] p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-[#555] mb-2" />
            <h3 className="text-xs font-bold text-white">Ingen artefakter matcher filteret</h3>
            <p className="mt-1 text-xs text-[#888] max-w-md mx-auto">
              {statusFilter === 'exporting'
                ? 'Ingen modeller eksporteres akkurat nå. Alle tilgjengelige modeller er ferdig kompilert og klare.'
                : 'Start en treningsøkt under Trening for å produsere TensorFlow Lite, SavedModel, C-header og komplett eksportpakke automatisk.'}
            </p>
          </div>
        )}
      </div>

      {/* Interactive Quickstart Code Drawer */}
      <div className="mb-8 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-[#39D9E6]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white">
              Hurtigstart & Inferenskode
            </h2>
          </div>
          <span className="text-[11px] text-[#A3A3A0]">
            Klar-til-bruk kode for dine eksporterte modeller
          </span>
        </div>

        {/* Snippet Selector Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3 mb-4">
          <button
            onClick={() => setExpandedSnippet('tflite')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              expandedSnippet === 'tflite'
                ? 'bg-[#39D9E6]/20 text-[#39D9E6] border border-[#39D9E6]/30'
                : 'text-[#A3A3A0] hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Python (TensorFlow Lite)</span>
          </button>

          <button
            onClick={() => setExpandedSnippet('savedmodel')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              expandedSnippet === 'savedmodel'
                ? 'bg-[#8F2BFF]/20 text-[#B25CFF] border border-[#8F2BFF]/30'
                : 'text-[#A3A3A0] hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>TensorFlow SavedModel</span>
          </button>

          <button
            onClick={() => setExpandedSnippet('arduino')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              expandedSnippet === 'arduino'
                ? 'bg-[#77F23B]/20 text-[#77F23B] border border-[#77F23B]/30'
                : 'text-[#A3A3A0] hover:text-white'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Arduino / ESP32 (C++)</span>
          </button>
        </div>

        {/* Snippet Box */}
        <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#090909] p-4">
          <button
            onClick={() => {
              const text =
                expandedSnippet === 'tflite'
                  ? tfliteSnippet
                  : expandedSnippet === 'savedmodel'
                  ? savedModelSnippet
                  : arduinoSnippet;
              handleCopy(expandedSnippet || 'code', text);
            }}
            className="absolute right-3 top-3 flex items-center gap-1 rounded bg-[#1F1F1E] px-2.5 py-1 text-[11px] text-[#A3A3A0] transition-colors hover:bg-[#2A2A2A] hover:text-white"
          >
            {copiedKey === expandedSnippet ? (
              <>
                <Check className="h-3 w-3 text-[#77F23B]" />
                <span className="text-[#77F23B]">Kopiert!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Kopier kode</span>
              </>
            )}
          </button>

          <pre className="font-mono text-[11px] text-[#E0E0DC] overflow-x-auto leading-5 custom-scrollbar pr-20">
            {expandedSnippet === 'tflite' && tfliteSnippet}
            {expandedSnippet === 'savedmodel' && savedModelSnippet}
            {expandedSnippet === 'arduino' && arduinoSnippet}
          </pre>
        </div>
      </div>

      {/* Comprehensive Deployment Documentation */}
      <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
        <div className="mb-4 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#8F2BFF]" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Distribusjons- & Integrasjonsveiledning
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 text-xs text-[#A3A3A0]">
          {/* Edge / TFLite */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-[#39D9E6]" />
              <span>1. TensorFlow Lite & Edge Runtime</span>
            </h3>
            <p className="leading-relaxed">
              Filen <code className="font-mono text-[#39D9E6]">ornith_model.tflite</code> bruker offisielle TFL3 FlatBuffer-tabeller og kan lastes direkte med Python, C++ TFLite API, eller Android TFLite interpreter. Den støtter on-device inferens med lav latens (&lt; 2 ms) på Raspberry Pi og edge-akseleratorer.
            </p>
          </div>

          {/* Cloud / SavedModel */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-[#B25CFF]" />
              <span>2. TensorFlow SavedModel & TF-Serving</span>
            </h3>
            <p className="leading-relaxed">
              Mappen <code className="font-mono text-[#B25CFF]">saved_model/</code> inneholder en standard TensorFlow 2.x modell med <code className="text-white">serving_default</code> signatur. Den kan serveres via Docker TF-Serving for produksjons-REST eller gRPC endpoints med automatisk batching.
            </p>
          </div>

          {/* Microcontroller */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-[#77F23B]" />
              <span>3. Arduino Nano 33 BLE / ESP32 (C/C++)</span>
            </h3>
            <p className="leading-relaxed">
              Inkluder <code className="font-mono text-[#77F23B]">ornith_tinyml_model.h</code> direkte i prosjektet ditt. Koden er skrevet i ren C99 uten avhengigheter til eksterne biblioteker, og modellvektene legges i mikrokontrollerens Flash-minne (<code className="text-white">PROGMEM</code>).
            </p>
          </div>

          {/* Metadata & Governance */}
          <div className="space-y-2">
            <h3 className="font-semibold text-white flex items-center gap-1.5">
              <FolderArchive className="h-3.5 w-3.5 text-[#FF9F0A]" />
              <span>4. Sporbarhet & Modellkort (GDPR)</span>
            </h3>
            <p className="leading-relaxed">
              Den komplette ZIP-pakken inneholder <code className="font-mono text-white">MODEL_CARD.md</code> og <code className="font-mono text-white">metadata.json</code> som dokumenterer treningsdata, hyperparametre, dialektdekning og konfidensgrenser i henhold til etiske TinyML-standarder.
            </p>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        run={activeRun || (artifacts[0] ? { id: artifacts[0].runId } as any : null)}
      />
    </div>
  );
};
