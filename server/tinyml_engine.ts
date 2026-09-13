/**
 * ULTIMATE ORNITH 1.0 — Real TinyML Neural Network Training Engine
 * 
 * Implements real mathematical forward pass, backpropagation, categorical cross-entropy,
 * Adam optimizer, epoch telemetry, real checkpoints, evaluation matrices, and C-array
 * code generation for Arduino/ESP32 microcontroller deployment.
 */

import { PreprocessingConfig, ModelArchitectureConfig, TrainingHyperparameters, EpochMetric, EvaluationResult } from '../src/types';

export interface PreprocessedSample {
  vector: number[]; // Bag of words or token representation
  labelIndex: number;
  rawText: string;
  label: string;
}

export interface TrainedModelWeights {
  vocab: Record<string, number>;
  reverseVocab: string[];
  labels: string[];
  inputDim: number;
  hiddenDim: number;
  outputDim: number;
  W1: number[][]; // [hiddenDim][inputDim]
  b1: number[];   // [hiddenDim]
  W2: number[][]; // [outputDim][hiddenDim]
  b2: number[];   // [outputDim]
}

export class TinyMLEngine {
  // Norwegian text tokenization and vocabulary building
  public static preprocessCorpus(
    samples: Array<{ text: string; label: string }>,
    config: PreprocessingConfig
  ): {
    dataset: PreprocessedSample[];
    vocab: Record<string, number>;
    labels: string[];
  } {
    const wordFreq: Record<string, number> = {};
    const labelSet = new Set<string>();

    const tokenizedSamples = samples.map((sample) => {
      labelSet.add(sample.label);
      let text = sample.text;
      if (config.lowercase) {
        text = text.toLocaleLowerCase('nb-NO');
      }

      // Preserve Norwegian characters æ, ø, å while removing punctuation if configured
      if (config.stripPunctuation) {
        text = text.replace(/[^a-zA-ZæøåÆØÅ0-9\s]/g, ' ');
      }
      if (config.stripNumbers) {
        text = text.replace(/[0-9]/g, ' ');
      }

      const rawTokens = text
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Extract unigrams + bigrams for rich TinyML Norwegian representation
      const tokens: string[] = [];
      for (let i = 0; i < rawTokens.length; i++) {
        const token = rawTokens[i];
        tokens.push(token);
        wordFreq[token] = (wordFreq[token] || 0) + 1;

        if (i < rawTokens.length - 1) {
          const bigram = `${token}_${rawTokens[i + 1]}`;
          tokens.push(bigram);
          wordFreq[bigram] = (wordFreq[bigram] || 0) + 1;
        }
      }

      return {
        rawText: sample.text,
        label: sample.label,
        tokens,
      };
    });

    // Sort vocabulary by frequency and clamp to maxVocabSize
    const sortedWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.maxVocabSize)
      .map(([word]) => word);

    const vocab: Record<string, number> = {};
    sortedWords.forEach((word, idx) => {
      vocab[word] = idx;
    });

    const labels = Array.from(labelSet).sort();
    const labelMap: Record<string, number> = {};
    labels.forEach((lbl, idx) => {
      labelMap[lbl] = idx;
    });

    const inputDim = sortedWords.length;
    const dataset: PreprocessedSample[] = tokenizedSamples.map((sample) => {
      const vector = new Array(inputDim).fill(0);
      sample.tokens.forEach((token) => {
        if (vocab[token] !== undefined) {
          vector[vocab[token]] += 1.0;
        }
      });

      // L2 Normalization of input vector for stable gradients
      let sumSq = 0;
      for (let i = 0; i < inputDim; i++) {
        sumSq += vector[i] * vector[i];
      }
      const norm = Math.sqrt(sumSq) || 1.0;
      for (let i = 0; i < inputDim; i++) {
        vector[i] /= norm;
      }

      return {
        vector,
        labelIndex: labelMap[sample.label],
        rawText: sample.rawText,
        label: sample.label,
      };
    });

    return { dataset, vocab, labels };
  }

  // Weight initialization (He / Xavier uniform)
  private static initMatrix(rows: number, cols: number, seed: number): number[][] {
    const mat: number[][] = [];
    const limit = Math.sqrt(6.0 / (rows + cols));
    let s = seed;
    // Simple LCG pseudo-random generator for determinism
    const pseudoRandom = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    for (let r = 0; r < rows; r++) {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        row.push((pseudoRandom() * 2 - 1) * limit);
      }
      mat.push(row);
    }
    return mat;
  }

  // Softmax with numerical stability
  private static softmax(logits: number[]): number[] {
    let max = -Infinity;
    for (let i = 0; i < logits.length; i++) {
      if (logits[i] > max) max = logits[i];
    }
    let sum = 0;
    const exp = new Array(logits.length);
    for (let i = 0; i < logits.length; i++) {
      exp[i] = Math.exp(logits[i] - max);
      sum += exp[i];
    }
    for (let i = 0; i < logits.length; i++) {
      exp[i] = exp[i] / (sum || 1.0);
    }
    return exp;
  }

  // Train a real TinyML model and yield epoch metrics
  public static async *train(
    trainData: PreprocessedSample[],
    valData: PreprocessedSample[],
    vocab: Record<string, number>,
    labels: string[],
    hyperparams: TrainingHyperparameters,
    archConfig: ModelArchitectureConfig,
    checkCancelled: () => boolean
  ): AsyncGenerator<
    | { type: 'epoch'; metric: EpochMetric }
    | { type: 'complete'; weights: TrainedModelWeights; finalMetrics: any }
  > {
    const inputDim = Object.keys(vocab).length;
    const hiddenDim = archConfig.hiddenUnits[0] || 32;
    const outputDim = labels.length;

    // Initialize trainable parameters
    let W1 = this.initMatrix(hiddenDim, inputDim, hyperparams.seed + 1);
    let b1 = new Array(hiddenDim).fill(0);
    let W2 = this.initMatrix(outputDim, hiddenDim, hyperparams.seed + 2);
    let b2 = new Array(outputDim).fill(0);

    // Adam optimizer moments
    const mW1 = W1.map((row) => row.slice().fill(0));
    const vW1 = W1.map((row) => row.slice().fill(0));
    const mb1 = new Array(hiddenDim).fill(0);
    const vb1 = new Array(hiddenDim).fill(0);

    const mW2 = W2.map((row) => row.slice().fill(0));
    const vW2 = W2.map((row) => row.slice().fill(0));
    const mb2 = new Array(outputDim).fill(0);
    const vb2 = new Array(outputDim).fill(0);

    const beta1 = 0.9;
    const beta2 = 0.999;
    const epsilon = 1e-8;
    let t = 0;

    let bestValLoss = Infinity;
    let bestWeights: TrainedModelWeights | null = null;
    let patienceCounter = 0;

    for (let epoch = 1; epoch <= hyperparams.epochs; epoch++) {
      if (checkCancelled()) {
        break;
      }

      const epochStart = Date.now();
      let totalTrainLoss = 0;
      let correctTrain = 0;

      // Shuffle training batch indices
      const indices = Array.from({ length: trainData.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Mini-batch gradient descent with Adam
      const batchSize = Math.min(hyperparams.batchSize, trainData.length);
      for (let b = 0; b < trainData.length; b += batchSize) {
        const batchIndices = indices.slice(b, b + batchSize);
        t += 1;

        // Gradient accumulators for batch
        const gradW1 = W1.map((row) => row.slice().fill(0));
        const gradb1 = new Array(hiddenDim).fill(0);
        const gradW2 = W2.map((row) => row.slice().fill(0));
        const gradb2 = new Array(outputDim).fill(0);

        for (const idx of batchIndices) {
          const sample = trainData[idx];
          const x = sample.vector;

          // Forward hidden layer: z1 = W1 * x + b1
          const z1 = new Array(hiddenDim);
          const a1 = new Array(hiddenDim);
          for (let h = 0; h < hiddenDim; h++) {
            let sum = b1[h];
            const wRow = W1[h];
            for (let i = 0; i < inputDim; i++) {
              if (x[i] !== 0) {
                sum += wRow[i] * x[i];
              }
            }
            z1[h] = sum;
            // ReLU activation
            a1[h] = sum > 0 ? sum : 0;
          }

          // Forward output layer: z2 = W2 * a1 + b2
          const z2 = new Array(outputDim);
          for (let o = 0; o < outputDim; o++) {
            let sum = b2[o];
            const wRow = W2[o];
            for (let h = 0; h < hiddenDim; h++) {
              sum += wRow[h] * a1[h];
            }
            z2[o] = sum;
          }

          // Softmax probabilities
          const yHat = this.softmax(z2);

          // Loss computation
          const targetIndex = sample.labelIndex;
          const prob = Math.max(yHat[targetIndex], 1e-12);
          totalTrainLoss += -Math.log(prob);

          // Accuracy prediction
          let maxPredIdx = 0;
          let maxPredVal = yHat[0];
          for (let o = 1; o < outputDim; o++) {
            if (yHat[o] > maxPredVal) {
              maxPredVal = yHat[o];
              maxPredIdx = o;
            }
          }
          if (maxPredIdx === targetIndex) {
            correctTrain++;
          }

          // Backpropagation
          // dz2 = yHat - y
          const dz2 = new Array(outputDim);
          for (let o = 0; o < outputDim; o++) {
            dz2[o] = yHat[o] - (o === targetIndex ? 1.0 : 0.0);
            gradb2[o] += dz2[o];
            for (let h = 0; h < hiddenDim; h++) {
              gradW2[o][h] += dz2[o] * a1[h];
            }
          }

          // dz1 = (W2^T * dz2) * relu'(z1)
          const dz1 = new Array(hiddenDim);
          for (let h = 0; h < hiddenDim; h++) {
            let sum = 0;
            for (let o = 0; o < outputDim; o++) {
              sum += W2[o][h] * dz2[o];
            }
            dz1[h] = z1[h] > 0 ? sum : 0;
            gradb1[h] += dz1[h];
            for (let i = 0; i < inputDim; i++) {
              if (x[i] !== 0) {
                gradW1[h][i] += dz1[h] * x[i];
              }
            }
          }
        }

        // Apply Adam updates to parameters
        const scale = 1.0 / batchIndices.length;
        const lr = hyperparams.learningRate;

        // Update W2 and b2
        for (let o = 0; o < outputDim; o++) {
          const gb2 = gradb2[o] * scale;
          mb2[o] = beta1 * mb2[o] + (1 - beta1) * gb2;
          vb2[o] = beta2 * vb2[o] + (1 - beta2) * gb2 * gb2;
          const mb2Hat = mb2[o] / (1 - Math.pow(beta1, t));
          const vb2Hat = vb2[o] / (1 - Math.pow(beta2, t));
          b2[o] -= (lr * mb2Hat) / (Math.sqrt(vb2Hat) + epsilon);

          for (let h = 0; h < hiddenDim; h++) {
            const gW2 = gradW2[o][h] * scale;
            mW2[o][h] = beta1 * mW2[o][h] + (1 - beta1) * gW2;
            vW2[o][h] = beta2 * vW2[o][h] + (1 - beta2) * gW2 * gW2;
            const mW2Hat = mW2[o][h] / (1 - Math.pow(beta1, t));
            const vW2Hat = vW2[o][h] / (1 - Math.pow(beta2, t));
            W2[o][h] -= (lr * mW2Hat) / (Math.sqrt(vW2Hat) + epsilon);
          }
        }

        // Update W1 and b1
        for (let h = 0; h < hiddenDim; h++) {
          const gb1 = gradb1[h] * scale;
          mb1[h] = beta1 * mb1[h] + (1 - beta1) * gb1;
          vb1[h] = beta2 * vb1[h] + (1 - beta2) * gb1 * gb1;
          const mb1Hat = mb1[h] / (1 - Math.pow(beta1, t));
          const vb1Hat = vb1[h] / (1 - Math.pow(beta2, t));
          b1[h] -= (lr * mb1Hat) / (Math.sqrt(vb1Hat) + epsilon);

          for (let i = 0; i < inputDim; i++) {
            const gW1 = gradW1[h][i] * scale;
            mW1[h][i] = beta1 * mW1[h][i] + (1 - beta1) * gW1;
            vW1[h][i] = beta2 * vW1[h][i] + (1 - beta2) * gW1 * gW1;
            const mW1Hat = mW1[h][i] / (1 - Math.pow(beta1, t));
            const vW1Hat = vW1[h][i] / (1 - Math.pow(beta2, t));
            W1[h][i] -= (lr * mW1Hat) / (Math.sqrt(vW1Hat) + epsilon);
          }
        }
      }

      const trainLoss = totalTrainLoss / (trainData.length || 1);
      const trainAcc = correctTrain / (trainData.length || 1);

      // Evaluate validation split
      let valLoss = 0;
      let correctVal = 0;
      for (const sample of valData) {
        const x = sample.vector;
        const a1 = new Array(hiddenDim);
        for (let h = 0; h < hiddenDim; h++) {
          let sum = b1[h];
          for (let i = 0; i < inputDim; i++) {
            if (x[i] !== 0) sum += W1[h][i] * x[i];
          }
          a1[h] = sum > 0 ? sum : 0;
        }

        const z2 = new Array(outputDim);
        for (let o = 0; o < outputDim; o++) {
          let sum = b2[o];
          for (let h = 0; h < hiddenDim; h++) {
            sum += W2[o][h] * a1[h];
          }
          z2[o] = sum;
        }

        const yHat = this.softmax(z2);
        const prob = Math.max(yHat[sample.labelIndex], 1e-12);
        valLoss += -Math.log(prob);

        let maxIdx = 0;
        let maxVal = yHat[0];
        for (let o = 1; o < outputDim; o++) {
          if (yHat[o] > maxVal) {
            maxVal = yHat[o];
            maxIdx = o;
          }
        }
        if (maxIdx === sample.labelIndex) {
          correctVal++;
        }
      }

      valLoss = valLoss / (valData.length || 1);
      const valAcc = correctVal / (valData.length || 1);
      const epochDuration = Date.now() - epochStart;

      const metric: EpochMetric = {
        epoch,
        loss: parseFloat(trainLoss.toFixed(4)),
        accuracy: parseFloat(trainAcc.toFixed(4)),
        valLoss: parseFloat(valLoss.toFixed(4)),
        valAccuracy: parseFloat(valAcc.toFixed(4)),
        durationMs: epochDuration,
        learningRate: hyperparams.learningRate,
      };

      // Best model checkpoint tracking
      if (valLoss < bestValLoss) {
        bestValLoss = valLoss;
        patienceCounter = 0;
        bestWeights = {
          vocab,
          reverseVocab: Object.keys(vocab),
          labels,
          inputDim,
          hiddenDim,
          outputDim,
          W1: W1.map((r) => r.slice()),
          b1: b1.slice(),
          W2: W2.map((r) => r.slice()),
          b2: b2.slice(),
        };
      } else {
        patienceCounter++;
      }

      yield { type: 'epoch', metric };

      // Early stopping check
      if (patienceCounter >= hyperparams.earlyStoppingPatience && epoch > 8) {
        break;
      }

      // Small pause to allow event loop cooperative scheduling and smooth streaming
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const currentWeights: TrainedModelWeights = bestWeights || {
      vocab,
      reverseVocab: Object.keys(vocab),
      labels,
      inputDim,
      hiddenDim,
      outputDim,
      W1,
      b1,
      W2,
      b2,
    };

    const paramCount = inputDim * hiddenDim + hiddenDim + hiddenDim * outputDim + outputDim;
    const memoryKb = parseFloat(((paramCount * 4) / 1024).toFixed(2));

    yield {
      type: 'complete',
      weights: currentWeights,
      finalMetrics: {
        parameterCount: paramCount,
        memoryKb,
        bestValLoss: parseFloat(bestValLoss.toFixed(4)),
      },
    };
  }

  // Real inference on an input string
  public static predict(
    text: string,
    weights: TrainedModelWeights,
    config: PreprocessingConfig
  ): {
    label: string;
    confidence: number;
    probabilities: Record<string, number>;
    normalizedTokens: string[];
  } {
    let cleanText = text;
    if (config.lowercase) {
      cleanText = cleanText.toLocaleLowerCase('nb-NO');
    }
    if (config.stripPunctuation) {
      cleanText = cleanText.replace(/[^a-zA-ZæøåÆØÅ0-9\s]/g, ' ');
    }
    const rawTokens = cleanText
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const tokens: string[] = [];
    for (let i = 0; i < rawTokens.length; i++) {
      tokens.push(rawTokens[i]);
      if (i < rawTokens.length - 1) {
        tokens.push(`${rawTokens[i]}_${rawTokens[i + 1]}`);
      }
    }

    const x = new Array(weights.inputDim).fill(0);
    tokens.forEach((t) => {
      if (weights.vocab[t] !== undefined) {
        x[weights.vocab[t]] += 1.0;
      }
    });

    // L2 norm
    let sumSq = 0;
    for (let i = 0; i < weights.inputDim; i++) sumSq += x[i] * x[i];
    const norm = Math.sqrt(sumSq) || 1.0;
    for (let i = 0; i < weights.inputDim; i++) x[i] /= norm;

    // Forward
    const a1 = new Array(weights.hiddenDim);
    for (let h = 0; h < weights.hiddenDim; h++) {
      let sum = weights.b1[h];
      for (let i = 0; i < weights.inputDim; i++) {
        if (x[i] !== 0) sum += weights.W1[h][i] * x[i];
      }
      a1[h] = sum > 0 ? sum : 0;
    }

    const z2 = new Array(weights.outputDim);
    for (let o = 0; o < weights.outputDim; o++) {
      let sum = weights.b2[o];
      for (let h = 0; h < weights.hiddenDim; h++) {
        sum += weights.W2[o][h] * a1[h];
      }
      z2[o] = sum;
    }

    const probs = this.softmax(z2);
    let bestIdx = 0;
    let bestProb = probs[0];
    const probMap: Record<string, number> = {};

    for (let o = 0; o < weights.outputDim; o++) {
      const lbl = weights.labels[o];
      probMap[lbl] = parseFloat(probs[o].toFixed(4));
      if (probs[o] > bestProb) {
        bestProb = probs[o];
        bestIdx = o;
      }
    }

    return {
      label: weights.labels[bestIdx],
      confidence: parseFloat(bestProb.toFixed(4)),
      probabilities: probMap,
      normalizedTokens: rawTokens,
    };
  }

  // Full evaluation on test set (Confusion matrix, Precision, Recall, F1)
  public static evaluate(
    testSamples: PreprocessedSample[],
    weights: TrainedModelWeights,
    config: PreprocessingConfig,
    runId: string,
    datasetId: string
  ): EvaluationResult {
    const labels = weights.labels;
    const n = labels.length;
    const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    let correct = 0;
    let totalLoss = 0;

    const samplePredictions: EvaluationResult['samplePredictions'] = [];

    testSamples.forEach((sample) => {
      const pred = this.predict(sample.rawText, weights, config);
      const actualIdx = sample.labelIndex;
      const predIdx = labels.indexOf(pred.label);

      if (predIdx >= 0) {
        matrix[actualIdx][predIdx]++;
      }

      const isCorrect = pred.label === sample.label;
      if (isCorrect) correct++;

      const prob = pred.probabilities[sample.label] || 1e-12;
      totalLoss += -Math.log(prob);

      samplePredictions.push({
        text: sample.rawText,
        actual: sample.label,
        predicted: pred.label,
        confidence: pred.confidence,
        isCorrect,
      });
    });

    const perClassMetrics: EvaluationResult['perClassMetrics'] = {};
    for (let i = 0; i < n; i++) {
      const lbl = labels[i];
      let tp = matrix[i][i];
      let fn = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) fn += matrix[i][j];
      }
      let fp = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) fp += matrix[j][i];
      }

      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

      perClassMetrics[lbl] = {
        precision: parseFloat(precision.toFixed(3)),
        recall: parseFloat(recall.toFixed(3)),
        f1Score: parseFloat(f1.toFixed(3)),
        support: tp + fn,
      };
    }

    return {
      runId,
      datasetId,
      evaluatedAt: new Date().toISOString(),
      testSamplesCount: testSamples.length,
      testLoss: parseFloat((totalLoss / (testSamples.length || 1)).toFixed(4)),
      testAccuracy: parseFloat((correct / (testSamples.length || 1)).toFixed(4)),
      confusionMatrix: {
        labels,
        matrix,
      },
      perClassMetrics,
      samplePredictions,
    };
  }

  // Generates complete, compilable C/C++ Header file for embedded microcontrollers
  public static generateCHeader(weights: TrainedModelWeights, runId: string): string {
    const timestamp = new Date().toISOString();
    return `/*
 * ULTIMATE ORNITH 1.0 — Embedded TinyML Model Artifact
 * Target: Arduino Nano 33 BLE / ESP32 / STM32 / ARM Cortex-M
 * Model Run ID: ${runId}
 * Generated: ${timestamp}
 * Vocabulary Size: ${weights.inputDim}
 * Hidden Units: ${weights.hiddenDim}
 * Output Classes: ${weights.outputDim}
 */

#ifndef ORNITH_TINYML_MODEL_H
#define ORNITH_TINYML_MODEL_H

#include <stdint.h>
#include <string.h>
#include <math.h>

#define ORNITH_INPUT_DIM ${weights.inputDim}
#define ORNITH_HIDDEN_DIM ${weights.hiddenDim}
#define ORNITH_OUTPUT_DIM ${weights.outputDim}

// Class label definitions
static const char* ORNITH_CLASS_LABELS[ORNITH_OUTPUT_DIM] = {
${weights.labels.map((lbl) => `  "${lbl}"`).join(',\n')}
};

// Layer 1 Biases
static const float ORNITH_B1[ORNITH_HIDDEN_DIM] = {
  ${weights.b1.map((b) => b.toFixed(6) + 'f').join(', ')}
};

// Layer 1 Weights [hiddenDim][inputDim]
static const float ORNITH_W1[ORNITH_HIDDEN_DIM][ORNITH_INPUT_DIM] = {
${weights.W1.map((row) => `  { ${row.map((v) => v.toFixed(6) + 'f').join(', ')} }`).join(',\n')}
};

// Layer 2 Biases
static const float ORNITH_B2[ORNITH_OUTPUT_DIM] = {
  ${weights.b2.map((b) => b.toFixed(6) + 'f').join(', ')}
};

// Layer 2 Weights [outputDim][hiddenDim]
static const float ORNITH_W2[ORNITH_OUTPUT_DIM][ORNITH_HIDDEN_DIM] = {
${weights.W2.map((row) => `  { ${row.map((v) => v.toFixed(6) + 'f').join(', ')} }`).join(',\n')}
};

// Embedded TinyML Forward Inference
static inline int ornith_predict(const float* input_vector, float* output_probabilities) {
    float hidden[ORNITH_HIDDEN_DIM];
    
    // Hidden Layer with ReLU
    for (int h = 0; h < ORNITH_HIDDEN_DIM; h++) {
        float sum = ORNITH_B1[h];
        for (int i = 0; i < ORNITH_INPUT_DIM; i++) {
            if (input_vector[i] != 0.0f) {
                sum += ORNITH_W1[h][i] * input_vector[i];
            }
        }
        hidden[h] = (sum > 0.0f) ? sum : 0.0f; // ReLU
    }

    // Output Layer with Softmax
    float logits[ORNITH_OUTPUT_DIM];
    float max_val = -1e9f;
    for (int o = 0; o < ORNITH_OUTPUT_DIM; o++) {
        float sum = ORNITH_B2[o];
        for (int h = 0; h < ORNITH_HIDDEN_DIM; h++) {
            sum += ORNITH_W2[o][h] * hidden[h];
        }
        logits[o] = sum;
        if (sum > max_val) max_val = sum;
    }

    float sum_exp = 0.0f;
    for (int o = 0; o < ORNITH_OUTPUT_DIM; o++) {
        output_probabilities[o] = expf(logits[o] - max_val);
        sum_exp += output_probabilities[o];
    }
    
    int best_class = 0;
    float best_prob = 0.0f;
    for (int o = 0; o < ORNITH_OUTPUT_DIM; o++) {
        output_probabilities[o] /= sum_exp;
        if (output_probabilities[o] > best_prob) {
            best_prob = output_probabilities[o];
            best_class = o;
        }
    }

    return best_class;
}

#endif // ORNITH_TINYML_MODEL_H
`;
  }
}
