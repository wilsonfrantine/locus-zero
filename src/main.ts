import './styles/tokens.css';
import './styles/animations.css';
import './styles/layout.css';

import { AssessmentEngine } from './core/AssessmentEngine';
import { EventBus } from './core/EventBus';
import { InteractionManager } from './core/InteractionManager';
import type { StorageAdapter } from './core/types';
import type { ILevel } from './levels/LevelInterface';
import { LacView } from './levels/level1-lac/LacView';
import { BenchManual } from './ui/BenchManual';
import { MolecularPool } from './ui/MolecularPool';
import { StatusHUD } from './ui/StatusHUD';

function createLocalStorageAdapter(): StorageAdapter {
  const memoryFallback = new Map<string, string>();

  return {
    getItem(key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        memoryFallback.set(key, value);
      }
    },
    removeItem(key: string): void {
      try {
        window.localStorage.removeItem(key);
      } catch {
        memoryFallback.delete(key);
      }
    },
  };
}

function bootstrap(): void {
  const app = document.getElementById('app');
  if (!app) {
    throw new Error('Elemento raiz #app não encontrado.');
  }

  const bus = new EventBus();
  const assessment = new AssessmentEngine(createLocalStorageAdapter());
  const interaction = new InteractionManager(bus);

  let activeLevelId = assessment.getState().currentLevelId ?? 'level1-lac';
  let activeLevel: ILevel | null = null;

  app.innerHTML = `
    <div class="cell-viewport" data-environment="cytoplasm">
      <div class="cell-bg-layer" aria-hidden="true">
        <svg class="cell-bg-svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="cyto-granules" width="120" height="120" patternUnits="userSpaceOnUse">
              <circle cx="18" cy="24" r="1.1" fill="#94a3b8" fill-opacity="0.08" />
              <circle cx="64" cy="48" r="0.9" fill="#38bdf8" fill-opacity="0.06" />
              <circle cx="96" cy="18" r="1.3" fill="#94a3b8" fill-opacity="0.05" />
              <circle cx="42" cy="92" r="1" fill="#10b981" fill-opacity="0.05" />
              <circle cx="104" cy="86" r="0.8" fill="#94a3b8" fill-opacity="0.07" />
            </pattern>
          </defs>
          <rect width="1200" height="700" fill="url(#cyto-granules)" />
          <path class="ambient-filament" d="M -40 210 Q 320 175 680 235 T 1240 195" fill="none" stroke="#94a3b8" stroke-opacity="0.05" stroke-width="1.4" />
          <path class="ambient-filament" d="M -40 560 Q 390 595 760 545 T 1240 575" fill="none" stroke="#38bdf8" stroke-opacity="0.05" stroke-width="1.2" />
          <path class="ambient-filament" d="M 160 -20 Q 220 260 180 720" fill="none" stroke="#94a3b8" stroke-opacity="0.035" stroke-width="1.1" />
        </svg>
      </div>

      <main class="stage-layer">
        <svg
          id="molecular-stage"
          class="molecular-stage"
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          role="img"
          aria-label="Palco molecular intracelular"
        ></svg>
      </main>

      <div class="hud-layer" id="hud-layer"></div>

      <section class="landing-screen" id="landing-screen" aria-labelledby="landing-title">
        <div class="landing-card">
          <span class="landing-card__eyebrow">Simulador BioRender Vivo</span>
          <h1 class="landing-card__title" id="landing-title">Locus Zero: Crise Intracelular</h1>
          <p class="landing-card__subtitle">
            Manipule diretamente moléculas, sinais ambientais e complexos enzimáticos para restaurar a expressão gênica celular.
          </p>
          <div class="landing-card__actions">
            <button type="button" class="btn-primary" id="start-mission-btn">Iniciar Missão</button>
            <span class="landing-card__saved" id="saved-progress-note" hidden></span>
            <button type="button" class="btn-ghost" id="reset-progress-btn" hidden>Reiniciar Progresso Salvo</button>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewportEl = app.querySelector('.cell-viewport') as HTMLElement;
  const stageSvg = document.getElementById('molecular-stage') as unknown as SVGSVGElement;
  const hudLayer = document.getElementById('hud-layer') as HTMLElement;
  const landingScreen = document.getElementById('landing-screen') as HTMLElement;
  const startMissionBtn = document.getElementById('start-mission-btn') as HTMLButtonElement;
  const savedProgressNote = document.getElementById('saved-progress-note') as HTMLElement;
  const resetProgressBtn = document.getElementById('reset-progress-btn') as HTMLButtonElement;

  interaction.attachStage(stageSvg);

  const manual = new BenchManual(app, {
    bus,
    getCurrentLevelId: () => activeLevelId,
  });

  const hud = new StatusHUD(hudLayer, {
    bus,
    onOpenManual: () => manual.open(),
  });

  const pool = new MolecularPool(hudLayer, {
    bus,
    interaction,
  });

  bus.on('manual:opened', ({ levelId, moleculeId }) => {
    assessment.recordManualOpen(levelId, moleculeId);
  });

  const mountLevel = (level: ILevel): void => {
    activeLevel?.unmount();
    activeLevel = level;
    activeLevelId = level.metadata.id;
    viewportEl.dataset.environment = level.metadata.environment;
    level.mount({
      stageSvg,
      bus,
      interaction,
      assessment,
      hud,
      pool,
      manual,
    });
  };

  const syncLandingProgressState = (): void => {
    const hasSaved = assessment.hasSavedProgress();
    savedProgressNote.hidden = !hasSaved;
    resetProgressBtn.hidden = !hasSaved;
    if (hasSaved) {
      savedProgressNote.textContent = 'Sessão anterior preservada localmente.';
      startMissionBtn.textContent = 'Continuar Missão';
    } else {
      startMissionBtn.textContent = 'Iniciar Missão';
    }
  };

  syncLandingProgressState();

  startMissionBtn.addEventListener('click', () => {
    landingScreen.dataset.hidden = 'true';
    mountLevel(new LacView());
  });

  resetProgressBtn.addEventListener('click', () => {
    activeLevel?.unmount();
    activeLevel = null;
    assessment.resetProgress();
    syncLandingProgressState();
  });
}

bootstrap();
