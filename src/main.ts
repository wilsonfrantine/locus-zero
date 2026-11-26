import './styles/tokens.css';
import './styles/animations.css';
import './styles/layout.css';

import { AssessmentEngine } from './core/AssessmentEngine';
import { EventBus } from './core/EventBus';
import { InteractionManager } from './core/InteractionManager';
import { SoundManager } from './core/SoundManager';
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
  const storage = createLocalStorageAdapter();
  const assessment = new AssessmentEngine(storage);
  const interaction = new InteractionManager(bus);
  const sound = new SoundManager({ bus, storage });

  let activeLevelId = assessment.getState().currentLevelId ?? 'level1-lac';
  let activeLevel: ILevel | null = null;

  app.innerHTML = `
    <div class="cell-viewport" data-environment="cytoplasm">
      <div class="cell-bg-layer" aria-hidden="true">
        <svg class="cell-bg-svg" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
          <defs>
            <!-- Padrão denso de macromoléculas e ribossomos de fundo (custo único de tile, baixo contraste para não competir com o palco) -->
            <pattern id="cyto-granules" width="160" height="160" patternUnits="userSpaceOnUse">
              <circle cx="16" cy="22" r="1.4" fill="#94a3b8" fill-opacity="0.14" />
              <circle cx="48" cy="14" r="2.2" fill="#64748b" fill-opacity="0.12" />
              <circle cx="52" cy="17" r="1.5" fill="#64748b" fill-opacity="0.1" />
              <circle cx="88" cy="36" r="1.1" fill="#38bdf8" fill-opacity="0.1" />
              <circle cx="122" cy="20" r="2.6" fill="#475569" fill-opacity="0.13" />
              <circle cx="28" cy="74" r="1.8" fill="#64748b" fill-opacity="0.11" />
              <circle cx="72" cy="84" r="3" fill="#334155" fill-opacity="0.16" />
              <circle cx="77" cy="82" r="2" fill="#475569" fill-opacity="0.14" />
              <circle cx="114" cy="68" r="1.2" fill="#10b981" fill-opacity="0.09" />
              <circle cx="146" cy="96" r="1.6" fill="#94a3b8" fill-opacity="0.11" />
              <circle cx="18" cy="126" r="2.4" fill="#475569" fill-opacity="0.13" />
              <circle cx="58" cy="138" r="1.1" fill="#7dd3fc" fill-opacity="0.09" />
              <circle cx="102" cy="132" r="2.8" fill="#334155" fill-opacity="0.15" />
              <circle cx="138" cy="144" r="1.3" fill="#94a3b8" fill-opacity="0.12" />
              <path d="M 32 48 Q 40 42 46 50" fill="none" stroke="#64748b" stroke-opacity="0.1" stroke-width="1.2" stroke-linecap="round" />
              <path d="M 118 106 Q 128 112 136 104" fill="none" stroke="#38bdf8" stroke-opacity="0.08" stroke-width="1.1" stroke-linecap="round" />
            </pattern>
            <radialGradient id="cyto-depth-light" cx="50%" cy="54%" r="62%">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.09" />
              <stop offset="55%" stop-color="#1e293b" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#020617" stop-opacity="0.28" />
            </radialGradient>
            <radialGradient id="bokeh-cyan">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.17" />
              <stop offset="48%" stop-color="#38bdf8" stop-opacity="0.06" />
              <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="bokeh-emerald">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.14" />
              <stop offset="48%" stop-color="#10b981" stop-opacity="0.05" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="bokeh-indigo">
              <stop offset="0%" stop-color="#818cf8" stop-opacity="0.15" />
              <stop offset="48%" stop-color="#6366f1" stop-opacity="0.05" />
              <stop offset="100%" stop-color="#6366f1" stop-opacity="0" />
            </radialGradient>
            <radialGradient id="bokeh-slate">
              <stop offset="0%" stop-color="#94a3b8" stop-opacity="0.12" />
              <stop offset="55%" stop-color="#64748b" stop-opacity="0.04" />
              <stop offset="100%" stop-color="#475569" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="700" fill="url(#cyto-depth-light)" />
          <rect width="1200" height="700" fill="url(#cyto-granules)" />

          <!-- Malha citoesquelética sutil -->
          <g aria-hidden="true">
            <path class="ambient-filament" d="M -40 210 Q 320 175 680 235 T 1240 195" fill="none" stroke="#94a3b8" stroke-opacity="0.07" stroke-width="1.4" />
            <path class="ambient-filament" d="M -40 560 Q 390 595 760 545 T 1240 575" fill="none" stroke="#38bdf8" stroke-opacity="0.06" stroke-width="1.2" />
            <path class="ambient-filament" d="M -20 390 Q 280 350 590 405 T 1220 370" fill="none" stroke="#64748b" stroke-opacity="0.055" stroke-width="1.2" />
            <path class="ambient-filament" d="M 160 -20 Q 220 260 180 720" fill="none" stroke="#94a3b8" stroke-opacity="0.045" stroke-width="1.1" />
            <path class="ambient-filament" d="M 980 -10 Q 920 310 1030 720" fill="none" stroke="#7dd3fc" stroke-opacity="0.04" stroke-width="1.1" />
            <path class="ambient-filament" d="M 520 140 Q 470 410 560 720" fill="none" stroke="#64748b" stroke-opacity="0.038" stroke-width="1" />
          </g>

          <!-- Plano distante: macromoléculas e grânulos de inclusão desfocados (sem filtro, 60 fps) -->
          <g class="ambient-organelle">
            <circle cx="140" cy="280" r="42" fill="url(#bokeh-cyan)" />
            <circle cx="480" cy="590" r="48" fill="url(#bokeh-indigo)" />
            <circle cx="960" cy="240" r="44" fill="url(#bokeh-emerald)" />
            <circle cx="1090" cy="540" r="54" fill="url(#bokeh-cyan)" />
            <circle cx="290" cy="520" r="36" fill="url(#bokeh-emerald)" />
            <circle cx="760" cy="340" r="38" fill="url(#bokeh-indigo)" />
            <circle cx="610" cy="495" r="46" fill="url(#bokeh-slate)" />
            <circle cx="80" cy="445" r="34" fill="url(#bokeh-slate)" />
            <circle cx="1140" cy="310" r="36" fill="url(#bokeh-slate)" />
            <!-- Silhuetas sutis de ribossomos e complexos proteicos ao fundo -->
            <g fill="#64748b" fill-opacity="0.14">
              <ellipse cx="220" cy="295" rx="9" ry="6" transform="rotate(-18 220 295)" />
              <ellipse cx="228" cy="291" rx="6" ry="4.5" transform="rotate(-18 228 291)" />
              <ellipse cx="890" cy="275" rx="10" ry="6.5" transform="rotate(22 890 275)" />
              <ellipse cx="881" cy="271" rx="6.5" ry="4.5" transform="rotate(22 881 271)" />
              <ellipse cx="360" cy="615" rx="11" ry="7" transform="rotate(12 360 615)" />
              <ellipse cx="369" cy="611" rx="7" ry="5" transform="rotate(12 369 611)" />
              <ellipse cx="950" cy="595" rx="9.5" ry="6" transform="rotate(-25 950 595)" />
              <ellipse cx="942" cy="591" rx="6" ry="4" transform="rotate(-25 942 591)" />
            </g>
          </g>

          <!-- Plano intermediário: adensamento citoplasmático suave com deriva oposta -->
          <g class="ambient-organelle-reverse">
            <circle cx="210" cy="360" r="20" fill="url(#bokeh-cyan)" />
            <circle cx="620" cy="250" r="24" fill="url(#bokeh-cyan)" />
            <circle cx="880" cy="610" r="28" fill="url(#bokeh-indigo)" />
            <circle cx="1020" cy="380" r="21" fill="url(#bokeh-emerald)" />
            <circle cx="85" cy="615" r="26" fill="url(#bokeh-indigo)" />
            <circle cx="410" cy="295" r="18" fill="url(#bokeh-emerald)" />
            <circle cx="545" cy="365" r="22" fill="url(#bokeh-slate)" />
            <circle cx="790" cy="520" r="24" fill="url(#bokeh-slate)" />

            <!-- Partículas solúveis e complexos de fundo (baixo contraste para manter foco nas peças do jogo) -->
            <g fill="#7dd3fc" fill-opacity="0.16">
              <circle cx="330" cy="410" r="2.4" />
              <circle cx="520" cy="635" r="2.2" />
              <circle cx="140" cy="345" r="2" />
              <circle cx="1065" cy="425" r="2.3" />
            </g>
            <g fill="#94a3b8" fill-opacity="0.18">
              <circle cx="710" cy="470" r="2.1" />
              <circle cx="165" cy="465" r="2" />
              <circle cx="445" cy="535" r="2.6" />
              <circle cx="660" cy="315" r="2.2" />
              <circle cx="920" cy="410" r="1.9" />
              <circle cx="275" cy="255" r="2.3" />
            </g>
            <g fill="#6ee7b7" fill-opacity="0.14">
              <circle cx="845" cy="295" r="2.5" />
              <circle cx="390" cy="345" r="2.1" />
              <circle cx="1115" cy="605" r="2.4" />
            </g>
            <g fill="#a5b4fc" fill-opacity="0.15">
              <circle cx="990" cy="495" r="2.4" />
              <circle cx="615" cy="580" r="2.2" />
              <circle cx="110" cy="540" r="2" />
            </g>
          </g>

          <!-- Plano mais ágil: micropartículas dinâmicas no fluido celular -->
          <g class="ambient-organelle-fast">
            <circle cx="195" cy="245" r="1.9" fill="#7dd3fc" fill-opacity="0.22" />
            <circle cx="465" cy="390" r="1.7" fill="#6ee7b7" fill-opacity="0.19" />
            <circle cx="735" cy="275" r="2.1" fill="#94a3b8" fill-opacity="0.22" />
            <circle cx="910" cy="465" r="1.8" fill="#7dd3fc" fill-opacity="0.2" />
            <circle cx="315" cy="585" r="2" fill="#a5b4fc" fill-opacity="0.2" />
            <circle cx="1045" cy="295" r="1.7" fill="#94a3b8" fill-opacity="0.21" />
            <circle cx="640" cy="645" r="1.9" fill="#6ee7b7" fill-opacity="0.18" />
          </g>

        </svg>
      </div>

      <main class="stage-layer" id="stage-layer">
        <svg
          id="molecular-stage"
          class="molecular-stage"
          viewBox="0 0 1200 700"
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          role="img"
          aria-label="Ambiente celular interativo"
        ></svg>
      </main>

      <div class="hud-layer" id="hud-layer"></div>

      <section class="landing-screen" id="landing-screen" aria-labelledby="landing-title">
        <div class="landing-card">
          <div class="landing-logo">
            <svg class="landing-emblem" viewBox="0 0 72 72" aria-hidden="true">
              <defs>
                <linearGradient id="logo-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#38bdf8" />
                  <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
              </defs>
              <circle cx="36" cy="36" r="31" fill="rgba(15, 23, 42, 0.55)" stroke="url(#logo-ring-grad)" stroke-width="2.2" stroke-opacity="0.85" />
              <circle cx="36" cy="36" r="26" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="3 4" stroke-opacity="0.38" />
              <path d="M 19 25 C 28 25, 44 47, 53 47" fill="none" stroke="#38bdf8" stroke-width="3.6" stroke-linecap="round" />
              <path d="M 19 47 C 28 47, 44 25, 53 25" fill="none" stroke="#7dd3fc" stroke-width="3" stroke-linecap="round" stroke-opacity="0.78" />
              <circle cx="36" cy="36" r="5.5" fill="#10b981" />
              <circle cx="36" cy="36" r="9" fill="none" stroke="#10b981" stroke-width="1.4" stroke-opacity="0.45" />
            </svg>
            <h1 class="landing-card__title" id="landing-title">
              <span class="brand-inner">Inner</span><span class="brand-cell">Cell</span>
            </h1>
          </div>
          <div class="landing-slogan-wrap">
            <span class="landing-slogan-line" aria-hidden="true"></span>
            <p class="landing-card__slogan">The Cellular Mission</p>
            <span class="landing-slogan-line" aria-hidden="true"></span>
          </div>
          <p class="landing-card__subtitle">
            Assuma o controle molecular de dentro da célula.
          </p>
          <div class="landing-card__actions">
            <button type="button" class="btn-primary btn-start-game" id="start-mission-btn">
              <span class="btn-start-game__icon" aria-hidden="true">▶</span>
              <span>Iniciar Missão</span>
            </button>
            <span class="landing-card__saved" id="saved-progress-note" hidden></span>
            <button type="button" class="btn-ghost" id="reset-progress-btn" hidden>Reiniciar Progresso Salvo</button>
          </div>
        </div>
      </section>
    </div>
  `;

  const viewportEl = app.querySelector('.cell-viewport') as HTMLElement;
  const stageLayerEl = document.getElementById('stage-layer') as HTMLElement;
  const stageSvg = document.getElementById('molecular-stage') as unknown as SVGSVGElement;
  const hudLayer = document.getElementById('hud-layer') as HTMLElement;
  const landingScreen = document.getElementById('landing-screen') as HTMLElement;
  const startMissionBtn = document.getElementById('start-mission-btn') as HTMLButtonElement;
  const savedProgressNote = document.getElementById('saved-progress-note') as HTMLElement;
  const resetProgressBtn = document.getElementById('reset-progress-btn') as HTMLButtonElement;

  interaction.attachStage(stageSvg);

  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let applyStageTransform = (): void => {};

  const manual = new BenchManual(app, {
    bus,
    getCurrentLevelId: () => activeLevelId,
  });

  const hud = new StatusHUD(hudLayer, {
    bus,
    onOpenManual: () => manual.open(),
    onToggleAudio: () => sound.toggleMute(),
    initialMuted: sound.isMuted(),
    onZoomChange: (action) => {
      if (action === 'in') zoomScale = Math.min(2.4, zoomScale + 0.35);
      else if (action === 'out') zoomScale = Math.max(1, zoomScale - 0.35);
      else zoomScale = 1;
      applyStageTransform();
    },
    onZoomSet: (scale) => {
      zoomScale = Math.max(1, Math.min(2.4, scale));
      applyStageTransform();
    },
  });

  // Zoom e pan isolados no palco (com inércia suave ao soltar)
  const activeStagePointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartScale = 1;
  let panStart: { x: number; y: number; ox: number; oy: number } | null = null;
  let lastPanSample: { x: number; y: number; t: number } | null = null;
  let panVx = 0;
  let panVy = 0;
  let panInertiaRaf: number | null = null;

  const stopPanInertia = (): void => {
    if (panInertiaRaf !== null) {
      window.cancelAnimationFrame(panInertiaRaf);
      panInertiaRaf = null;
    }
  };

  applyStageTransform = (): void => {
    if (zoomScale <= 1.01) {
      stopPanInertia();
      zoomScale = 1;
      panX = 0;
      panY = 0;
    } else {
      const maxPanX = stageLayerEl.clientWidth * (zoomScale - 1) * 0.55 + 160;
      const maxPanY = stageLayerEl.clientHeight * (zoomScale - 1) * 0.55 + 100;
      panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
    }
    stageSvg.style.transform = `translate(${panX.toFixed(1)}px, ${panY.toFixed(1)}px) scale(${zoomScale.toFixed(3)})`;
    hud.setZoomScale(zoomScale);
  };

  stageLayerEl.addEventListener('pointerdown', (e) => {
    stopPanInertia();
    activeStagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activeStagePointers.size === 2) {
      const pts = [...activeStagePointers.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale = zoomScale;
      panStart = null;
      lastPanSample = null;
      return;
    }

    const targetEl = e.target as Element | null;
    const isInteractiveTarget = Boolean(
      targetEl?.closest('.draggable, .membrane-channel, .auto-enzyme, .gene-cassette'),
    );
    if (activeStagePointers.size === 1 && zoomScale > 1.01 && !isInteractiveTarget) {
      panStart = { x: e.clientX, y: e.clientY, ox: panX, oy: panY };
      lastPanSample = { x: e.clientX, y: e.clientY, t: performance.now() };
      panVx = 0;
      panVy = 0;
    }
  });

  stageLayerEl.addEventListener('pointermove', (e) => {
    if (!activeStagePointers.has(e.pointerId)) return;
    activeStagePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activeStagePointers.size === 2 && pinchStartDist > 0) {
      const pts = [...activeStagePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomScale = Math.max(1, Math.min(2.4, pinchStartScale * (dist / pinchStartDist)));
      applyStageTransform();
    } else if (activeStagePointers.size === 1 && panStart) {
      const now = performance.now();
      if (lastPanSample) {
        const dt = Math.max(8, now - lastPanSample.t);
        const instVx = ((e.clientX - lastPanSample.x) / dt) * 16;
        const instVy = ((e.clientY - lastPanSample.y) / dt) * 16;
        panVx = panVx * 0.45 + instVx * 0.55;
        panVy = panVy * 0.45 + instVy * 0.55;
        lastPanSample = { x: e.clientX, y: e.clientY, t: now };
      }
      panX = panStart.ox + (e.clientX - panStart.x);
      panY = panStart.oy + (e.clientY - panStart.y);
      applyStageTransform();
    }
  });

  const endStagePointer = (e: PointerEvent): void => {
    const wasPanning = Boolean(panStart) && activeStagePointers.size === 1;
    activeStagePointers.delete(e.pointerId);
    if (activeStagePointers.size < 2) {
      pinchStartDist = 0;
    }
    if (activeStagePointers.size === 0) {
      const stale = lastPanSample ? performance.now() - lastPanSample.t > 90 : true;
      panStart = null;
      lastPanSample = null;
      if (wasPanning && !stale && zoomScale > 1.01 && Math.hypot(panVx, panVy) > 0.6) {
        const stepInertia = (): void => {
          panX += panVx;
          panY += panVy;
          panVx *= 0.91;
          panVy *= 0.91;
          applyStageTransform();
          if (Math.hypot(panVx, panVy) > 0.25 && zoomScale > 1.01) {
            panInertiaRaf = window.requestAnimationFrame(stepInertia);
          } else {
            panInertiaRaf = null;
          }
        };
        panInertiaRaf = window.requestAnimationFrame(stepInertia);
      }
    }
  };
  stageLayerEl.addEventListener('pointerup', endStagePointer);
  stageLayerEl.addEventListener('pointercancel', endStagePointer);

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
    sound.setLevel(level.metadata.id);
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
    void sound.unlock();
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
