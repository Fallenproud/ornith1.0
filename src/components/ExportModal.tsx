/**
 * ULTIMATE ORNITH 1.0 — Comprehensive Model Export Modal
 * 
 * Supports exporting trained TinyML models in:
 * - TensorFlow Lite (.tflite)
 * - TensorFlow SavedModel format (saved_model bundle)
 * - C/C++ Header for microcontrollers
 * - Metadata, Model Card, Training Configs, Evaluation Metrics & Logs package
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Package,
  Cpu,
  Layers,
  FileCode,
  FileJson,
  FileText,
  Terminal,
  Check,
  Sparkles,
  ExternalLink,
  Code2,
  Copy,
  Info,
  CheckCircle2,
  FolderArchive,
  BarChart3,
  Sliders,
} from 'lucide-react';
import {
  TrainingRun,
  ExportPackageOptions,
  ExportPreviewInfo,
  ModelArtifact,
} from '../types';
import { API } from '../lib/api';
import { formatBytes, formatDateTime } from '../lib/i18n';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  run: TrainingRun | null;
  allRuns?: TrainingRun[];
  onSelectRun?: (runId: string) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  run,
  allRuns = [],
  onSelectRun,
}) => {
  const [selectedRunId, setSelectedRunId] = useState<string>(run?.id || '');
  const [options, setOptions] = useState<Required<ExportPackageOptions>>({
    includeTflite: true,
    includeSavedModel: true,
    includeCHeader: true,
    includeJsonWeights: true,
    includeMetadata: true,
    includeTrainingConfig: true,
    includeEvaluationMetrics: true,
    includeLogs: true,
    includeScripts: true,
  });

  const [previewInfo, setPreviewInfo] = useState<ExportPreviewInfo | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'options' | 'manifest' | 'snippets'>('options');
  const [snippetTab, setSnippetTab] = useState<'python-tflite' | 'savedmodel' | 'arduino' | 'serving'>('python-tflite');

  useEffect(() => {
    if (run?.id) {
      setSelectedRunId(run.id);
    } else if (allRuns.length > 0 && !selectedRunId) {
      setSelectedRunId(allRuns[0].id);
    }
  }, [run?.id, allRuns]);

  useEffect(() => {
    if (!isOpen || !selectedRunId) return;

    let isMounted = true;
    setIsLoadingPreview(true);
    API.getExportPreview(selectedRunId)
      .then((data) => {
        if (isMounted) {
          setPreviewInfo(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load export preview:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedRunId]);

  if (!isOpen) return null;

  const currentRun = allRuns.find((r) => r.id === selectedRunId) || run;

  const toggleOption = (key: keyof ExportPackageOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadFullPackage = () => {
    if (!selectedRunId) return;
    setIsDownloading(true);
    const url = API.getExportPackageUrl(selectedRunId, options);
    window.location.href = url;
    setTimeout(() => setIsDownloading(false), 1500);
  };

  // Filter preview files based on user toggle selection
  const filteredFiles = (previewInfo?.files || []).filter((f) => {
    if (f.category === 'model') {
      if (f.path.endsWith('.tflite') && !options.includeTflite) return false;
      if (f.path.includes('saved_model') && !options.includeSavedModel) return false;
      if (f.path.endsWith('.h') && !options.includeCHeader) return false;
      if (f.path.endsWith('weights.json') && !options.includeJsonWeights) return false;
    }
    if (f.category === 'metadata' && !options.includeMetadata) return false;
    if (f.category === 'training' && !options.includeTrainingConfig) return false;
    if (f.category === 'evaluation' && !options.includeEvaluationMetrics) return false;
    if (f.category === 'logs' && !options.includeLogs) return false;
    if (f.category === 'script' && !options.includeScripts) return false;
    return true;
  });

  const estimatedTotalSize = filteredFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

  const pythonSnippet = `import numpy as np
import tensorflow.lite as tflite

# 1. Last TFLite modellen
interpreter = tflite.Interpreter(model_path="model.tflite")
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# 2. Preprosesser norsk tekst til feature-vektor
# input_vector har formen [1, ${currentRun?.modelConfig?.maxVocabSize || 256}]
input_data = np.zeros(input_details[0]['shape'], dtype=np.float32)
interpreter.set_tensor(input_details[0]['index'], input_data)

# 3. Kjør inferens
interpreter.invoke()
output_probs = interpreter.get_tensor(output_details[0]['index'])[0]

best_class_idx = int(np.argmax(output_probs))
print(f"Predikert norsk intent: {best_class_idx} (Konfidens: {output_probs[best_class_idx]*100:.1f}%)")`;

  const savedModelSnippet = `import tensorflow as tf

# 1. Last SavedModel direkte fra mappe
model = tf.saved_model.load("saved_model")
infer = model.signatures["serving_default"]

# 2. Utfør prediksjon med input_vector
# Eksempel med batch-størrelse 1
dummy_input = tf.zeros([1, ${currentRun?.modelConfig?.maxVocabSize || 256}], dtype=tf.float32)
predictions = infer(input_vector=dummy_input)

probabilities = predictions["probabilities"].numpy()[0]
print("Klassifiseringssannsynligheter:", probabilities)`;

  const arduinoSnippet = `#include "ornith_tinyml_model.h"

void setup() {
  Serial.begin(115200);
}

void loop() {
  // Statisk BSS allokering (ingen malloc, 0 bytes heap fragmentation)
  static float input_features[ORNITH_INPUT_DIM];
  static float probabilities[ORNITH_OUTPUT_DIM];

  // Fyll input_features fra sensor, I2S mikrofon eller BLE...
  int intent_class = ornith_predict(input_features, probabilities);

  Serial.print("Gjenkjent kommando: ");
  Serial.println(ORNITH_CLASS_LABELS[intent_class]);
  delay(1000);
}`;

  const servingSnippet = `# Kjøring med offisiell TensorFlow Serving Docker container
docker run -p 8501:8501 \\
  --mount type=bind,source="$(pwd)/models/saved_model",target="/models/ornith/1" \\
  -e MODEL_NAME=ornith -t tensorflow/serving

# Test med REST POST:
curl -X POST http://localhost:8501/v1/models/ornith:predict \\
  -H "Content-Type: application/json" \\
  -d '{"signature_name": "serving_default", "instances": [{"input_vector": [0.0, 1.0, 0.0]}]}'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[#121212] shadow-2xl text-[#F4F4F2] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#181818] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#8F2BFF] to-[#39D9E6] text-white shadow-lg shadow-[#8F2BFF]/20">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Eksporter Modellpakke & Artefakter
                </h2>
                <span className="rounded bg-[#8F2BFF]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#B25CFF]">
                  TensorFlow & TinyML
                </span>
              </div>
              <p className="text-xs text-[#A3A3A0]">
                Eksporter i standard formater (.tflite, SavedModel, C-header) med metadata, konfigurasjon og logger.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A3A3A0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Run Selector & Mode Nav */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(255,255,255,0.06)] bg-[#141414] px-6 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#A3A3A0]">Treningsøkt:</span>
            {allRuns.length > 1 ? (
              <select
                value={selectedRunId}
                onChange={(e) => {
                  setSelectedRunId(e.target.value);
                  onSelectRun?.(e.target.value);
                }}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1E1E1E] px-2.5 py-1 font-mono text-xs text-white focus:border-[#8F2BFF] focus:outline-none"
              >
                {allRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} ({formatDateTime(r.createdAt)}) - Nøyaktighet: {((r.finalMetrics?.accuracy || 0) * 100).toFixed(1)}%
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-mono text-xs font-semibold text-[#77F23B]">
                {selectedRunId || 'Gjeldende treningsøkt'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('options')}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'options'
                  ? 'bg-[#8F2BFF]/20 text-[#B25CFF] border border-[#8F2BFF]/40'
                  : 'text-[#A3A3A0] hover:text-white'
              }`}
            >
              Innhold & Valg
            </button>
            <button
              onClick={() => setActiveTab('manifest')}
              className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'manifest'
                  ? 'bg-[#8F2BFF]/20 text-[#B25CFF] border border-[#8F2BFF]/40'
                  : 'text-[#A3A3A0] hover:text-white'
              }`}
            >
              <FolderArchive className="h-3.5 w-3.5" />
              <span>Pakke-manifest ({filteredFiles.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('snippets')}
              className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'snippets'
                  ? 'bg-[#8F2BFF]/20 text-[#B25CFF] border border-[#8F2BFF]/40'
                  : 'text-[#A3A3A0] hover:text-white'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Kodeeksempler</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {activeTab === 'options' && (
            <>
              {/* Section 1: Model Binary Formats */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-[#39D9E6]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      1. Modellformater (TensorFlow & Edge)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#A3A3A0]">
                    Velg formater som skal inkluderes i pakken
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* TFLite */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                      options.includeTflite
                        ? 'border-[#39D9E6]/40 bg-[#39D9E6]/5'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#161616] opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeTflite}
                      onChange={() => toggleOption('includeTflite')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#39D9E6] focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          TensorFlow Lite (.tflite)
                        </span>
                        <span className="rounded bg-[#39D9E6]/20 px-1.5 py-0.2 font-mono text-[10px] text-[#39D9E6]">
                          TFL3 FlatBuffer
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#A3A3A0]">
                        Standard binærfil med opcodes for FullyConnected, ReLU og Softmax. Klar for Raspberry Pi, Android, Edge TPU og TFLite-Micro.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={API.getTfliteUrl(selectedRunId)}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 rounded bg-[#222] px-2 py-0.5 text-[10px] font-medium text-[#39D9E6] hover:bg-[#333]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Last ned kun .tflite</span>
                        </a>
                      </div>
                    </div>
                  </label>

                  {/* SavedModel */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                      options.includeSavedModel
                        ? 'border-[#8F2BFF]/40 bg-[#8F2BFF]/5'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#161616] opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeSavedModel}
                      onChange={() => toggleOption('includeSavedModel')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          TensorFlow SavedModel (Bundle)
                        </span>
                        <span className="rounded bg-[#8F2BFF]/20 px-1.5 py-0.2 font-mono text-[10px] text-[#B25CFF]">
                          TF 2.x
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#A3A3A0]">
                        Komplett mappe med <code className="text-white">saved_model.pb</code>, variabler, assets (vokabular) og serving_default signatur.
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <a
                          href={API.getSavedModelUrl(selectedRunId)}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 rounded bg-[#222] px-2 py-0.5 text-[10px] font-medium text-[#B25CFF] hover:bg-[#333]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Last ned kun SavedModel (.zip)</span>
                        </a>
                      </div>
                    </div>
                  </label>

                  {/* Embedded C Header */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                      options.includeCHeader
                        ? 'border-[#77F23B]/40 bg-[#77F23B]/5'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#161616] opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeCHeader}
                      onChange={() => toggleOption('includeCHeader')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#77F23B] focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          Embedded C/C++ Header (.h)
                        </span>
                        <span className="rounded bg-[#77F23B]/20 px-1.5 py-0.2 font-mono text-[10px] text-[#77F23B]">
                          Arduino / ESP32
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#A3A3A0]">
                        <code className="text-[#77F23B]">ornith_tinyml_model.h</code> med matrisekonstanter i Flash og <code className="text-white">ornith_predict()</code>. 0 bytes dynamisk heap-allokering.
                      </p>
                    </div>
                  </label>

                  {/* Raw JSON Weights */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
                      options.includeJsonWeights
                        ? 'border-[#E0E0DC]/30 bg-[rgba(255,255,255,0.04)]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#161616] opacity-60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeJsonWeights}
                      onChange={() => toggleOption('includeJsonWeights')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-white focus:ring-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-white">
                          JSON Vektormatriser (.json)
                        </span>
                        <span className="rounded bg-[#333] px-1.5 py-0.2 font-mono text-[10px] text-[#A3A3A0]">
                          Web & Node.js
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#A3A3A0]">
                        Strukturert JSON med W1, b1, W2, b2 og vokabularkart for direkte inferens i nettleser eller server.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Section 2: Associated Metadata, Configs, Evaluation & Logs */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[#8F2BFF]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      2. Tilknyttede Pakkeelementer (Metadata, Evalueringsdata & Logger)
                    </h3>
                  </div>
                  <span className="text-[11px] text-[#A3A3A0]">
                    Komplett sporbarhet og dokumentasjon
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Metadata & Model Card */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      options.includeMetadata
                        ? 'border-[#8F2BFF]/30 bg-[#171717]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#141414] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeMetadata}
                      onChange={() => toggleOption('includeMetadata')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-[#39D9E6]" />
                        <span className="text-xs font-medium text-white">Modellkort & Metadata</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A3A3A0]">
                        Inkluderer <code className="text-white">MODEL_CARD.md</code> og maskinlesbar <code className="text-white">metadata.json</code> med RAM/Flash benchmark.
                      </p>
                    </div>
                  </label>

                  {/* Training Configuration */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      options.includeTrainingConfig
                        ? 'border-[#8F2BFF]/30 bg-[#171717]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#141414] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeTrainingConfig}
                      onChange={() => toggleOption('includeTrainingConfig')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Sliders className="h-3.5 w-3.5 text-[#77F23B]" />
                        <span className="text-xs font-medium text-white">Treningskonfigurasjon</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A3A3A0]">
                        <code className="text-white">training_config.json</code> med epoker, batchstørrelse, læringsrate, optimizer og split-oppsett.
                      </p>
                    </div>
                  </label>

                  {/* Evaluation Metrics & Confusion Matrix */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      options.includeEvaluationMetrics
                        ? 'border-[#8F2BFF]/30 bg-[#171717]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#141414] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeEvaluationMetrics}
                      onChange={() => toggleOption('includeEvaluationMetrics')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-[#B25CFF]" />
                        <span className="text-xs font-medium text-white">Evalueringsmetrikker & Matrise</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A3A3A0]">
                        Testnøyaktighet, per-klasse F1/recall, forvekslingsmatrise (<code className="text-white">confusion_matrix.json</code>) og Markdown-rapport.
                      </p>
                    </div>
                  </label>

                  {/* Logs & Telemetry */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all ${
                      options.includeLogs
                        ? 'border-[#8F2BFF]/30 bg-[#171717]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#141414] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeLogs}
                      onChange={() => toggleOption('includeLogs')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5 text-[#FF9F0A]" />
                        <span className="text-xs font-medium text-white">Treningslogger & Telemetri</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A3A3A0]">
                        Fullstendig tidsstemplet konsolllogg (<code className="text-white">training_logs.txt</code>) og tapskurver per epoke.
                      </p>
                    </div>
                  </label>

                  {/* Quickstart Scripts */}
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all sm:col-span-2 ${
                      options.includeScripts
                        ? 'border-[#8F2BFF]/30 bg-[#171717]'
                        : 'border-[rgba(255,255,255,0.06)] bg-[#141414] opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={options.includeScripts}
                      onChange={() => toggleOption('includeScripts')}
                      className="mt-1 h-4 w-4 rounded border-gray-700 bg-[#222] text-[#8F2BFF] focus:ring-0"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <Code2 className="h-3.5 w-3.5 text-[#39D9E6]" />
                        <span className="text-xs font-medium text-white">Hurtigstartskript (Python, Arduino, Edge REST)</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-[#A3A3A0]">
                        Inkluderer kjørbare <code className="text-[#39D9E6]">infer_tflite.py</code>, <code className="text-[#B25CFF]">load_saved_model.py</code>, <code className="text-[#77F23B]">arduino_example.ino</code> og lokal <code className="text-white">edge_server.py</code> mikroservice.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          {activeTab === 'manifest' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Filer som inkluderes i pakken ({filteredFiles.length} filer)
                  </h3>
                  <p className="text-[11px] text-[#A3A3A0]">
                    Beregnet pakkestørrelse: <span className="font-mono font-bold text-[#77F23B]">{formatBytes(estimatedTotalSize)}</span>
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[rgba(255,255,255,0.04)] rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
                {filteredFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase font-bold ${
                          file.category === 'model'
                            ? 'bg-[#39D9E6]/20 text-[#39D9E6]'
                            : file.category === 'metadata'
                            ? 'bg-[#8F2BFF]/20 text-[#B25CFF]'
                            : file.category === 'training'
                            ? 'bg-[#77F23B]/20 text-[#77F23B]'
                            : file.category === 'evaluation'
                            ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]'
                            : 'bg-[#555]/20 text-[#A3A3A0]'
                        }`}
                      >
                        {file.category}
                      </span>
                      <div>
                        <span className="font-mono font-semibold text-white">{file.path}</span>
                        <p className="text-[11px] text-[#888]">{file.description}</p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#A3A3A0]">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'snippets' && (
            <div className="space-y-4">
              {/* Snippet Tabs */}
              <div className="flex items-center gap-1 border-b border-[rgba(255,255,255,0.06)] pb-2">
                <button
                  onClick={() => setSnippetTab('python-tflite')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    snippetTab === 'python-tflite'
                      ? 'bg-[#1E1E1E] text-[#39D9E6] border border-[#39D9E6]/40'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  Python (TFLite)
                </button>
                <button
                  onClick={() => setSnippetTab('savedmodel')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    snippetTab === 'savedmodel'
                      ? 'bg-[#1E1E1E] text-[#B25CFF] border border-[#8F2BFF]/40'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  TensorFlow SavedModel
                </button>
                <button
                  onClick={() => setSnippetTab('arduino')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    snippetTab === 'arduino'
                      ? 'bg-[#1E1E1E] text-[#77F23B] border border-[#77F23B]/40'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  Arduino / ESP32 (C/C++)
                </button>
                <button
                  onClick={() => setSnippetTab('serving')}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    snippetTab === 'serving'
                      ? 'bg-[#1E1E1E] text-white border border-[rgba(255,255,255,0.2)]'
                      : 'text-[#888] hover:text-white'
                  }`}
                >
                  Docker TF Serving
                </button>
              </div>

              {/* Snippet Display */}
              <div className="relative rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0A0A09] p-4">
                <button
                  onClick={() => {
                    const text =
                      snippetTab === 'python-tflite'
                        ? pythonSnippet
                        : snippetTab === 'savedmodel'
                        ? savedModelSnippet
                        : snippetTab === 'arduino'
                        ? arduinoSnippet
                        : servingSnippet;
                    handleCopy(snippetTab, text);
                  }}
                  className="absolute right-3 top-3 flex items-center gap-1 rounded bg-[#222] px-2.5 py-1 text-[11px] text-[#A3A3A0] transition-colors hover:bg-[#333] hover:text-white"
                >
                  {copiedKey === snippetTab ? (
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
                  {snippetTab === 'python-tflite' && pythonSnippet}
                  {snippetTab === 'savedmodel' && savedModelSnippet}
                  {snippetTab === 'arduino' && arduinoSnippet}
                  {snippetTab === 'serving' && servingSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Primary Export CTA */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(255,255,255,0.08)] bg-[#161616] px-6 py-4">
          <div className="flex items-center gap-3 text-xs text-[#A3A3A0]">
            <div className="flex items-center gap-1.5">
              <FolderArchive className="h-4 w-4 text-[#8F2BFF]" />
              <span>Pakkeformat: <strong className="text-white">ZIP (.zip)</strong></span>
            </div>
            <span>•</span>
            <span>Beregnet størrelse: <strong className="text-[#77F23B]">{formatBytes(estimatedTotalSize)}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-[#A3A3A0] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            >
              Lukk
            </button>

            <button
              onClick={handleDownloadFullPackage}
              disabled={isDownloading || filteredFiles.length === 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#8F2BFF] to-[#39D9E6] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#8F2BFF]/25 transition-all hover:opacity-95 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>
                {isDownloading ? 'Genererer og laster ned...' : 'Last ned Komplett Modellpakke (.ZIP)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
