/**
 * ULTIMATE ORNITH 1.0 — Local TinyML Workspace Server
 * 
 * Express + Vite Full-Stack backend with authentic TinyML engine, SSE telemetry,
 * Norwegian NLP validation, filesystem persistence, and Gemini intelligence.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import JSZip from 'jszip';
import { StorageManager } from './server/storage';
import { TinyMLEngine, TrainedModelWeights } from './server/tinyml_engine';
import { TensorFlowExportService, ExportPackageOptions } from './server/tf_export';
import { askGeminiOrnith, isGeminiConfigured } from './server/gemini_service';
import { ModelGateway } from './server/gateway';
import { requireAuth, optionalAuth, handleAuthSession } from './server/auth_middleware';
import {
  ProjectMetadata,
  DatasetMetadata,
  DatasetRecord,
  DatasetValidationSummary,
  TrainingRun,
  PreprocessingConfig,
  ModelArchitectureConfig,
  TrainingHyperparameters,
  ModelArtifact,
  ProjectValidationConfig,
  DatasetValidationRule,
} from './src/types';
import {
  validateDatasetRecords,
  validateSingleRecord,
  getDefaultProjectValidationConfig,
} from './src/lib/validation';

const app = express();
const PORT = 3000;

// Increase body limit for datasets and weights
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Global optional authentication: parse user identity token & tenant context if provided
app.use(optionalAuth);

// Initialize persistent storage directories and default Norwegian dataset
StorageManager.init();

// In-memory active training state & SSE client channels
interface ActiveTrainingSession {
  run: TrainingRun;
  cancelRequested: boolean;
  weights?: TrainedModelWeights;
}

let activeSession: ActiveTrainingSession | null = null;
const sseClients: Response[] = [];

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    const client = sseClients[i];
    try {
      client.write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// -------------------------------------------------------------
// 0. Authentication Gateway & OAuth2 Session Verification
// -------------------------------------------------------------
app.get('/api/auth/session', handleAuthSession);

app.get('/api/auth/providers', (req: Request, res: Response) => {
  res.json({
    providers: [
      {
        id: 'google',
        name: 'Google OAuth2',
        scopes: ['email', 'profile'],
        description: 'Autentiser via Google Workspace eller personlig Google-konto.',
        active: true,
      },
      {
        id: 'github',
        name: 'GitHub OAuth2',
        scopes: ['user:email', 'read:user'],
        description: 'Autentiser via GitHub for utviklere og TinyML-forskere.',
        active: true,
      },
    ],
  });
});

// -------------------------------------------------------------
// 1. System Status & Diagnostics
// -------------------------------------------------------------
app.get('/api/status', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    backend: 'ready',
    storage: 'ready',
    tensorflowRuntime: 'ready', // Native TinyML engine
    memoryUsageMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    osInfo: `${process.platform} ${process.arch} Node ${process.version}`,
    version: '1.0.0',
    activeRun: activeSession ? activeSession.run : null,
    user: req.user || null,
    tenantId: req.tenantId || 'default',
    providers: {
      gemini: {
        configured: isGeminiConfigured(),
        models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
        defaultModel: 'gemini-3.8-flash',
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        models: ['gpt-4o-mini', 'gpt-4o'],
        defaultModel: 'gpt-4o-mini',
      },
      localOrnith: {
        configured: true,
        models: ['ornith-tinyml-v1', 'norwegian-nlu-edge'],
        defaultModel: 'ornith-tinyml-v1',
      },
      activeProvider: isGeminiConfigured() ? 'gemini' : 'local-ornith',
      activeModel: isGeminiConfigured() ? 'gemini-3.8-flash' : 'ornith-tinyml-v1',
    },
  });
});

// -------------------------------------------------------------
// 2. Projects (Protected Mutation Endpoints)
// -------------------------------------------------------------
app.get('/api/projects', (req: Request, res: Response) => {
  const projects = StorageManager.listProjects();
  res.json(projects);
});

app.post('/api/projects', requireAuth, (req: Request, res: Response) => {
  const { name, description, locale, targetArchitecture, datasetId } = req.body;
  const project: ProjectMetadata = {
    id: `proj-${Date.now().toString(36)}`,
    name: name || 'Nytt Norsk TinyML-prosjekt',
    description: description || 'Lokalt TinyML eksperiment for kantprosessering.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    locale: locale || 'nb-NO',
    targetArchitecture: targetArchitecture || 'tinyml-dense',
    datasetId,
    version: '1.0.0',
    ownerId: req.user?.uid || 'default-user',
  };
  StorageManager.saveProject(project);
  res.json(project);
});

app.get('/api/projects/:id', (req: Request, res: Response) => {
  const project = StorageManager.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Prosjekt ikke funnet' });
  res.json(project);
});

app.delete('/api/projects/:id', requireAuth, (req: Request, res: Response) => {
  const success = StorageManager.deleteProject(req.params.id);
  res.json({ success });
});

// Project Validation Rules Management
app.get('/api/projects/:id/validation-rules', (req: Request, res: Response) => {
  const project = StorageManager.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Prosjekt ikke funnet' });
  const config = project.validationConfig || getDefaultProjectValidationConfig();
  res.json(config);
});

app.put('/api/projects/:id/validation-rules', requireAuth, (req: Request, res: Response) => {
  const project = StorageManager.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Prosjekt ikke funnet' });
  const { rules, strictMode, autoCleanWhitespace } = req.body;
  project.validationConfig = {
    rules: Array.isArray(rules) ? rules : (project.validationConfig?.rules || getDefaultProjectValidationConfig().rules),
    strictMode: Boolean(strictMode),
    autoCleanWhitespace: autoCleanWhitespace !== false,
    lastValidatedAt: new Date().toISOString(),
  };
  project.updatedAt = new Date().toISOString();
  StorageManager.saveProject(project);
  res.json({ success: true, validationConfig: project.validationConfig, project });
});

// Interactive rule testing sandbox endpoint
app.post('/api/validation/test-rule', (req: Request, res: Response) => {
  try {
    const { rule, sampleText, sampleLabel } = req.body;
    if (!rule) return res.status(400).json({ error: 'Ingen regel sendt til testing.' });
    const record: DatasetRecord = {
      id: 'test-sample',
      text: typeof sampleText === 'string' ? sampleText : '',
      label: typeof sampleLabel === 'string' ? sampleLabel : 'test_klasse',
      isValid: true,
    };
    const result = validateSingleRecord(record, [rule]);
    res.json({
      passed: result.isValid && !result.hasWarnings,
      isValid: result.isValid,
      hasWarnings: result.hasWarnings,
      errors: result.errors,
      failures: result.validationFailures,
      norwegianCharCount: result.norwegianCharCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Kunne ikke teste regel: ${err.message}` });
  }
});

// -------------------------------------------------------------
// 3. Datasets & Norwegian Validation
// -------------------------------------------------------------
app.get('/api/datasets', (req: Request, res: Response) => {
  const datasets = StorageManager.listDatasets();
  res.json(datasets);
});

app.get('/api/datasets/:id', (req: Request, res: Response) => {
  const dataset = StorageManager.getDataset(req.params.id);
  if (!dataset) return res.status(404).json({ error: 'Datasett ikke funnet' });
  res.json(dataset);
});

// Upload and parse raw dataset content (CSV / JSON / JSONL / TXT) with project validation rules
app.post('/api/datasets/upload', requireAuth, (req: Request, res: Response) => {
  try {
    const { name, filename, content, format, dialect, license, source, projectId, validationRules, filterInvalid } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Ugyldig eller tomt innhold sendt til opplasting.' });
    }

    const rawRecords: DatasetRecord[] = [];
    const fmt = format || path.extname(filename || '').replace('.', '').toLowerCase() || 'jsonl';

    if (fmt === 'jsonl') {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      lines.forEach((line, idx) => {
        try {
          const parsed = JSON.parse(line);
          const t = parsed.text ?? parsed.tekst ?? parsed.sentence ?? parsed.input ?? parsed.utt ?? '';
          const l = parsed.label ?? parsed.etikett ?? parsed.intent ?? parsed.class ?? parsed.kategori ?? 'ukjent';
          rawRecords.push({
            id: `rec-${idx + 1}`,
            text: String(t),
            label: String(l),
            isValid: true,
            languageDetected: 'nb-NO',
          });
        } catch {
          rawRecords.push({
            id: `rec-${idx + 1}`,
            text: line,
            label: 'ugyldig_json',
            isValid: false,
            errors: ['Ugyldig JSON-rad'],
          });
        }
      });
    } else if (fmt === 'csv') {
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const header = lines[0].split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ''));
        const textIdx = header.findIndex((h) => /text|tekst|sentence|input|ytring/i.test(h));
        const labelIdx = header.findIndex((h) => /label|etikett|intent|class|kategori/i.test(h));

        const effectiveTextIdx = textIdx >= 0 ? textIdx : 0;
        const effectiveLabelIdx = labelIdx >= 0 ? labelIdx : (header.length > 1 ? 1 : 0);

        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^["']|["']$/g, ''));
          const t = parts[effectiveTextIdx] || '';
          const l = parts[effectiveLabelIdx] || 'ukjent';

          rawRecords.push({
            id: `rec-${i}`,
            text: t,
            label: l,
            isValid: true,
            languageDetected: 'nb-NO',
          });
        }
      }
    } else if (fmt === 'json') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          parsed.forEach((item, idx) => {
            const t = typeof item === 'string' ? item : item.text ?? item.tekst ?? item.sentence ?? '';
            const l = typeof item === 'string' ? 'standard' : item.label ?? item.etikett ?? item.intent ?? 'ukjent';
            rawRecords.push({
              id: `rec-${idx + 1}`,
              text: String(t),
              label: String(l),
              isValid: true,
              languageDetected: 'nb-NO',
            });
          });
        }
      } catch (err: any) {
        return res.status(400).json({ error: `Ugyldig JSON-struktur: ${err.message}` });
      }
    } else {
      // Plain text
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      lines.forEach((line, idx) => {
        rawRecords.push({
          id: `rec-${idx + 1}`,
          text: line,
          label: 'standard',
          isValid: true,
          languageDetected: 'nb-NO',
        });
      });
    }

    // Resolve project validation rules
    let config: ProjectValidationConfig;
    if (projectId) {
      const project = StorageManager.getProject(projectId);
      config = project?.validationConfig || getDefaultProjectValidationConfig();
    } else if (validationRules && Array.isArray(validationRules)) {
      config = {
        strictMode: false,
        rules: validationRules,
      };
    } else {
      config = getDefaultProjectValidationConfig();
    }

    // Auto-clean whitespace if rule is enabled
    if (config.autoCleanWhitespace) {
      for (const r of rawRecords) {
        if (typeof r.text === 'string') r.text = r.text.trim();
        if (typeof r.label === 'string') r.label = r.label.trim();
      }
    }

    // Execute validation pipeline
    const { records: validatedRecords, summary } = validateDatasetRecords(rawRecords, config);

    // Filter invalid rows if requested
    const finalRecords = filterInvalid ? validatedRecords.filter((r) => r.isValid) : validatedRecords;

    const datasetId = `ds-${Date.now().toString(36)}`;
    const meta: DatasetMetadata = {
      id: datasetId,
      name: name || filename || 'Importert Datasett',
      filename: filename || 'dataset.jsonl',
      format: fmt as any,
      sizeBytes: Buffer.byteLength(content, 'utf-8'),
      rowCount: finalRecords.length,
      createdAt: new Date().toISOString(),
      fingerprint: crypto.createHash('sha256').update(content).digest('hex').slice(0, 16),
      license: license || 'Brukerdefinert / CC-BY-SA',
      source: source || 'Lokal filopplasting',
      dialect: dialect || 'Bokmål',
      consent: true,
      validation: summary,
      splitConfig: {
        trainPercent: 70,
        valPercent: 15,
        testPercent: 15,
        randomSeed: 42,
        shuffle: true,
      },
    };

    StorageManager.saveDataset(meta, finalRecords);
    res.json({
      meta,
      recordsCount: finalRecords.length,
      validRows: summary.validRows,
      invalidRows: summary.invalidRows,
      ruleFailures: summary.ruleFailures,
    });
  } catch (err: any) {
    console.error('Dataset upload parsing error:', err);
    res.status(500).json({ error: `Kunne ikke analysere datasett: ${err.message}` });
  }
});

// Re-validate an existing dataset using project rules or custom rules
app.post('/api/datasets/:id/validate', requireAuth, (req: Request, res: Response) => {
  try {
    const dataset = StorageManager.getDataset(req.params.id);
    if (!dataset) return res.status(404).json({ error: 'Datasett ikke funnet' });

    const { projectId, rules, strictMode } = req.body;

    let config: ProjectValidationConfig;
    if (rules && Array.isArray(rules)) {
      config = {
        strictMode: Boolean(strictMode),
        rules,
      };
    } else if (projectId) {
      const project = StorageManager.getProject(projectId);
      config = project?.validationConfig || getDefaultProjectValidationConfig();
    } else {
      config = getDefaultProjectValidationConfig();
    }

    const { records: validatedRecords, summary } = validateDatasetRecords(dataset.records, config);

    dataset.meta.validation = summary;
    dataset.meta.rowCount = validatedRecords.length;

    StorageManager.saveDataset(dataset.meta, validatedRecords);

    res.json({
      meta: dataset.meta,
      records: validatedRecords,
      summary,
    });
  } catch (err: any) {
    console.error('Dataset re-validation error:', err);
    res.status(500).json({ error: `Kunne ikke validere datasett: ${err.message}` });
  }
});

// -------------------------------------------------------------
// 4. Real TinyML Training & Live Telemetry (SSE)
// -------------------------------------------------------------
app.get('/api/training/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  sseClients.push(res);

  // Send current active run if running
  if (activeSession) {
    res.write(`event: run_status\ndata: ${JSON.stringify(activeSession.run)}\n\n`);
  }

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx >= 0) sseClients.splice(idx, 1);
  });
});

app.post('/api/training/start', requireAuth, async (req: Request, res: Response) => {
  try {
    if (activeSession && activeSession.run.status === 'running') {
      return res.status(400).json({ error: 'En treningsøkt pågår allerede. Avbryt eller vent på fullføring.' });
    }

    const { projectId, datasetId, hyperparameters, preprocessing, modelConfig } = req.body;
    const datasetData = StorageManager.getDataset(datasetId);
    if (!datasetData) {
      return res.status(404).json({ error: 'Datasett ikke funnet' });
    }

    const hp: TrainingHyperparameters = {
      epochs: hyperparameters?.epochs || 25,
      batchSize: hyperparameters?.batchSize || 8,
      learningRate: hyperparameters?.learningRate || 0.02,
      optimizer: hyperparameters?.optimizer || 'adam',
      seed: hyperparameters?.seed || 42,
      earlyStoppingPatience: hyperparameters?.earlyStoppingPatience || 6,
    };

    const prep: PreprocessingConfig = {
      lowercase: preprocessing?.lowercase ?? true,
      normalizeNorwegianChars: preprocessing?.normalizeNorwegianChars ?? true,
      stripPunctuation: preprocessing?.stripPunctuation ?? true,
      stripNumbers: preprocessing?.stripNumbers ?? false,
      maxVocabSize: preprocessing?.maxVocabSize || 256,
      maxSequenceLength: preprocessing?.maxSequenceLength || 32,
      tokenizationStrategy: preprocessing?.tokenizationStrategy || 'word-ngram',
      padToken: '<PAD>',
      unkToken: '<UNK>',
    };

    const arch: ModelArchitectureConfig = {
      type: modelConfig?.type || 'tinyml-dense',
      embeddingDim: modelConfig?.embeddingDim || 32,
      hiddenUnits: modelConfig?.hiddenUnits || [32],
      dropoutRate: modelConfig?.dropoutRate || 0.1,
      activation: modelConfig?.activation || 'relu',
      targetDevice: modelConfig?.targetDevice || 'arduino-nano-ble',
      quantization: modelConfig?.quantization || 'int8',
    };

    const runId = `run-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const run: TrainingRun = {
      id: runId,
      projectId: projectId || 'default',
      datasetId,
      datasetFingerprint: datasetData.meta.fingerprint,
      datasetVersion: '1.0',
      createdAt: new Date().toISOString(),
      status: 'running',
      progressPercent: 0,
      currentEpoch: 0,
      totalEpochs: hp.epochs,
      hyperparameters: hp,
      preprocessing: prep,
      modelConfig: arch,
      history: [],
      checkpointPaths: [],
      logLines: [
        `[${new Date().toLocaleTimeString('nb-NO')}] Initialiserer ORNITH TinyML treningsøkt ${runId}...`,
        `[${new Date().toLocaleTimeString('nb-NO')}] Laster datasett '${datasetData.meta.name}' (${datasetData.records.length} eksempler)...`,
        `[${new Date().toLocaleTimeString('nb-NO')}] Behandler norske spesialtegn: æ, ø, å og sammensatte n-grammer...`,
      ],
    };

    activeSession = {
      run,
      cancelRequested: false,
    };
    StorageManager.saveRun(run);
    broadcastSSE('run_start', run);

    // Return immediate response so client UI receives confirmation
    res.json({ success: true, runId, run });

    // Execute training asynchronously in the background
    (async () => {
      try {
        const validRecords = datasetData.records.filter((r) => r.isValid);
        // Preprocess corpus
        const { dataset, vocab, labels } = TinyMLEngine.preprocessCorpus(validRecords, prep);

        // Deterministic split into train (70%), val (15%), test (15%)
        const splitConfig = datasetData.meta.splitConfig;
        const total = dataset.length;
        const trainCount = Math.max(1, Math.floor(total * (splitConfig.trainPercent / 100)));
        const valCount = Math.max(1, Math.floor(total * (splitConfig.valPercent / 100)));

        const trainSet = dataset.slice(0, trainCount);
        const valSet = dataset.slice(trainCount, trainCount + valCount);
        const testSet = dataset.slice(trainCount + valCount);

        run.logLines.push(
          `[${new Date().toLocaleTimeString('nb-NO')}] Data oppdelt: ${trainSet.length} trening, ${valSet.length} validering, ${testSet.length} test.`
        );
        run.logLines.push(
          `[${new Date().toLocaleTimeString('nb-NO')}] Vokabular størrelse: ${Object.keys(vocab).length} ord/bigrammer. Klasser: ${labels.join(', ')}.`
        );
        broadcastSSE('run_log', { runId, logLines: run.logLines });

        const trainGen = TinyMLEngine.train(
          trainSet,
          valSet,
          vocab,
          labels,
          hp,
          arch,
          () => activeSession?.cancelRequested ?? false
        );

        let finalWeights: TrainedModelWeights | null = null;
        let finalMetricsResult: any = null;

        for await (const step of trainGen) {
          if (step.type === 'epoch') {
            run.currentEpoch = step.metric.epoch;
            run.progressPercent = Math.round((step.metric.epoch / hp.epochs) * 100);
            run.history.push(step.metric);
            run.logLines.push(
              `[${new Date().toLocaleTimeString('nb-NO')}] Epoke ${step.metric.epoch}/${hp.epochs} — tap: ${step.metric.loss.toFixed(4)} | nøyaktighet: ${(step.metric.accuracy * 100).toFixed(1)}% | val_tap: ${step.metric.valLoss.toFixed(4)} | val_nøyaktighet: ${(step.metric.valAccuracy * 100).toFixed(1)}%`
            );

            StorageManager.saveRun(run);
            broadcastSSE('epoch_update', {
              runId,
              metric: step.metric,
              progressPercent: run.progressPercent,
              currentEpoch: run.currentEpoch,
              logLine: run.logLines[run.logLines.length - 1],
            });
          } else if (step.type === 'complete') {
            finalWeights = step.weights;
            finalMetricsResult = step.finalMetrics;
          }
        }

        if (activeSession?.cancelRequested) {
          run.status = 'cancelled';
          run.logLines.push(`[${new Date().toLocaleTimeString('nb-NO')}] Treningsøkt avbrutt av bruker.`);
          StorageManager.saveRun(run);
          broadcastSSE('run_cancelled', { runId, run });
          activeSession = null;
          return;
        }

        if (finalWeights) {
          activeSession.weights = finalWeights;
          run.status = 'completed';
          run.completedAt = new Date().toISOString();
          const lastEpoch = run.history[run.history.length - 1];
          const totalDuration = run.history.reduce((acc, m) => acc + m.durationMs, 0) / 1000;

          run.finalMetrics = {
            loss: lastEpoch?.loss || 0,
            accuracy: lastEpoch?.accuracy || 0,
            valLoss: lastEpoch?.valLoss || 0,
            valAccuracy: lastEpoch?.valAccuracy || 0,
            totalDurationSec: parseFloat(totalDuration.toFixed(1)),
            memoryKb: finalMetricsResult?.memoryKb || 4.2,
            parameterCount: finalMetricsResult?.parameterCount || 1200,
          };

          const project = StorageManager.getProject(run.projectId);

          // 1. Embedded C-Header artifact for Arduino / ESP32 deployment
          const cHeader = TinyMLEngine.generateCHeader(finalWeights, runId);
          const cArtifact: ModelArtifact = {
            id: `art-${runId}-c`,
            runId,
            name: 'ornith_tinyml_model.h',
            fileType: 'c-header',
            sizeBytes: Buffer.byteLength(cHeader, 'utf-8'),
            path: '',
            description: 'Embedded C-header med matrisevekter og ornith_predict() for mikrokontroller.',
            downloadUrl: `/api/artifacts/art-${runId}-c/download`,
            createdAt: new Date().toISOString(),
            status: 'ready',
            readinessState: 'ready',
          };
          StorageManager.saveArtifact(cArtifact, cHeader);

          // 2. TensorFlow Lite (.tflite) binary artifact
          const tfliteBuffer = TensorFlowExportService.generateTFLiteBinary(finalWeights, run, project);
          const tfliteArtifact: ModelArtifact = {
            id: `art-${runId}-tflite`,
            runId,
            name: 'ornith_model.tflite',
            fileType: 'tflite',
            sizeBytes: tfliteBuffer.length,
            path: '',
            description: 'TensorFlow Lite FlatBuffer binærfil for Python, Android og TFLite Micro.',
            downloadUrl: `/api/artifacts/art-${runId}-tflite/download`,
            createdAt: new Date().toISOString(),
            status: 'ready',
            readinessState: 'ready',
          };
          StorageManager.saveArtifact(tfliteArtifact, tfliteBuffer);

          // 3. TensorFlow SavedModel bundle (saved_model.zip)
          const savedModelFiles = TensorFlowExportService.generateSavedModelFiles(finalWeights, run, project);
          const smZip = new JSZip();
          for (const [relPath, content] of Object.entries(savedModelFiles)) {
            smZip.file(relPath, content);
          }
          const savedModelZipBuffer = await smZip.generateAsync({ type: 'nodebuffer' });
          const savedModelArtifact: ModelArtifact = {
            id: `art-${runId}-savedmodel`,
            runId,
            name: 'saved_model.zip',
            fileType: 'saved-model',
            sizeBytes: savedModelZipBuffer.length,
            path: '',
            description: 'Komplett TensorFlow 2.x SavedModel bundle (saved_model.pb, variables, assets).',
            downloadUrl: `/api/artifacts/art-${runId}-savedmodel/download`,
            createdAt: new Date().toISOString(),
            status: 'ready',
            readinessState: 'ready',
          };
          StorageManager.saveArtifact(savedModelArtifact, savedModelZipBuffer);

          // 4. Structured JSON weights artifact
          const weightsJson = JSON.stringify(finalWeights, null, 2);
          const jsonArtifact: ModelArtifact = {
            id: `art-${runId}-json`,
            runId,
            name: 'model_weights.json',
            fileType: 'json-weights',
            sizeBytes: Buffer.byteLength(weightsJson, 'utf-8'),
            path: '',
            description: 'Trente modellvekter og vokabular for browser- og serverinferens.',
            downloadUrl: `/api/artifacts/art-${runId}-json/download`,
            createdAt: new Date().toISOString(),
            status: 'ready',
            readinessState: 'ready',
          };
          StorageManager.saveArtifact(jsonArtifact, weightsJson);

          // Perform automatic evaluation on test split
          const evalResult = TinyMLEngine.evaluate(testSet, finalWeights, prep, runId, datasetId);
          StorageManager.saveEvaluation(evalResult);

          // 5. Complete Model Package (ZIP) containing models, metadata, configs, evaluation and scripts
          const fullPackageBuffer = await TensorFlowExportService.buildExportZipPackage(
            finalWeights,
            run,
            project,
            datasetData.meta,
            evalResult
          );
          const packageArtifact: ModelArtifact = {
            id: `art-${runId}-package`,
            runId,
            name: `ornith_complete_package_${runId}.zip`,
            fileType: 'zip-package',
            sizeBytes: fullPackageBuffer.length,
            path: '',
            description: 'Komplett eksportpakke (.zip) med TFLite, SavedModel, C-header, metadata, evalueringsrapport og skript.',
            downloadUrl: `/api/artifacts/art-${runId}-package/download`,
            createdAt: new Date().toISOString(),
            status: 'ready',
            readinessState: 'ready',
          };
          StorageManager.saveArtifact(packageArtifact, fullPackageBuffer);

          run.checkpointPaths = [
            cArtifact.id,
            tfliteArtifact.id,
            savedModelArtifact.id,
            jsonArtifact.id,
            packageArtifact.id,
          ];
          run.logLines.push(
            `[${new Date().toLocaleTimeString('nb-NO')}] Trening fullført! Eksporterte formater: .tflite, SavedModel, C-header (.h), og komplett ZIP-pakke.`
          );

          StorageManager.saveRun(run);
          broadcastSSE('run_completed', { runId, run, evalResult });
        }
      } catch (err: any) {
        console.error('Training failure:', err);
        run.status = 'failed';
        run.failureReason = err.message;
        run.logLines.push(`[${new Date().toLocaleTimeString('nb-NO')}] FEIL: ${err.message}`);
        StorageManager.saveRun(run);
        broadcastSSE('run_failed', { runId, error: err.message, run });
      } finally {
        activeSession = null;
      }
    })();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/training/cancel', requireAuth, (req: Request, res: Response) => {
  if (!activeSession) {
    return res.json({ message: 'Ingen aktiv treningsøkt å avbryte' });
  }
  activeSession.cancelRequested = true;
  res.json({ message: 'Avbruddsforespørsel registrert' });
});

app.get('/api/training/runs', (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const runs = StorageManager.listRuns(projectId);
  res.json(runs);
});

app.get('/api/training/runs/:id', (req: Request, res: Response) => {
  const run = StorageManager.getRun(req.params.id);
  if (!run) return res.status(404).json({ error: 'Treningsøkt ikke funnet' });
  res.json(run);
});

// -------------------------------------------------------------
// 5. Evaluation & Interactive Inference
// -------------------------------------------------------------
app.get('/api/evaluation/:runId', (req: Request, res: Response) => {
  const evalResult = StorageManager.getEvaluation(req.params.runId);
  if (!evalResult) {
    return res.status(404).json({ error: 'Evaluering ikke funnet for denne treningsøkten' });
  }
  res.json(evalResult);
});

app.post('/api/inference', (req: Request, res: Response) => {
  const { text, runId } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Mangler tekst for inferens.' });
  }

  let weights: TrainedModelWeights | null = null;
  // If runId provided, load weights from artifact
  if (runId) {
    const artifacts = StorageManager.listArtifacts(runId);
    const jsonArt = artifacts.find((a) => a.fileType === 'json-weights');
    if (jsonArt) {
      const artData = StorageManager.getArtifactFile(jsonArt.id);
      if (artData) {
        weights = JSON.parse(artData.content.toString('utf-8'));
      }
    }
  }

  // Fallback to active session weights or latest run weights
  if (!weights && activeSession?.weights) {
    weights = activeSession.weights;
  }

  if (!weights) {
    const allRuns = StorageManager.listRuns();
    for (const r of allRuns) {
      if (r.status === 'completed') {
        const artifacts = StorageManager.listArtifacts(r.id);
        const jsonArt = artifacts.find((a) => a.fileType === 'json-weights');
        if (jsonArt) {
          const artData = StorageManager.getArtifactFile(jsonArt.id);
          if (artData) {
            weights = JSON.parse(artData.content.toString('utf-8'));
            break;
          }
        }
      }
    }
  }

  if (!weights) {
    return res.status(400).json({
      error: 'Ingen trent modell er tilgjengelig for inferens ennå. Start en treningsøkt først.',
    });
  }

  const prep: PreprocessingConfig = {
    lowercase: true,
    normalizeNorwegianChars: true,
    stripPunctuation: true,
    stripNumbers: false,
    maxVocabSize: 256,
    maxSequenceLength: 32,
    tokenizationStrategy: 'word-ngram',
    padToken: '<PAD>',
    unkToken: '<UNK>',
  };

  const prediction = TinyMLEngine.predict(text, weights, prep);
  res.json(prediction);
});

// -------------------------------------------------------------
// 6. Model Artifacts & Downloads
// -------------------------------------------------------------
app.get('/api/artifacts', (req: Request, res: Response) => {
  const runId = req.query.runId as string | undefined;
  const artifacts = StorageManager.listArtifacts(runId);
  res.json(artifacts);
});

app.get('/api/artifacts/:id/download', (req: Request, res: Response) => {
  const artifact = StorageManager.getArtifactFile(req.params.id);
  if (!artifact) {
    return res.status(404).send('Filen ble ikke funnet');
  }
  res.setHeader('Content-Disposition', `attachment; filename="${artifact.meta.name}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(artifact.content);
});

// -------------------------------------------------------------
// 6b. Advanced TensorFlow & TinyML Model Export Endpoints
// -------------------------------------------------------------
app.get('/api/export/preview/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  const run = StorageManager.getRun(runId);
  if (!run) {
    return res.status(404).json({ error: 'Treningsøkt ikke funnet' });
  }

  const weights =
    activeSession?.run.id === runId && activeSession.weights
      ? activeSession.weights
      : StorageManager.getWeightsForRun(runId);

  const project = StorageManager.getProject(run.projectId);
  const dataset = StorageManager.getDataset(run.datasetId)?.meta;
  const evalResult = StorageManager.getEvaluation(runId);

  const inputDim = weights?.inputDim || 256;
  const hiddenDim = weights?.hiddenDim || 32;
  const outputDim = weights?.outputDim || 8;

  const tfliteEstBytes = 8 + (hiddenDim * inputDim + hiddenDim + outputDim * hiddenDim + outputDim) * 4 + 1024;
  const cHeaderEstBytes = 12000;

  const files = [
    {
      path: 'models/model.tflite',
      description: 'TensorFlow Lite binærfil med TFL3-identifikator for TFLite Micro og edge-runtime',
      category: 'model',
      sizeBytes: tfliteEstBytes,
    },
    {
      path: 'models/saved_model/saved_model.pb',
      description: 'TensorFlow 2.x SavedModel MetaGraphDef med serving_default signatur',
      category: 'model',
      sizeBytes: 25000,
    },
    {
      path: 'models/saved_model/variables/variables.data-00000-of-00001',
      description: 'Serielle tensorvariabler for W1, b1, W2, b2',
      category: 'model',
      sizeBytes: (hiddenDim * inputDim + hiddenDim + outputDim * hiddenDim + outputDim) * 4,
    },
    {
      path: 'models/saved_model/assets/vocab.txt',
      description: 'Norsk vokabularkart for on-device tokenisering',
      category: 'model',
      sizeBytes: 1500,
    },
    {
      path: 'models/ornith_tinyml_model.h',
      description: 'Autonom C/C++ header for mikrokontrollere (Arduino / ESP32)',
      category: 'model',
      sizeBytes: cHeaderEstBytes,
    },
    {
      path: 'metadata/metadata.json',
      description: 'Strukturert JSON med maskinvarespesifikasjoner og modellproveniens',
      category: 'metadata',
      sizeBytes: 2100,
    },
    {
      path: 'metadata/MODEL_CARD.md',
      description: 'Standardisert TinyML modellkort med benchmarktall og GDPR personverninfo',
      category: 'metadata',
      sizeBytes: 3200,
    },
    {
      path: 'training/training_config.json',
      description: 'Hyperparametre, optimalisator, batchstørrelse og random seed',
      category: 'training',
      sizeBytes: 850,
    },
    {
      path: 'training/loss_accuracy_history.json',
      description: 'Telemetrihistorikk for alle epoker',
      category: 'training',
      sizeBytes: 3500,
    },
    {
      path: 'evaluation/evaluation_metrics.json',
      description: 'Test-metrikker, presisjon, recall og F1 per klasse',
      category: 'evaluation',
      sizeBytes: 1200,
    },
    {
      path: 'evaluation/evaluation_report.md',
      description: 'Formaterte tabeller for forvekslingsmatrise og testutvalg',
      category: 'evaluation',
      sizeBytes: 2800,
    },
    {
      path: 'logs/training_logs.txt',
      description: 'Fullstendige konsolllogger fra treningsøkten',
      category: 'logs',
      sizeBytes: (run.logLines?.length || 0) * 80,
    },
    {
      path: 'scripts/infer_tflite.py',
      description: 'Klar-til-bruk Python testskript for model.tflite',
      category: 'script',
      sizeBytes: 2400,
    },
    {
      path: 'scripts/load_saved_model.py',
      description: 'Python skript for lasting med tf.saved_model.load()',
      category: 'script',
      sizeBytes: 1800,
    },
    {
      path: 'scripts/arduino_example.ino',
      description: 'Komplett Arduino / ESP32 mikrokontrollerskisse',
      category: 'script',
      sizeBytes: 2100,
    },
    {
      path: 'README.md',
      description: 'Dokumentasjon og integrasjonsveiledning for alle formater',
      category: 'metadata',
      sizeBytes: 3400,
    },
  ];

  const estimatedZipBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);

  res.json({
    runId,
    modelName: project?.name || 'ULTIMATE ORNITH Modell',
    targetArchitecture: project?.targetArchitecture || 'tinyml-dense',
    estimatedZipBytes,
    files,
  });
});

app.get('/api/export/tflite/:runId', (req: Request, res: Response) => {
  const { runId } = req.params;
  const run = StorageManager.getRun(runId);
  if (!run) return res.status(404).json({ error: 'Treningsøkt ikke funnet' });

  const weights =
    activeSession?.run.id === runId && activeSession.weights
      ? activeSession.weights
      : StorageManager.getWeightsForRun(runId);

  if (!weights) {
    return res.status(400).json({ error: 'Vekter ikke funnet for denne treningsøkten.' });
  }

  const project = StorageManager.getProject(run.projectId);
  const tfliteBuffer = TensorFlowExportService.generateTFLiteBinary(weights, run, project);

  res.setHeader('Content-Disposition', `attachment; filename="ornith_model_${runId}.tflite"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(tfliteBuffer);
});

app.get('/api/export/saved-model/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const run = StorageManager.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Treningsøkt ikke funnet' });

    const weights =
      activeSession?.run.id === runId && activeSession.weights
        ? activeSession.weights
        : StorageManager.getWeightsForRun(runId);

    if (!weights) {
      return res.status(400).json({ error: 'Vekter ikke funnet for denne treningsøkten.' });
    }

    const project = StorageManager.getProject(run.projectId);
    const files = TensorFlowExportService.generateSavedModelFiles(weights, run, project);

    const zip = new JSZip();
    for (const [relPath, content] of Object.entries(files)) {
      zip.file(relPath, content);
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.setHeader('Content-Disposition', `attachment; filename="saved_model_${runId}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    res.send(zipBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export/package/:runId', async (req: Request, res: Response) => {
  try {
    const { runId } = req.params;
    const run = StorageManager.getRun(runId);
    if (!run) return res.status(404).json({ error: 'Treningsøkt ikke funnet' });

    const weights =
      activeSession?.run.id === runId && activeSession.weights
        ? activeSession.weights
        : StorageManager.getWeightsForRun(runId);

    if (!weights) {
      return res.status(400).json({ error: 'Vekter ikke funnet for denne treningsøkten.' });
    }

    const project = StorageManager.getProject(run.projectId);
    const dataset = StorageManager.getDataset(run.datasetId)?.meta;
    const evalResult = StorageManager.getEvaluation(runId);

    const options: ExportPackageOptions = {
      includeTflite: req.query.includeTflite !== 'false',
      includeSavedModel: req.query.includeSavedModel !== 'false',
      includeCHeader: req.query.includeCHeader !== 'false',
      includeJsonWeights: req.query.includeJsonWeights !== 'false',
      includeMetadata: req.query.includeMetadata !== 'false',
      includeTrainingConfig: req.query.includeTrainingConfig !== 'false',
      includeEvaluationMetrics: req.query.includeEvaluationMetrics !== 'false',
      includeLogs: req.query.includeLogs !== 'false',
      includeScripts: req.query.includeScripts !== 'false',
    };

    const packageBuffer = await TensorFlowExportService.buildExportZipPackage(
      weights,
      run,
      project,
      dataset,
      evalResult,
      options
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ornith_model_package_${runId}.zip"`
    );
    res.setHeader('Content-Type', 'application/zip');
    res.send(packageBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Project File Tree & Code Inspection
// -------------------------------------------------------------
app.get('/api/files/tree', (req: Request, res: Response) => {
  const tree = StorageManager.getProjectFileTree(process.cwd());
  res.json(tree);
});

app.get('/api/files/content', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  if (!filePath) return res.status(400).json({ error: 'Mangler filsti' });
  try {
    const file = StorageManager.readFileContent(filePath);
    res.json(file);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/files/content', requireAuth, (req: Request, res: Response) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'Mangler sti eller innhold' });
  }
  try {
    StorageManager.writeFileContent(filePath, content);
    res.json({ success: true, savedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. AI Chat & Multi-Tenant Model Gateway
// -------------------------------------------------------------
app.get('/api/gateway/tenants', (req: Request, res: Response) => {
  res.json({ tenants: ModelGateway.listTenants() });
});

app.post('/api/ai/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt, history, model, thinking, projectId, provider, tenantId } = req.body;
    let projectContext: any = undefined;
    if (projectId) {
      const p = StorageManager.getProject(projectId);
      if (p) {
        projectContext = {
          projectName: p.name,
          targetArchitecture: p.targetArchitecture,
        };
        if (p.datasetId) {
          const ds = StorageManager.getDataset(p.datasetId);
          if (ds) {
            projectContext.datasetName = ds.meta.name;
            projectContext.recordsCount = ds.meta.rowCount;
          }
        }
      }
    }

    const response = await ModelGateway.dispatchChat({
      tenantId: tenantId || (req.headers['x-tenant-id'] as string) || 'default',
      provider,
      model,
      prompt: prompt || 'Hei Ornith!',
      history: history || [],
      thinking: Boolean(thinking),
      projectId,
      projectContext,
    });

    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 9. Vite Middleware Integration
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ULTIMATE ORNITH 1.0] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
