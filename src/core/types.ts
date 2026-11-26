export type MoleculeId = string;
export type ZoneId = string;

export type MoleculeRole =
  | 'activator'
  | 'repressor'
  | 'enzyme'
  | 'small-molecule'
  | 'epigenetic';

export type CellEnvironment = 'cytoplasm' | 'nucleus';

export interface SvgPoint {
  x: number;
  y: number;
}

export interface MoleculeSpec {
  id: MoleculeId;
  label: string;          // Curto: "LacI", "cAMP", "RNAP"
  fullName: string;       // Para o Manual: "Proteína Repressora LacI"
  role: MoleculeRole;
  summary: string;        // 2 linhas para o card de Scan
  manualEntry: string;    // Explicação técnica curta para o Manual
  discovered: boolean;
  available?: boolean;    // Disponibilidade atual no Pool Molecular (padrão: true)
}

export interface ActionFeedback {
  valid: boolean;
  eventCode: string;      // Ex: 'BUMP_REPRESSOR', 'COMPLEX_FORMED'
  message: string;        // Feedback curto na tela
  hintMoleculeId?: MoleculeId; // Destaca ficha no Manual se houver erro repetido
}

export interface LevelTelemetry {
  levelId: string;
  startTime: number;
  endTime?: number;
  validActions: number;
  invalidActions: number;     // Tentativas de força bruta ou erro conceitual
  manualOpens: number;        // Consultas ao Manual de Bancada
  mutationAttempts: number;   // Tentativas na Trava de Saída (1 = acertou de primeira)
  completed: boolean;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LevelScoreBreakdown {
  levelId: string;
  crisisResolution: number;
  experimentalPrecision: number;
  manualAutonomy: number;
  mutationChallenge: number;
  total: number;
  completed: boolean;
}

export interface LevelDiagnostic {
  levelId: string;
  title: string;
  score: number;
  status: 'strong' | 'moderate' | 'review' | 'pending';
  summary: string;
}

export interface StudentInfo {
  fullName: string;
  registrationId: string;
}

export interface PersistedAssessmentState {
  version: 1;
  currentLevelId: string | null;
  unlockedLevelIds: string[];
  levels: Record<string, LevelTelemetry>;
  openedManualEntries: Record<string, Record<string, number>>;
  discoveredMolecules: Record<string, MoleculeId[]>;
  student?: StudentInfo;
  updatedAt: number;
}

export interface HudStatusState {
  levelId: string;
  levelLabel: string;
  statusText: string;
  cellHealth: number; // 0..100
  severity: 'ok' | 'warning' | 'danger';
}

export interface DropZoneConfig {
  id: ZoneId;
  element: SVGElement | HTMLElement;
  x: number;
  y: number;
  hitRadius: number;
  hitPadding?: number;
  accepts?: (moleculeId: MoleculeId) => boolean;
}

export interface DraggableConfig {
  moleculeId: MoleculeId;
  element: HTMLElement | SVGElement;
  source: 'pool' | 'stage';
  discovered: boolean;
  label?: string;
  role?: MoleculeRole;
  origin?: SvgPoint;
}

export interface InvestigativeClue {
  id: string;
  tag: string;           // Ex: "Membrana", "Operador", "Sinal", "Promotor"
  shortText: string;     // Texto curto na barra Pistas
  detailText: string;    // Pergunta/orientação investigativa no Popup de Foco
  solved: boolean;
}

export interface NotebookNote {
  id: string;
  tag: string;
  role: string;
  title: string;
  description: string;
}

export interface AppEventMap {
  'hud:update': HudStatusState;
  'pool:updated': {
    molecules: MoleculeSpec[];
    selectedId: MoleculeId | null;
  };
  'clues:updated': {
    clues: InvestigativeClue[];
  };
  'clues:inspect': {
    clue: InvestigativeClue;
  };
  'pool:inspect': { moleculeId: MoleculeId };
  'notebook:note': NotebookNote;
  'notebook:count': { count: number };
  'interaction:scan': { moleculeId: MoleculeId };
  'interaction:selection-changed': { moleculeId: MoleculeId | null };
  'interaction:apply': {
    moleculeId: MoleculeId;
    targetZoneId: ZoneId;
    mode: 'drag' | 'click';
  };
  'feedback:action': ActionFeedback;
  'manual:opened': { levelId: string; moleculeId?: MoleculeId };
  'manual:closed': { levelId: string };
  'manual:hint': { moleculeId?: MoleculeId; consecutiveErrors: number };
  'assessment:updated': { state: PersistedAssessmentState };
  'level:completed': { levelId: string; nextLevelId: string | null };
}
