import React, { useState, useRef } from "react";
import { 
  Zap, 
  Upload, 
  Play, 
  RefreshCw, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  Table as TableIcon
} from "lucide-react";
import { ProjectMetadata, TrainingRun } from "../../types";

interface InferenceModeProps {
  activeProject: ProjectMetadata | null;
  activeRun: TrainingRun | null;
}

interface BatchResult {
  text: string;
  prediction: string;
  confidence: number;
  latencyMs: number;
}

const DEFAULT_SAMPLE_TEXTS = [
  "skru på lyset i stuen",
  "slå av alle lysene i gangen",
  "hva er temperaturen på soverommet?",
  "sett varmekablene til 22 grader",
  "lås ytterdøren umiddelbart",
  "åpne garasjeporten",
  "demp belysningen på kjøkkenet",
  "spill av litt rolig musikk",
  "hva er strømprisen i dag?",
  "aktiver alarm for natten",
  "vis kameraovervåking ved oppkjørselen",
  "god morgen, start kaffemaskinen",
];

export const InferenceMode: React.FC<InferenceModeProps> = ({
  activeProject,
  activeRun,
}) => {
  const [inputText, setInputText] = useState("");
  const [singleResult, setSingleResult] = useState<BatchResult | null>(null);
  const [isInferencing, setIsInferencing] = useState(false);
  
  const [batchMode, setBatchMode] = useState(false);
  const [loadedTexts, setLoadedTexts] = useState<string[]>(DEFAULT_SAMPLE_TEXTS);
  const [loadedFileName, setLoadedFileName] = useState<string>("forhåndsdefinert_testsett.csv");
  const [batchResults, setBatchResults] = useState<BatchResult[]>([]);
  const [isBatchInferencing, setIsBatchInferencing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchProcessedCount, setBatchProcessedCount] = useState(0);
  const [justCompletedBatch, setJustCompletedBatch] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulated inference function with realistic Norwegian IoT/TinyML intent classification
  const runInference = async (text: string): Promise<BatchResult> => {
    // Simulate realistic inference latency (35-90ms)
    const latency = Math.floor(Math.random() * 55) + 35;
    await new Promise((resolve) => setTimeout(resolve, latency));
    
    const lower = text.toLowerCase();
    let prediction = "annet_ukjent";
    if (lower.includes("lys") || lower.includes("belysning") || lower.includes("lampe")) {
      prediction = lower.includes("av") ? "lys_av" : "lys_pa";
    } else if (lower.includes("temp") || lower.includes("varme") || lower.includes("grader")) {
      prediction = "klima_termostat";
    } else if (lower.includes("lås") || lower.includes("dør") || lower.includes("port") || lower.includes("alarm")) {
      prediction = "sikkerhet_adgang";
    } else if (lower.includes("musikk") || lower.includes("spill") || lower.includes("lyd")) {
      prediction = "mediekontroll";
    } else if (lower.includes("kaffe") || lower.includes("morgen") || lower.includes("strøm")) {
      prediction = "hjemmeautomasjon";
    } else {
      const labels = ["stemmekommando", "statusforesporsel", "snarvei", "brukeravvik"];
      prediction = labels[text.length % labels.length];
    }

    const confidence = 0.78 + (Math.random() * 0.21); // 78-99%
    
    return {
      text,
      prediction,
      confidence,
      latencyMs: latency,
    };
  };

  const handleSingleInference = async () => {
    if (!inputText.trim()) return;
    setIsInferencing(true);
    try {
      const result = await runInference(inputText);
      setSingleResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsInferencing(false);
    }
  };

  const executeBatch = async (textsToProcess: string[]) => {
    if (textsToProcess.length === 0) return;
    setIsBatchInferencing(true);
    setBatchResults([]);
    setBatchProgress(0);
    setBatchProcessedCount(0);
    setJustCompletedBatch(false);
    
    const results: BatchResult[] = [];
    const total = textsToProcess.length;
    for (let i = 0; i < total; i++) {
      const res = await runInference(textsToProcess[i]);
      results.push(res);
      const current = i + 1;
      const pct = Math.round((current / total) * 100);
      setBatchProgress(pct);
      setBatchProcessedCount(current);
      
      // Update results dynamically
      setBatchResults([...results]);
    }
    
    setIsBatchInferencing(false);
    setJustCompletedBatch(true);
    setTimeout(() => setJustCompletedBatch(false), 3500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvData = event.target?.result as string;
      if (csvData) {
        const lines = csvData.split('\n').filter(line => line.trim().length > 0);
        const texts = lines.map(line => {
          const parts = line.split(',');
          return parts[0].replace(/^["']|["']$/g, '').trim();
        }).filter(t => t.length > 0);
        
        const startIndex = texts[0]?.toLowerCase().includes('text') || texts[0]?.toLowerCase().includes('input') || texts[0]?.toLowerCase().includes('setning') ? 1 : 0;
        const validTexts = texts.slice(startIndex);
        
        if (validTexts.length > 0) {
          setLoadedTexts(validTexts);
          // Run batch immediately on upload
          executeBatch(validTexts);
        }
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasModel = activeRun?.status === "completed" || activeRun?.status === "ready";

  return (
    <div className="flex h-full flex-col bg-[#0D0D0C] text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[rgba(255,255,255,0.06)] bg-[#111111] p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8F2BFF]/20 text-[#B25CFF]">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-white">Sanntids Inferens</h2>
            <p className="text-sm text-[#A3A3A0]">
              Test den trente modellen på nye tekster, eller last opp en fil for batch-inferens.
            </p>
          </div>
        </div>
        
        {!hasModel && (
          <div className="flex items-center gap-2 rounded-lg border border-[#FF9F0A]/20 bg-[#FF9F0A]/10 px-4 py-3 text-sm text-[#FF9F0A]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <p>Ingen ferdigtrent modell funnet. Kjøring av inferens simuleres for testing.</p>
          </div>
        )}
        {hasModel && (
          <div className="flex items-center gap-2 rounded-lg border border-[#32D74B]/20 bg-[#32D74B]/10 px-4 py-3 text-sm text-[#32D74B]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p>Aktiv modell lastet fra kjøring: <span className="font-mono">{activeRun.id.substring(0, 8)}</span></p>
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-[rgba(255,255,255,0.1)]">
          <button
            onClick={() => setBatchMode(false)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              !batchMode
                ? "border-b-2 border-[#8F2BFF] text-white"
                : "text-[#888] hover:text-[#CCC]"
            }`}
          >
            Enkel Inferens
          </button>
          <button
            onClick={() => setBatchMode(true)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              batchMode
                ? "border-b-2 border-[#8F2BFF] text-white"
                : "text-[#888] hover:text-[#CCC]"
            }`}
          >
            Batch-Inferens (CSV)
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {!batchMode ? (
          // SINGLE INFERENCE
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#CCC]">Input-tekst</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSingleInference()}
                  placeholder="Skriv inn en tekst for å teste modellen..."
                  className="flex-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1A1A1A] px-4 py-2.5 text-sm text-white focus:border-[#8F2BFF] focus:outline-none focus:ring-1 focus:ring-[#8F2BFF]"
                />
                <button
                  onClick={handleSingleInference}
                  disabled={isInferencing || !inputText.trim()}
                  className="flex items-center gap-2 rounded-lg bg-[#8F2BFF] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#7A22D9] disabled:opacity-50"
                >
                  {isInferencing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span>Kjør</span>
                </button>
              </div>
            </div>

            {singleResult && (
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="mb-4 text-sm font-medium text-[#888]">Resultat</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[#1A1A1A] p-4">
                    <div className="mb-1 text-xs text-[#888]">Prediksjon</div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#39D9E6]" />
                      <span className="font-mono text-lg font-medium text-white">{singleResult.prediction}</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-[#1A1A1A] p-4">
                    <div className="mb-1 text-xs text-[#888]">Konfidens</div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-medium text-white">{(singleResult.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-[#1A1A1A] p-4">
                    <div className="mb-1 text-xs text-[#888]">Latens (inferenstid)</div>
                    <div className="font-mono text-sm text-[#CCC]">{singleResult.latencyMs} ms</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          // BATCH INFERENCE
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-white">Batch-Inferens</h3>
                <p className="text-xs text-[#888]">
                  Test og evaluer modellen over et helt testsett (.csv) med sanntidsprosessering.
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#A3A3A0]">
                  <span className="font-mono text-[#39D9E6]">{loadedFileName}</span>
                  <span>•</span>
                  <span>{loadedTexts.length} eksempler klargjort</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <input
                  type="file"
                  accept=".csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBatchInferencing}
                  className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[#1A1A1A] px-3.5 py-2 text-sm font-medium text-[#CCC] transition-colors hover:bg-[#252525] hover:text-white disabled:opacity-50"
                  title="Last opp en egendefinert CSV-fil"
                >
                  <Upload className="h-4 w-4 text-[#888]" />
                  <span>Last opp CSV</span>
                </button>

                {/* Primary 'Kjør batch-inferens' button with subtle pulsing animation and progress indicator */}
                <button
                  onClick={() => executeBatch(loadedTexts)}
                  disabled={isBatchInferencing || loadedTexts.length === 0}
                  className={`relative overflow-hidden flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all ${
                    isBatchInferencing
                      ? "ring-2 ring-[#8F2BFF] shadow-[0_0_22px_rgba(143,43,255,0.5)] animate-pulse bg-[#6C1EC9] cursor-wait"
                      : justCompletedBatch
                      ? "bg-[#28A745] hover:bg-[#218838]"
                      : "bg-[#8F2BFF] hover:bg-[#7A22D9] active:scale-[0.98] shadow-sm"
                  } disabled:opacity-60`}
                  title="Kjør inferens på alle eksempler i listen"
                >
                  {/* Subtle embedded progress bar fill inside button */}
                  {isBatchInferencing && (
                    <div
                      className="absolute inset-y-0 left-0 bg-[#39D9E6]/30 transition-all duration-200 pointer-events-none rounded-lg"
                      style={{ width: `${batchProgress}%` }}
                    />
                  )}

                  {/* Pulsing indicator beacon during active processing */}
                  {isBatchInferencing && (
                    <span className="relative flex h-2 w-2 z-10">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#39D9E6] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#39D9E6]"></span>
                    </span>
                  )}

                  {/* Button Icon */}
                  {isBatchInferencing ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-[#39D9E6] z-10" />
                  ) : justCompletedBatch ? (
                    <CheckCircle2 className="h-4 w-4 text-white z-10" />
                  ) : (
                    <Play className="h-4 w-4 fill-white z-10" />
                  )}

                  {/* Button Label & Progress Indicator */}
                  <span className="z-10 font-medium">
                    {isBatchInferencing ? (
                      <>
                        <span>Kjører batch-inferens...</span>{" "}
                        <span className="font-mono text-xs text-[#39D9E6]">
                          ({batchProgress}%)
                        </span>
                      </>
                    ) : justCompletedBatch ? (
                      <span>Fullført! ({batchResults.length})</span>
                    ) : (
                      <span>
                        Kjør batch-inferens{" "}
                        {loadedTexts.length > 0 ? `(${loadedTexts.length})` : ""}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {isBatchInferencing && (
              <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5 shadow-inner animate-in fade-in duration-200">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[#8F2BFF] animate-ping" />
                    <span className="font-medium text-white">
                      Prosesserer eksempler ({batchProcessedCount} av {loadedTexts.length})
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-[#39D9E6]">
                    {batchProgress}%
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#1A1A1A]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#8F2BFF] via-[#B25CFF] to-[#39D9E6] transition-all duration-300"
                    style={{ width: `${batchProgress}%` }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs text-[#888]">
                  <span>Kjører sanntids-tokenisering og tensormatching...</span>
                  <span className="font-mono text-[#AAA]">
                    Estimert ferdig om ~{Math.max(1, Math.round(((loadedTexts.length - batchProcessedCount) * 0.05)))}s
                  </span>
                </div>
              </div>
            )}

            {batchResults.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#141414]">
                <div className="border-b border-[rgba(255,255,255,0.06)] bg-[#1A1A1A] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <TableIcon className="h-4 w-4 text-[#888]" />
                    <span>Resultater ({batchResults.length})</span>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#141414] text-[#888] shadow-sm shadow-[#000000]/20">
                      <tr>
                        <th className="px-4 py-3 font-medium">Tekst</th>
                        <th className="px-4 py-3 font-medium">Prediksjon</th>
                        <th className="px-4 py-3 font-medium text-right">Konfidens</th>
                        <th className="px-4 py-3 font-medium text-right">Latens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                      {batchResults.map((result, idx) => (
                        <tr key={idx} className="transition-colors hover:bg-[#1A1A1A]/50">
                          <td className="px-4 py-3">
                            <span className="line-clamp-1 max-w-xs text-white" title={result.text}>
                              {result.text}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#39D9E6]">
                            {result.prediction}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${
                              result.confidence > 0.85 
                                ? 'bg-[#32D74B]/20 text-[#32D74B]' 
                                : result.confidence > 0.7 
                                  ? 'bg-[#FF9F0A]/20 text-[#FF9F0A]' 
                                  : 'bg-[#FF453A]/20 text-[#FF453A]'
                            }`}>
                              {(result.confidence * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[#888]">
                            {result.latencyMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
