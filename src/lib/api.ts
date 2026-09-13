/**
 * ULTIMATE ORNITH 1.0 — Frontend API Client
 */

import {
  ProjectMetadata,
  DatasetMetadata,
  DatasetRecord,
  DatasetValidationSummary,
  TrainingRun,
  EvaluationResult,
  ModelArtifact,
  FileTreeItem,
  RuntimeSystemStatus,
  TrainingHyperparameters,
  PreprocessingConfig,
  ModelArchitectureConfig,
  ProjectValidationConfig,
  DatasetValidationRule,
  ValidationErrorDetail,
  ExportPackageOptions,
  ExportPreviewInfo,
} from '../types';

export const API = {
  async getStatus(): Promise<RuntimeSystemStatus> {
    const res = await fetch('/api/status');
    if (!res.ok) throw new Error('Kunne ikke hente systemstatus');
    return res.json();
  },

  async listProjects(): Promise<ProjectMetadata[]> {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Kunne ikke hente prosjekter');
    return res.json();
  },

  async createProject(data: Partial<ProjectMetadata>): Promise<ProjectMetadata> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Kunne ikke opprette prosjekt');
    return res.json();
  },

  async deleteProject(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Kunne ikke slette prosjekt');
    return res.json();
  },

  async getProjectValidationRules(projectId: string): Promise<ProjectValidationConfig> {
    const res = await fetch(`/api/projects/${projectId}/validation-rules`);
    if (!res.ok) throw new Error('Kunne ikke hente valideringsregler for prosjektet');
    return res.json();
  },

  async updateProjectValidationRules(
    projectId: string,
    config: {
      rules: DatasetValidationRule[];
      strictMode?: boolean;
      autoCleanWhitespace?: boolean;
    }
  ): Promise<{ success: boolean; validationConfig: ProjectValidationConfig; project: ProjectMetadata }> {
    const res = await fetch(`/api/projects/${projectId}/validation-rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Kunne ikke oppdatere prosjektets valideringsregler');
    return res.json();
  },

  async listDatasets(): Promise<DatasetMetadata[]> {
    const res = await fetch('/api/datasets');
    if (!res.ok) throw new Error('Kunne ikke hente datasett');
    return res.json();
  },

  async getDataset(id: string): Promise<{ meta: DatasetMetadata; records: DatasetRecord[] }> {
    const res = await fetch(`/api/datasets/${id}`);
    if (!res.ok) throw new Error('Kunne ikke hente datasett-detaljer');
    return res.json();
  },

  async uploadDataset(payload: {
    name: string;
    filename: string;
    content: string;
    format: string;
    dialect: string;
    license?: string;
    source?: string;
    projectId?: string;
    validationRules?: DatasetValidationRule[];
    filterInvalid?: boolean;
  }): Promise<{
    meta: DatasetMetadata;
    recordsCount: number;
    validRows?: number;
    invalidRows?: number;
    ruleFailures?: any[];
  }> {
    const res = await fetch('/api/datasets/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Opplasting feilet' }));
      throw new Error(err.error || 'Kunne ikke laste opp datasett');
    }
    return res.json();
  },

  async revalidateDataset(
    datasetId: string,
    options?: {
      projectId?: string;
      rules?: DatasetValidationRule[];
      strictMode?: boolean;
    }
  ): Promise<{ meta: DatasetMetadata; records: DatasetRecord[]; summary: DatasetValidationSummary }> {
    const res = await fetch(`/api/datasets/${datasetId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Validering feilet' }));
      throw new Error(err.error || 'Kunne ikke revalidere datasett');
    }
    return res.json();
  },

  async testValidationRule(payload: {
    rule: DatasetValidationRule;
    sampleText: string;
    sampleLabel?: string;
  }): Promise<{
    passed: boolean;
    isValid: boolean;
    hasWarnings: boolean;
    errors: string[];
    failures: ValidationErrorDetail[];
    norwegianCharCount: { ae: number; oe: number; aa: number; total: number };
  }> {
    const res = await fetch('/api/validation/test-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Regeltest feilet' }));
      throw new Error(err.error || 'Kunne ikke teste valideringsregel');
    }
    return res.json();
  },

  async startTraining(params: {
    projectId: string;
    datasetId: string;
    hyperparameters: TrainingHyperparameters;
    preprocessing?: PreprocessingConfig;
    modelConfig?: ModelArchitectureConfig;
  }): Promise<{ success: boolean; runId: string; run: TrainingRun }> {
    const res = await fetch('/api/training/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Trening feilet' }));
      throw new Error(err.error || 'Kunne ikke starte trening');
    }
    return res.json();
  },

  async cancelTraining(): Promise<{ message: string }> {
    const res = await fetch('/api/training/cancel', { method: 'POST' });
    return res.json();
  },

  async listRuns(projectId?: string): Promise<TrainingRun[]> {
    const url = projectId ? `/api/training/runs?projectId=${projectId}` : '/api/training/runs';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Kunne ikke hente treningsøkter');
    return res.json();
  },

  async getEvaluation(runId: string): Promise<EvaluationResult> {
    const res = await fetch(`/api/evaluation/${runId}`);
    if (!res.ok) throw new Error('Ingen evaluering funnet for denne økten');
    return res.json();
  },

  async runInference(text: string, runId?: string): Promise<{
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
    normalizedTokens: string[];
  }> {
    const res = await fetch('/api/inference', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, runId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Inferens feilet' }));
      throw new Error(err.error || 'Kunne ikke kjøre inferens');
    }
    return res.json();
  },

  async listArtifacts(runId?: string): Promise<ModelArtifact[]> {
    const url = runId ? `/api/artifacts?runId=${runId}` : '/api/artifacts';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Kunne ikke hente artefakter');
    return res.json();
  },

  async getExportPreview(runId: string): Promise<ExportPreviewInfo> {
    const res = await fetch(`/api/export/preview/${runId}`);
    if (!res.ok) throw new Error('Kunne ikke hente forhåndsvisning av eksportpakke');
    return res.json();
  },

  getExportPackageUrl(runId: string, options?: ExportPackageOptions): string {
    const params = new URLSearchParams();
    if (options) {
      if (options.includeTflite !== undefined) params.set('includeTflite', String(options.includeTflite));
      if (options.includeSavedModel !== undefined) params.set('includeSavedModel', String(options.includeSavedModel));
      if (options.includeCHeader !== undefined) params.set('includeCHeader', String(options.includeCHeader));
      if (options.includeJsonWeights !== undefined) params.set('includeJsonWeights', String(options.includeJsonWeights));
      if (options.includeMetadata !== undefined) params.set('includeMetadata', String(options.includeMetadata));
      if (options.includeTrainingConfig !== undefined) params.set('includeTrainingConfig', String(options.includeTrainingConfig));
      if (options.includeEvaluationMetrics !== undefined) params.set('includeEvaluationMetrics', String(options.includeEvaluationMetrics));
      if (options.includeLogs !== undefined) params.set('includeLogs', String(options.includeLogs));
      if (options.includeScripts !== undefined) params.set('includeScripts', String(options.includeScripts));
    }
    const query = params.toString();
    return query ? `/api/export/package/${runId}?${query}` : `/api/export/package/${runId}`;
  },

  getTfliteUrl(runId: string): string {
    return `/api/export/tflite/${runId}`;
  },

  getSavedModelUrl(runId: string): string {
    return `/api/export/saved-model/${runId}`;
  },

  async getFileTree(): Promise<FileTreeItem> {
    const res = await fetch('/api/files/tree');
    if (!res.ok) throw new Error('Kunne ikke hente filtre');
    return res.json();
  },

  async getFileContent(filePath: string): Promise<{ content: string; extension: string }> {
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error('Kunne ikke lese fil');
    return res.json();
  },

  async saveFileContent(filePath: string, content: string): Promise<{ success: boolean; savedAt: string }> {
    const res = await fetch('/api/files/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (!res.ok) throw new Error('Kunne ikke lagre fil');
    return res.json();
  },

  async sendChatMessage(payload: {
    prompt: string;
    history: Array<{ role: 'user' | 'model'; text: string }>;
    model?: string;
    thinking?: boolean;
    projectId?: string;
  }): Promise<{ text: string; thinking?: string; modelUsed: string }> {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'AI svar feilet' }));
      throw new Error(err.error || 'Kunne ikke kontakte AI assistent');
    }
    return res.json();
  },
};
