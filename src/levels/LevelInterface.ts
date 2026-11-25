import type { AssessmentEngine } from '../core/AssessmentEngine';
import type { EventBus } from '../core/EventBus';
import type { InteractionManager } from '../core/InteractionManager';
import type { CellEnvironment } from '../core/types';
import type { BenchManual } from '../ui/BenchManual';
import type { MolecularPool } from '../ui/MolecularPool';
import type { StatusHUD } from '../ui/StatusHUD';

export interface LevelMetadata {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  environment: CellEnvironment;
}

export interface LevelContext {
  stageSvg: SVGSVGElement;
  bus: EventBus;
  interaction: InteractionManager;
  assessment: AssessmentEngine;
  hud: StatusHUD;
  pool: MolecularPool;
  manual: BenchManual;
}

/**
 * Contrato base que todo nível de Locus Zero implementa a partir da Fase 2.
 */
export interface ILevel {
  readonly metadata: LevelMetadata;
  mount(context: LevelContext): void;
  unmount(): void;
  reset(): void;
}
