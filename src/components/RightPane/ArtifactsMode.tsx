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
} from 'lucide-react';
import { ModelArtifact, TrainingRun } from '../../types';
import { API } from '../../lib/api';
import { formatBytes, formatDateTime } from '../../lib/i18n';
import { ExportModal } from '../ExportModal';

interface ArtifactsModeProps {
  activeRun?: TrainingRun | null;
}

export const ArtifactsMode: React.FC<ArtifactsModeProps> = ({ activeRun }) => {
  const [artifacts, setArtifacts] = useState<ModelArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>('tflite');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // Group artifacts by category
  const modelArtifacts = artifacts.filter(
    (a) => a.fileType === 'tflite' || a.fileType === 'saved-model' || a.fileType === 'c-header' || a.fileType === 'json-weights'
  );
  const packageArtifacts = artifacts.filter(
    (a) => a.fileType === 'zip-package' || a.fileType === 'summary-md' || a.fileType === 'tflite-spec'
  );
  const otherArtifacts = artifacts.filter(
    (a) => !modelArtifacts.includes(a) && !packageArtifacts.includes(a)
  );

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

  const getArtifactBadge = (type: ModelArtifact['fileType']) => {
    switch (type) {
      case 'tflite':
        return (
          <span className="rounded bg-[#39D9E6]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#39D9E6]">
            TensorFlow Lite (.tflite)
          </span>
        );
      case 'saved-model':
        return (
          <span className="rounded bg-[#8F2BFF]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#B25CFF]">
            TensorFlow SavedModel
          </span>
        );
      case 'c-header':
        return (
          <span className="rounded bg-[#77F23B]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#77F23B]">
            Embedded C/C++ Header (.h)
          </span>
        );
      case 'zip-package':
        return (
          <span className="rounded bg-[#FF9F0A]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF9F0A]">
            Komplett Eksportpakke (.zip)
          </span>
        );
      default:
        return (
          <span className="rounded bg-[#222] px-2 py-0.5 font-mono text-[10px] text-[#A3A3A0]">
            {type}
          </span>
        );
    }
  };

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
            <span>Eksporter Modellpakke (.ZIP)</span>
          </button>
        </div>
      </div>

      {/* Artifact Formats Summary Bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#39D9E6]/20 bg-[#39D9E6]/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#39D9E6]">TensorFlow Lite</span>
            <Cpu className="h-4 w-4 text-[#39D9E6]" />
          </div>
          <p className="mt-1 text-[11px] text-[#A3A3A0]">
            FlatBuffer .tflite for Python, Android og Edge TPU
          </p>
        </div>

        <div className="rounded-xl border border-[#8F2BFF]/20 bg-[#8F2BFF]/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#B25CFF]">SavedModel</span>
            <Layers className="h-4 w-4 text-[#8F2BFF]" />
          </div>
          <p className="mt-1 text-[11px] text-[#A3A3A0]">
            TF 2.x standard med serving_default og variabler
          </p>
        </div>

        <div className="rounded-xl border border-[#77F23B]/20 bg-[#77F23B]/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#77F23B]">Embedded C-Header</span>
            <FileCode className="h-4 w-4 text-[#77F23B]" />
          </div>
          <p className="mt-1 text-[11px] text-[#A3A3A0]">
            Arduino / ESP32 med 0 byte heap-allokering
          </p>
        </div>

        <div className="rounded-xl border border-[#FF9F0A]/20 bg-[#FF9F0A]/5 p-3.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#FF9F0A]">Komplett Pakke</span>
            <FolderArchive className="h-4 w-4 text-[#FF9F0A]" />
          </div>
          <p className="mt-1 text-[11px] text-[#A3A3A0]">
            ZIP med modeller, metadata, evalueringsdata og skript
          </p>
        </div>
      </div>

      {/* Artifacts List */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Genererte Filer & Modeller ({artifacts.length})
          </h2>
          <button
            onClick={fetchArtifacts}
            className="text-[11px] text-[#8F2BFF] hover:underline"
          >
            Oppdater liste
          </button>
        </div>

        {artifacts.length > 0 ? (
          <div className="space-y-3">
            {artifacts.map((art) => (
              <div
                key={art.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4 transition-all hover:border-[rgba(255,255,255,0.14)] hover:bg-[#161616]"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A1A1A] text-white">
                    {getArtifactIcon(art.fileType)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{art.name}</span>
                      {getArtifactBadge(art.fileType)}
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

                <div className="flex items-center gap-2">
                  <a
                    href={art.downloadUrl}
                    download
                    className="flex items-center gap-1.5 rounded-lg bg-[#1F1F1E] border border-[rgba(255,255,255,0.1)] px-3.5 py-2 text-xs font-medium text-white transition-all hover:bg-[#282828] hover:border-[rgba(255,255,255,0.2)]"
                  >
                    <Download className="h-3.5 w-3.5 text-[#39D9E6]" />
                    <span>Last ned</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[rgba(255,255,255,0.1)] bg-[#121212] p-8 text-center">
            <Package className="mx-auto h-8 w-8 text-[#555] mb-2" />
            <h3 className="text-xs font-bold text-white">Ingen artefakter generert ennå</h3>
            <p className="mt-1 text-xs text-[#888] max-w-md mx-auto">
              Start en treningsøkt under <em>Trening</em> for å produsere TensorFlow Lite, SavedModel, C-header og komplett eksportpakke automatisk.
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
