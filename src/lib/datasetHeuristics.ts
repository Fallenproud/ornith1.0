/**
 * ULTIMATE ORNITH 1.0 — Dataset Heuristics & Remediation Engine
 *
 * Implements intelligent heuristics for:
 * 1. Duplicate detection (Exact matches, duplicate-with-conflicting-label, near-duplicates)
 * 2. Missing & invalid label detection (unlabeled, placeholders, empty labels)
 * 3. Automated remediation plans & record filtering
 */

import { DatasetRecord } from "../types";

export interface DuplicateGroup {
  normalizedText: string;
  originalText: string;
  records: DatasetRecord[];
  hasConflictingLabels: boolean;
  distinctLabels: string[];
  canonicalRecordId: string;
  redundantRecordIds: string[];
}

export interface MissingLabelFinding {
  record: DatasetRecord;
  reason: "empty" | "placeholder" | "unknown_intent";
}

export interface DatasetHeuristicsReport {
  totalRecords: number;
  healthScore: number; // 0 - 100
  duplicateGroups: DuplicateGroup[];
  totalDuplicatesCount: number; // redundant record IDs
  conflictingDuplicatesCount: number;
  missingLabelFindings: MissingLabelFinding[];
  totalMissingLabelsCount: number;
  removableDuplicateIds: string[];
  removableMissingLabelIds: string[];
  allRemovableIds: string[];
  summaryMessage: string;
}

const UNLABELED_PLACEHOLDERS = new Set([
  "",
  "unlabeled",
  "ukjent",
  "unknown",
  "null",
  "undefined",
  "none",
  "mangler",
  "missing",
  "-",
  "?",
  "n/a",
  "na",
]);

/**
 * Normalizes text for exact and near-duplicate matching
 */
export function normalizeTextHeuristic(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Performs heuristic analysis on dataset records
 */
export function analyzeDatasetHeuristics(
  records: DatasetRecord[],
): DatasetHeuristicsReport {
  const totalRecords = records.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      healthScore: 100,
      duplicateGroups: [],
      totalDuplicatesCount: 0,
      conflictingDuplicatesCount: 0,
      missingLabelFindings: [],
      totalMissingLabelsCount: 0,
      removableDuplicateIds: [],
      removableMissingLabelIds: [],
      allRemovableIds: [],
      summaryMessage: "Datasettet er tomt.",
    };
  }

  // 1. Group by normalized text to find duplicates
  const textMap = new Map<string, DatasetRecord[]>();
  records.forEach((record) => {
    const key = normalizeTextHeuristic(record.text);
    if (!textMap.has(key)) {
      textMap.set(key, []);
    }
    textMap.get(key)!.push(record);
  });

  const duplicateGroups: DuplicateGroup[] = [];
  const removableDuplicateIds: string[] = [];
  let conflictingDuplicatesCount = 0;

  textMap.forEach((groupRecords, normKey) => {
    if (groupRecords.length > 1) {
      const distinctLabels = Array.from(
        new Set(groupRecords.map((r) => (r.label || "").trim().toLowerCase())),
      );
      const hasConflictingLabels = distinctLabels.length > 1;
      if (hasConflictingLabels) {
        conflictingDuplicatesCount += groupRecords.length - 1;
      }

      // First record is canonical, rest are redundant
      const canonical = groupRecords[0];
      const redundant = groupRecords.slice(1);
      const redundantIds = redundant.map((r) => r.id);

      redundantIds.forEach((id) => removableDuplicateIds.push(id));

      duplicateGroups.push({
        normalizedText: normKey,
        originalText: canonical.text,
        records: groupRecords,
        hasConflictingLabels,
        distinctLabels,
        canonicalRecordId: canonical.id,
        redundantRecordIds: redundantIds,
      });
    }
  });

  // 2. Identify missing / placeholder labels
  const missingLabelFindings: MissingLabelFinding[] = [];
  const removableMissingLabelIds: string[] = [];

  records.forEach((record) => {
    const rawLabel = (record.label || "").trim();
    const lowerLabel = rawLabel.toLowerCase();

    if (!rawLabel) {
      missingLabelFindings.push({
        record,
        reason: "empty",
      });
      removableMissingLabelIds.push(record.id);
    } else if (UNLABELED_PLACEHOLDERS.has(lowerLabel)) {
      missingLabelFindings.push({
        record,
        reason: lowerLabel === "ukjent" || lowerLabel === "unknown" ? "unknown_intent" : "placeholder",
      });
      removableMissingLabelIds.push(record.id);
    }
  });

  // Set of unique IDs to remove for full cleanup
  const allRemovableIdsSet = new Set<string>([
    ...removableDuplicateIds,
    ...removableMissingLabelIds,
  ]);
  const allRemovableIds = Array.from(allRemovableIdsSet);

  // Health score calculation (100% - penalty for flaws)
  const duplicatePenalty = Math.min(35, (removableDuplicateIds.length / totalRecords) * 100 * 1.5);
  const conflictingPenalty = Math.min(30, (conflictingDuplicatesCount / totalRecords) * 100 * 2.0);
  const missingPenalty = Math.min(35, (removableMissingLabelIds.length / totalRecords) * 100 * 2.0);

  const rawScore = 100 - (duplicatePenalty + conflictingPenalty + missingPenalty);
  const healthScore = Math.max(10, Math.min(100, Math.round(rawScore)));

  // Generate concise Norwegian summary message
  let summaryMessage = "Datasettets helsetilstand er god.";
  if (allRemovableIds.length > 0) {
    const parts = [];
    if (removableDuplicateIds.length > 0) {
      parts.push(`${removableDuplicateIds.length} overflødige dubletter`);
    }
    if (conflictingDuplicatesCount > 0) {
      parts.push(`${conflictingDuplicatesCount} motstridende merkelapper`);
    }
    if (removableMissingLabelIds.length > 0) {
      parts.push(`${removableMissingLabelIds.length} rader uten gyldig merkelapp`);
    }
    summaryMessage = `Identifiserte ${parts.join(" og ")}.`;
  }

  return {
    totalRecords,
    healthScore,
    duplicateGroups,
    totalDuplicatesCount: removableDuplicateIds.length,
    conflictingDuplicatesCount,
    missingLabelFindings,
    totalMissingLabelsCount: removableMissingLabelIds.length,
    removableDuplicateIds,
    removableMissingLabelIds,
    allRemovableIds,
    summaryMessage,
  };
}
