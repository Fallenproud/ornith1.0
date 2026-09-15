/**
 * ULTIMATE ORNITH 1.0 — Typed Contracts & Shared Schemas
 */

export type LocaleMode = "nb-NO" | "nn-NO" | "en-US";

export type RightPaneMode =
  | "files"
  | "code"
  | "dataset"
  | "preview"
  | "training"
  | "evaluation"
  | "artifacts"
  | "telemetry"
  | "inference"
  | "benchmark";

export type ValidationRuleType =
  | "missing_values"
  | "column_type"
  | "text_length"
  | "word_count"
  | "range_limits"
  | "unique_text"
  | "label_whitelist"
  | "norwegian_char_presence"
  | "norwegian_char_frequency"
  | "norwegian_dialect"
  | "ban_mojibake"
  | "regex_match";

export type ValidationSeverity = "error" | "warning";

export interface DatasetValidationRule {
  id: string;
  name: string;
  description: string;
  type: ValidationRuleType;
  enabled: boolean;
  severity: ValidationSeverity;
  params: {
    targetColumn?: "text" | "label" | string;
    expectedType?: "string" | "number" | "boolean";
    disallowEmpty?: boolean;
    disallowWhitespaceOnly?: boolean;
    maxMissingPercent?: number;
    allowNull?: boolean;
    minLength?: number;
    maxLength?: number;
    minWords?: number;
    maxWords?: number;
    minTokens?: number;
    maxTokens?: number;
    minValue?: number;
    maxValue?: number;
    allowedLabels?: string[];
    minNorwegianChars?: number;
    minNorwegianFrequencyPercent?: number; // e.g. 1.5% of total characters must be æ, ø, å
    requiredNorwegianCharacters?: ("æ" | "ø" | "å" | "Æ" | "Ø" | "Å")[];
    dialectTarget?: "Bokmål" | "Nynorsk" | "any";
    minNorwegianScore?: number;
    regexPattern?: string;
    regexFlags?: string;
    customErrorMessage?: string;
  };
  firestoreSynced?: boolean;
  updatedAt?: string;
}

export interface ProjectValidationConfig {
  strictMode: boolean; // if true, warnings treat records as invalid
  autoCleanWhitespace?: boolean;
  rules: DatasetValidationRule[];
  lastValidatedAt?: string;
  lastSavedToFirestore?: string;
}

export interface ValidationErrorDetail {
  ruleId: string;
  ruleName: string;
  ruleType: ValidationRuleType;
  message: string;
  severity: ValidationSeverity;
  targetColumn: string;
  actualValue?: string | number | null;
}

export interface RuleFailureStat {
  ruleId: string;
  ruleName: string;
  ruleType: ValidationRuleType;
  severity: ValidationSeverity;
  failedCount: number;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  locale: LocaleMode;
  targetArchitecture:
    "tinyml-dense" | "tinyml-cnn1d" | "tinyml-embedding-classifier";
  datasetId?: string;
  lastRunId?: string;
  version: string;
  ownerId?: string;
  validationConfig?: ProjectValidationConfig;
}

export interface DatasetRecord {
  id: string;
  text: string;
  label: string;
  meta?: Record<string, string | number | boolean>;
  isValid: boolean;
  errors?: string[];
  validationFailures?: ValidationErrorDetail[];
  languageDetected?: string;
  norwegianCharCount?: {
    ae: number;
    oe: number;
    aa: number;
    total: number;
  };
}

export interface DatasetValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows?: number;
  duplicateRows: number;
  detectedColumns: string[];
  inferredInputCol: string;
  inferredLabelCol: string;
  classDistribution: Record<string, number>;
  norwegianScore: number; // 0.0 to 1.0 (percentage of records with Norwegian features/words)
  languageWarning?: string;
  uniqueWords: number;
  vocabSample: string[];
  charDistribution: {
    ae: number;
    oe: number;
    aa: number;
    capitalizedNorwegian: number;
  };
  ruleFailures?: RuleFailureStat[];
  mojibakeCount?: number;
  rulesAppliedCount?: number;
}

export interface DatasetSplitConfig {
  trainPercent: number;
  valPercent: number;
  testPercent: number;
  randomSeed: number;
  shuffle: boolean;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  filename: string;
  format: "csv" | "json" | "jsonl" | "txt";
  sizeBytes: number;
  rowCount: number;
  createdAt: string;
  fingerprint: string;
  license: string;
  source: string;
  dialect: "Bokmål" | "Nynorsk" | "Blandet" | "Dialekt/Uspesifisert";
  consent: boolean;
  validation: DatasetValidationSummary;
  splitConfig: DatasetSplitConfig;
}

export interface PreprocessingConfig {
  lowercase: boolean;
  normalizeNorwegianChars: boolean; // keep æ, ø, å standard
  stripPunctuation: boolean;
  stripNumbers: boolean;
  maxVocabSize: number;
  maxSequenceLength: number;
  tokenizationStrategy: "word-ngram" | "subword-char3" | "whitespace";
  padToken: "<PAD>";
  unkToken: "<UNK>";
}

export interface ModelArchitectureConfig {
  type: "tinyml-dense" | "tinyml-cnn1d" | "tinyml-embedding-classifier";
  embeddingDim: number;
  hiddenUnits: number[];
  dropoutRate: number;
  activation: "relu" | "tanh";
  targetDevice:
    "arduino-nano-ble" | "esp32" | "cortex-m4" | "cortex-m0" | "generic-c";
  quantization: "none" | "int8" | "float16";
}

export interface TrainingHyperparameters {
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: "adam" | "sgd";
  seed: number;
  earlyStoppingPatience: number;
}

export interface EpochMetric {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
  valAccuracy: number;
  durationMs: number;
  learningRate: number;
}

export type TrainingStatus =
  "idle" | "preparing" | "running" | "completed" | "cancelled" | "failed";

export interface TrainingRun {
  id: string;
  projectId: string;
  datasetId: string;
  datasetFingerprint: string;
  datasetVersion: string;
  createdAt: string;
  completedAt?: string;
  status: TrainingStatus;
  progressPercent: number;
  currentEpoch: number;
  totalEpochs: number;
  hyperparameters: TrainingHyperparameters;
  preprocessing: PreprocessingConfig;
  modelConfig: ModelArchitectureConfig;
  history: EpochMetric[];
  finalMetrics?: {
    loss: number;
    accuracy: number;
    valLoss: number;
    valAccuracy: number;
    totalDurationSec: number;
    memoryKb: number;
    parameterCount: number;
  };
  checkpointPaths: string[];
  logLines: string[];
  failureReason?: string;
}

export interface EvaluationResult {
  runId: string;
  datasetId: string;
  evaluatedAt: string;
  testSamplesCount: number;
  testLoss: number;
  testAccuracy: number;
  confusionMatrix: {
    labels: string[];
    matrix: number[][]; // [actual][predicted]
  };
  perClassMetrics: Record<
    string,
    {
      precision: number;
      recall: number;
      f1Score: number;
      support: number;
    }
  >;
  samplePredictions: Array<{
    text: string;
    actual: string;
    predicted: string;
    confidence: number;
    isCorrect: boolean;
  }>;
}

export interface ModelArtifact {
  id: string;
  runId: string;
  name: string;
  fileType:
    | "c-header"
    | "json-weights"
    | "tflite"
    | "saved-model"
    | "zip-package"
    | "tflite-spec"
    | "summary-md";
  sizeBytes: number;
  path: string;
  description: string;
  downloadUrl: string;
  createdAt: string;
  status?: "ready" | "exporting" | "pending" | "failed";
  readinessState?: "ready" | "exporting" | "stale";
  checksum?: string;
}

export interface ExportPackageOptions {
  includeTflite?: boolean;
  includeSavedModel?: boolean;
  includeCHeader?: boolean;
  includeJsonWeights?: boolean;
  includeMetadata?: boolean;
  includeTrainingConfig?: boolean;
  includeEvaluationMetrics?: boolean;
  includeLogs?: boolean;
  includeScripts?: boolean;
}

export interface ExportPreviewInfo {
  runId: string;
  modelName: string;
  targetArchitecture: string;
  estimatedZipBytes: number;
  files: Array<{
    path: string;
    description: string;
    category:
      "model" | "metadata" | "training" | "evaluation" | "logs" | "script";
    sizeBytes: number;
  }>;
}

export interface FileTreeItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes?: number;
  updatedAt: string;
  children?: FileTreeItem[];
  extension?: string;
  isReadOnly?: boolean;
}

export type AiProvider = "gemini" | "openai" | "local-ornith";

export interface ProviderStatus {
  gemini: {
    configured: boolean;
    models: string[];
    defaultModel: string;
  };
  openai: {
    configured: boolean;
    models: string[];
    defaultModel: string;
  };
  localOrnith: {
    configured: boolean;
    models: string[];
    defaultModel: string;
  };
  activeProvider: AiProvider;
  activeModel: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  size: number;
  type: "dataset" | "file" | "config" | "metric";
  url?: string;
  previewSnippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: "user" | "ornith" | "model" | "system" | "training";
  text: string;
  timestamp: string;
  status?: "sending" | "streaming" | "delivered" | "error";
  provider?: AiProvider;
  model?: string;
  modelUsed?: string;
  attachments?: MessageAttachment[];
  trainingEvent?: {
    runId: string;
    epoch?: number;
    status?: TrainingStatus;
    type?: string;
    loss?: number;
    accuracy?: number;
  };
  toolAction?: {
    name: string;
    summary: string;
    resultSnippet?: string;
  };
  thinkingText?: string;
}

export interface RuntimeSystemStatus {
  backend: "ready" | "degraded" | "unavailable";
  storage: "ready" | "error";
  tensorflowRuntime: "ready" | "cpu-only" | "fallback";
  activeProject?: ProjectMetadata;
  activeRun?: TrainingRun;
  providers: ProviderStatus;
  memoryUsageMb: number;
  osInfo: string;
  version: string;
}

export type OAuthProviderType =
  "google" | "github" | "anonymous" | "dev-session";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: OAuthProviderType;
  token?: string;
  emailVerified?: boolean;
  tenantId?: string;
  role?: "admin" | "researcher" | "developer" | "viewer";
}

export interface AuthSessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  error: string | null;
  token: string | null;
}

export interface ResourceTelemetryPoint {
  id?: string;
  timestamp: string;
  cpuPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  ramPercent: number;
  heapUsedMb: number;
  heapTotalMb: number;
  externalMb?: number;
  cpuCores?: number;
  trainingStatus: "idle" | "running" | "completed" | "cancelled" | "failed";
  activeRunId?: string | null;
  activeEpoch?: number;
  totalEpochs?: number;
  epochLoss?: number;
  epochAccuracy?: number;
}

export interface ResourceTelemetryDocument {
  current: ResourceTelemetryPoint;
  history: ResourceTelemetryPoint[];
  updatedAt: string;
  serverUptimeSec: number;
}

