import type {
  LevelDiagnostic,
  LevelScoreBreakdown,
  LevelTelemetry,
  MoleculeId,
  PersistedAssessmentState,
  StorageAdapter,
  StudentInfo,
} from './types';

export const ASSESSMENT_STORAGE_KEY = 'locus-zero:progress:v1';
export const DEFAULT_LEVEL_ORDER: readonly string[] = [
  'level1-lac',
  'level2-chromatin',
  'level3-combinatorial',
  'level4-posttrans',
];

export interface ActionRecordResult {
  telemetry: LevelTelemetry;
  consecutiveErrors: number;
  shouldHighlightManual: boolean;
  hintMoleculeId?: MoleculeId;
}

class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function createInitialState(levelOrder: readonly string[], now: number): PersistedAssessmentState {
  const firstLevel = levelOrder[0] ?? 'level1-lac';
  return {
    version: 1,
    currentLevelId: null,
    unlockedLevelIds: [firstLevel],
    levels: {},
    openedManualEntries: {},
    discoveredMolecules: {},
    updatedAt: now,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeTelemetry(levelId: string, raw: unknown, fallbackNow: number): LevelTelemetry | null {
  if (!isRecord(raw)) return null;

  const startTime = typeof raw.startTime === 'number' && Number.isFinite(raw.startTime)
    ? raw.startTime
    : fallbackNow;
  const endTime = typeof raw.endTime === 'number' && Number.isFinite(raw.endTime)
    ? raw.endTime
    : undefined;

  return {
    levelId: typeof raw.levelId === 'string' ? raw.levelId : levelId,
    startTime,
    endTime,
    validActions: typeof raw.validActions === 'number' && raw.validActions >= 0 ? Math.floor(raw.validActions) : 0,
    invalidActions: typeof raw.invalidActions === 'number' && raw.invalidActions >= 0 ? Math.floor(raw.invalidActions) : 0,
    manualOpens: typeof raw.manualOpens === 'number' && raw.manualOpens >= 0 ? Math.floor(raw.manualOpens) : 0,
    mutationAttempts: typeof raw.mutationAttempts === 'number' && raw.mutationAttempts >= 0 ? Math.floor(raw.mutationAttempts) : 0,
    completed: Boolean(raw.completed),
  };
}

/**
 * Engine pura de telemetria silenciosa, rubrica (0-100) e persistência.
 * Nunca referencia DOM, window, document ou CSS.
 */
export class AssessmentEngine {
  private readonly storage: StorageAdapter;
  private readonly levelOrder: readonly string[];
  private readonly nowProvider: () => number;
  private state: PersistedAssessmentState;
  private readonly consecutiveErrorsByLevel = new Map<string, number>();

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter(),
    levelOrder: readonly string[] = DEFAULT_LEVEL_ORDER,
    nowProvider: () => number = () => Date.now(),
  ) {
    this.storage = storage;
    this.levelOrder = levelOrder.length > 0 ? [...levelOrder] : [...DEFAULT_LEVEL_ORDER];
    this.nowProvider = nowProvider;
    this.state = this.hydrate();
  }

  getState(): PersistedAssessmentState {
    return structuredClone(this.state);
  }

  hasSavedProgress(): boolean {
    return (
      this.state.currentLevelId !== null ||
      Object.keys(this.state.levels).length > 0 ||
      this.state.unlockedLevelIds.length > 1
    );
  }

  getUnlockedLevelIds(): string[] {
    return [...this.state.unlockedLevelIds];
  }

  getDiscoveredMolecules(levelId: string): MoleculeId[] {
    return [...(this.state.discoveredMolecules[levelId] ?? [])];
  }

  getLevelTelemetry(levelId: string): LevelTelemetry | null {
    const telemetry = this.state.levels[levelId];
    return telemetry ? { ...telemetry } : null;
  }

  startLevel(levelId: string): LevelTelemetry {
    const now = this.nowProvider();
    this.state.currentLevelId = levelId;

    if (!this.state.unlockedLevelIds.includes(levelId)) {
      this.state.unlockedLevelIds.push(levelId);
    }

    if (!this.state.levels[levelId]) {
      this.state.levels[levelId] = {
        levelId,
        startTime: now,
        validActions: 0,
        invalidActions: 0,
        manualOpens: 0,
        mutationAttempts: 0,
        completed: false,
      };
    }

    if (!this.state.openedManualEntries[levelId]) {
      this.state.openedManualEntries[levelId] = {};
    }

    if (!this.state.discoveredMolecules[levelId]) {
      this.state.discoveredMolecules[levelId] = [];
    }

    this.persist();
    return { ...this.state.levels[levelId] };
  }

  recordMoleculeDiscovered(levelId: string, moleculeId: MoleculeId): void {
    const list = this.state.discoveredMolecules[levelId] ?? [];
    if (!list.includes(moleculeId)) {
      this.state.discoveredMolecules[levelId] = [...list, moleculeId];
      this.persist();
    }
  }

  recordAction(
    levelId: string,
    valid: boolean,
    hintMoleculeId?: MoleculeId,
  ): ActionRecordResult {
    const telemetry = this.ensureLevelTelemetry(levelId);

    if (valid) {
      telemetry.validActions += 1;
      this.consecutiveErrorsByLevel.set(levelId, 0);
      this.persist();
      return {
        telemetry: { ...telemetry },
        consecutiveErrors: 0,
        shouldHighlightManual: false,
      };
    }

    telemetry.invalidActions += 1;
    const nextErrors = (this.consecutiveErrorsByLevel.get(levelId) ?? 0) + 1;
    this.consecutiveErrorsByLevel.set(levelId, nextErrors);
    this.persist();

    return {
      telemetry: { ...telemetry },
      consecutiveErrors: nextErrors,
      shouldHighlightManual: nextErrors >= 2,
      hintMoleculeId,
    };
  }

  recordManualOpen(levelId: string, moleculeId?: MoleculeId): LevelTelemetry {
    const telemetry = this.ensureLevelTelemetry(levelId);
    telemetry.manualOpens += 1;

    if (moleculeId) {
      const entries = this.state.openedManualEntries[levelId] ?? {};
      entries[moleculeId] = (entries[moleculeId] ?? 0) + 1;
      this.state.openedManualEntries[levelId] = entries;
    }

    this.persist();
    return { ...telemetry };
  }

  recordMutationAttempt(levelId: string, passed: boolean): {
    telemetry: LevelTelemetry;
    nextLevelId: string | null;
  } {
    const telemetry = this.ensureLevelTelemetry(levelId);
    if (!telemetry.completed) {
      telemetry.mutationAttempts += 1;
    }

    let nextLevelId: string | null = null;
    if (passed) {
      telemetry.completed = true;
      if (telemetry.endTime === undefined) {
        telemetry.endTime = this.nowProvider();
      }
      nextLevelId = this.unlockNextLevel(levelId);
    }

    this.persist();
    return {
      telemetry: { ...telemetry },
      nextLevelId,
    };
  }

  setStudentInfo(student: StudentInfo): void {
    this.state.student = {
      fullName: student.fullName.trim(),
      registrationId: student.registrationId.trim(),
    };
    this.persist();
  }

  resetProgress(): PersistedAssessmentState {
    this.consecutiveErrorsByLevel.clear();
    this.state = createInitialState(this.levelOrder, this.nowProvider());
    this.storage.removeItem(ASSESSMENT_STORAGE_KEY);
    this.persist();
    return this.getState();
  }

  /**
   * Rubrica oficial (spec 01):
   * - Resolução da Crise Celular: 50 pts
   * - Precisão Experimental: 20 pts, -2 por erro após os 2 primeiros, mín 4 pts
   * - Autonomia / Uso do Manual: 10 pts, 1ª abertura por ficha livre, -2 a partir de 4 repetidas, mín 4 pts
   * - Trava de Saída: 1ª = 20 pts, 2ª = 12 pts, 3ª+ = 6 pts
   */
  calculateLevelScore(levelId: string): LevelScoreBreakdown {
    const telemetry = this.state.levels[levelId];
    if (!telemetry || !telemetry.completed) {
      return {
        levelId,
        crisisResolution: 0,
        experimentalPrecision: 0,
        manualAutonomy: 0,
        mutationChallenge: 0,
        total: 0,
        completed: false,
      };
    }

    const crisisResolution = 50;

    const penalizedErrors = Math.max(0, telemetry.invalidActions - 2);
    const experimentalPrecision = Math.max(4, 20 - penalizedErrors * 2);

    const entryCounts = this.state.openedManualEntries[levelId] ?? {};
    const uniqueConsultedEntries = Object.keys(entryCounts).length;
    const repeatedOpens = Math.max(0, telemetry.manualOpens - uniqueConsultedEntries);
    const manualPenalty = repeatedOpens >= 4 ? (repeatedOpens - 3) * 2 : 0;
    const manualAutonomy = Math.max(4, 10 - manualPenalty);

    let mutationChallenge = 6;
    if (telemetry.mutationAttempts <= 1) {
      mutationChallenge = 20;
    } else if (telemetry.mutationAttempts === 2) {
      mutationChallenge = 12;
    }

    return {
      levelId,
      crisisResolution,
      experimentalPrecision,
      manualAutonomy,
      mutationChallenge,
      total: crisisResolution + experimentalPrecision + manualAutonomy + mutationChallenge,
      completed: true,
    };
  }

  calculateFinalGrade(): number {
    if (this.levelOrder.length === 0) return 0;
    const sum = this.levelOrder.reduce((acc, id) => acc + this.calculateLevelScore(id).total, 0);
    const averageOutOfTen = sum / (this.levelOrder.length * 10);
    return Math.round(averageOutOfTen * 10) / 10;
  }

  getTotalTimeMs(): number {
    return this.levelOrder.reduce((total, id) => {
      const t = this.state.levels[id];
      if (!t) return total;
      const end = t.endTime ?? this.nowProvider();
      return total + Math.max(0, end - t.startTime);
    }, 0);
  }

  getDiagnostics(levelTitles: Record<string, string>): LevelDiagnostic[] {
    return this.levelOrder.map((levelId) => {
      const title = levelTitles[levelId] ?? levelId;
      const breakdown = this.calculateLevelScore(levelId);
      if (!breakdown.completed) {
        return {
          levelId,
          title,
          score: 0,
          status: 'pending',
          summary: `Pendente: ${title}`,
        };
      }

      if (breakdown.total >= 85) {
        return {
          levelId,
          title,
          score: breakdown.total,
          status: 'strong',
          summary: `Ponto forte: ${title}`,
        };
      }

      if (breakdown.total >= 70) {
        return {
          levelId,
          title,
          score: breakdown.total,
          status: 'moderate',
          summary: `Bom domínio: ${title}`,
        };
      }

      return {
        levelId,
        title,
        score: breakdown.total,
        status: 'review',
        summary: `Revisar: ${title}`,
      };
    });
  }

  buildIntegrityPayload(registrationId: string, salt = 'LOCUS-ZERO-2026'): string {
    const scores = this.levelOrder.map((id) => `${id}:${this.calculateLevelScore(id).total}`).join('|');
    return `${registrationId.trim()}::${scores}::${this.calculateFinalGrade().toFixed(1)}::${salt}`;
  }

  private ensureLevelTelemetry(levelId: string): LevelTelemetry {
    return this.state.levels[levelId] ?? this.startLevel(levelId);
  }

  private unlockNextLevel(currentLevelId: string): string | null {
    const idx = this.levelOrder.indexOf(currentLevelId);
    if (idx === -1 || idx + 1 >= this.levelOrder.length) {
      return null;
    }
    const nextLevelId = this.levelOrder[idx + 1];
    if (!this.state.unlockedLevelIds.includes(nextLevelId)) {
      this.state.unlockedLevelIds.push(nextLevelId);
    }
    return nextLevelId;
  }

  private hydrate(): PersistedAssessmentState {
    const now = this.nowProvider();
    const fallback = createInitialState(this.levelOrder, now);

    try {
      const raw = this.storage.getItem(ASSESSMENT_STORAGE_KEY);
      if (!raw) return fallback;

      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== 1) {
        return fallback;
      }

      const levels: Record<string, LevelTelemetry> = {};
      if (isRecord(parsed.levels)) {
        for (const [id, entry] of Object.entries(parsed.levels)) {
          const clean = sanitizeTelemetry(id, entry, now);
          if (clean) {
            levels[id] = clean;
          }
        }
      }

      const unlocked = Array.isArray(parsed.unlockedLevelIds)
        ? parsed.unlockedLevelIds.filter((id): id is string => typeof id === 'string')
        : [...fallback.unlockedLevelIds];
      if (unlocked.length === 0) {
        unlocked.push(fallback.unlockedLevelIds[0]);
      }

      const openedManualEntries: Record<string, Record<string, number>> = {};
      if (isRecord(parsed.openedManualEntries)) {
        for (const [lvl, entries] of Object.entries(parsed.openedManualEntries)) {
          if (!isRecord(entries)) continue;
          const cleanEntries: Record<string, number> = {};
          for (const [molId, count] of Object.entries(entries)) {
            if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
              cleanEntries[molId] = Math.floor(count);
            }
          }
          openedManualEntries[lvl] = cleanEntries;
        }
      }

      const discoveredMolecules: Record<string, MoleculeId[]> = {};
      if (isRecord(parsed.discoveredMolecules)) {
        for (const [lvl, list] of Object.entries(parsed.discoveredMolecules)) {
          if (Array.isArray(list)) {
            discoveredMolecules[lvl] = list.filter((id): id is string => typeof id === 'string');
          }
        }
      }

      let student: StudentInfo | undefined;
      if (
        isRecord(parsed.student) &&
        typeof parsed.student.fullName === 'string' &&
        typeof parsed.student.registrationId === 'string'
      ) {
        student = {
          fullName: parsed.student.fullName,
          registrationId: parsed.student.registrationId,
        };
      }

      return {
        version: 1,
        currentLevelId: typeof parsed.currentLevelId === 'string' ? parsed.currentLevelId : null,
        unlockedLevelIds: unlocked,
        levels,
        openedManualEntries,
        discoveredMolecules,
        student,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : now,
      };
    } catch {
      return fallback;
    }
  }

  private persist(): void {
    this.state.updatedAt = this.nowProvider();
    try {
      this.storage.setItem(ASSESSMENT_STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Silencioso em caso de cota cheia ou storage bloqueado
    }
  }
}
