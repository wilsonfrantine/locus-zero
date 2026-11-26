import type { EventBus } from '../core/EventBus';
import type { HudStatusState } from '../core/types';

export interface StatusHUDOptions {
  bus: EventBus;
  onOpenManual: () => void;
  onToggleAudio?: () => boolean;
  initialMuted?: boolean;
  onZoomChange?: (action: 'in' | 'out' | 'reset') => void;
  onZoomSet?: (scale: number) => void;
}

/**
 * Barra superior minimalista: status vital da célula e acesso ao Manual de Bancada.
 */
export class StatusHUD {
  private readonly root: HTMLElement;
  private readonly dotEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly healthFillEl: HTMLElement;
  private readonly healthValueEl: HTMLElement;
  private readonly zoomControlEl: HTMLElement;
  private readonly zoomTriggerBtnEl: HTMLButtonElement;
  private readonly zoomValueEl: HTMLElement;
  private readonly zoomPopoverEl: HTMLElement;
  private readonly zoomSliderEl: HTMLInputElement;
  private readonly zoomResetBtnEl: HTMLButtonElement;
  private readonly audioBtnEl: HTMLButtonElement;
  private readonly manualBtnEl: HTMLButtonElement;
  private readonly manualBadgeEl: HTMLElement;
  private readonly unsubscribers: Array<() => void> = [];
  private currentZoom = 1;
  private readonly outsideClickHandler: (e: PointerEvent) => void;

  constructor(container: HTMLElement, options: StatusHUDOptions) {
    this.root = document.createElement('header');
    this.root.className = 'status-hud';

    this.root.innerHTML = `
      <div class="status-hud__brand">
        <span class="status-hud__dot" data-severity="ok" aria-hidden="true"></span>
        <div class="status-hud__titles">
          <span class="status-hud__status">Pronto para iniciar</span>
        </div>
      </div>
      <div class="status-hud__metrics">
        <div class="health-gauge" aria-label="Saúde celular">
          <span class="health-gauge__label">HOMEÓSTASE</span>
          <div class="health-gauge__track">
            <div class="health-gauge__fill" style="width: 100%"></div>
          </div>
          <span class="health-gauge__value">100%</span>
        </div>
        <div class="hud-zoom-control" data-open="false">
          <button type="button" class="hud-zoom-trigger" aria-label="Controle de zoom (clique para slider ou arraste para ajustar)" title="Zoom: clique ou arraste">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <span class="hud-zoom-trigger__val">1&times;</span>
          </button>
          <div class="hud-zoom-popover" role="group" aria-label="Ajuste de zoom">
            <input type="range" class="hud-zoom-slider" min="1" max="2.4" step="0.05" value="1" aria-label="Nível de zoom" />
            <button type="button" class="hud-zoom-reset" aria-label="Resetar zoom">1&times;</button>
          </div>
        </div>
        <button type="button" class="hud-audio-btn" aria-label="Alternar som" title="Som / Mudo">
          <svg class="hud-audio-btn__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path class="audio-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path class="audio-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
        <button type="button" class="hud-manual-btn" data-open="false" aria-haspopup="dialog" aria-label="Abrir Notebook">
          <svg class="hud-notebook-icon hud-notebook-icon--closed" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          <svg class="hud-notebook-icon hud-notebook-icon--open" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
          <span class="hud-manual-btn__label">Notebook</span>
          <span class="hud-manual-btn__badge">0</span>
        </button>
      </div>
    `;

    this.dotEl = this.root.querySelector('.status-hud__dot') as HTMLElement;
    this.statusEl = this.root.querySelector('.status-hud__status') as HTMLElement;
    this.healthFillEl = this.root.querySelector('.health-gauge__fill') as HTMLElement;
    this.healthValueEl = this.root.querySelector('.health-gauge__value') as HTMLElement;
    this.zoomControlEl = this.root.querySelector('.hud-zoom-control') as HTMLElement;
    this.zoomTriggerBtnEl = this.root.querySelector('.hud-zoom-trigger') as HTMLButtonElement;
    this.zoomValueEl = this.root.querySelector('.hud-zoom-trigger__val') as HTMLElement;
    this.zoomPopoverEl = this.root.querySelector('.hud-zoom-popover') as HTMLElement;
    this.zoomSliderEl = this.root.querySelector('.hud-zoom-slider') as HTMLInputElement;
    this.zoomResetBtnEl = this.root.querySelector('.hud-zoom-reset') as HTMLButtonElement;
    this.audioBtnEl = this.root.querySelector('.hud-audio-btn') as HTMLButtonElement;
    this.manualBtnEl = this.root.querySelector('.hud-manual-btn') as HTMLButtonElement;
    this.manualBadgeEl = this.root.querySelector('.hud-manual-btn__badge') as HTMLElement;

    const applyZoom = (nextScale: number): void => {
      const clamped = Math.max(1, Math.min(2.4, nextScale));
      if (options.onZoomSet) {
        options.onZoomSet(clamped);
      } else if (options.onZoomChange) {
        options.onZoomChange(clamped <= 1.01 ? 'reset' : clamped > this.currentZoom ? 'in' : 'out');
      }
    };

    // Segurar e arrastar no botão de zoom ajusta diretamente; clique simples abre/fecha o slider
    let dragStartX = 0;
    let dragStartZoom = 1;
    let didDragZoom = false;
    let pointerActive = false;

    this.zoomTriggerBtnEl.addEventListener('pointerdown', (e) => {
      pointerActive = true;
      didDragZoom = false;
      dragStartX = e.clientX;
      dragStartZoom = this.currentZoom;
      this.zoomTriggerBtnEl.setPointerCapture(e.pointerId);
    });

    this.zoomTriggerBtnEl.addEventListener('pointermove', (e) => {
      if (!pointerActive) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 6) {
        didDragZoom = true;
        applyZoom(dragStartZoom + dx * 0.012);
      }
    });

    const endZoomDrag = (): void => {
      pointerActive = false;
    };
    this.zoomTriggerBtnEl.addEventListener('pointerup', endZoomDrag);
    this.zoomTriggerBtnEl.addEventListener('pointercancel', endZoomDrag);

    this.zoomTriggerBtnEl.addEventListener('click', () => {
      if (didDragZoom) {
        didDragZoom = false;
        return;
      }
      const isOpen = this.zoomControlEl.dataset.open === 'true';
      this.zoomControlEl.dataset.open = isOpen ? 'false' : 'true';
    });

    this.zoomTriggerBtnEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        applyZoom(this.currentZoom + (e.deltaY < 0 ? 0.15 : -0.15));
      },
      { passive: false },
    );

    this.zoomSliderEl.addEventListener('input', () => {
      applyZoom(Number.parseFloat(this.zoomSliderEl.value));
    });

    this.zoomResetBtnEl.addEventListener('click', () => {
      applyZoom(1);
    });

    this.outsideClickHandler = (e: PointerEvent) => {
      if (!this.zoomControlEl.contains(e.target as Node)) {
        this.zoomControlEl.dataset.open = 'false';
      }
    };
    document.addEventListener('pointerdown', this.outsideClickHandler);

    this.setAudioMuted(Boolean(options.initialMuted));
    this.audioBtnEl.addEventListener('click', () => {
      if (options.onToggleAudio) {
        const muted = options.onToggleAudio();
        this.setAudioMuted(muted);
      }
    });

    this.manualBtnEl.addEventListener('click', () => {
      this.setManualHint(false);
      options.onOpenManual();
    });

    this.unsubscribers.push(
      options.bus.on('hud:update', (state) => this.update(state)),
      options.bus.on('manual:hint', () => this.setManualHint(true)),
      options.bus.on('manual:opened', () => this.setManualOpen(true)),
      options.bus.on('manual:closed', () => this.setManualOpen(false)),
      options.bus.on('notebook:count', ({ count }) => {
        this.setManualCount(count);
      }),
    );

    container.appendChild(this.root);
  }

  update(state: HudStatusState): void {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(state.cellHealth)));
    this.statusEl.textContent = state.statusText;
    this.dotEl.dataset.severity = state.severity;
    this.healthFillEl.style.width = `${clampedHealth}%`;
    this.healthFillEl.dataset.low = clampedHealth < 45 ? 'true' : 'false';
    this.healthValueEl.textContent = `${clampedHealth}%`;
  }

  setManualCount(count: number): void {
    this.manualBadgeEl.textContent = String(Math.max(0, count));
  }

  setManualHint(active: boolean): void {
    this.manualBtnEl.classList.toggle('is-hint-pulsing', active);
  }

  setManualOpen(open: boolean): void {
    this.manualBtnEl.dataset.open = open ? 'true' : 'false';
  }

  setAudioMuted(muted: boolean): void {
    this.audioBtnEl.dataset.muted = muted ? 'true' : 'false';
    this.audioBtnEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.audioBtnEl.title = muted ? 'Ativar som' : 'Silenciar som';
  }

  setZoomScale(scale: number): void {
    this.currentZoom = scale;
    this.zoomValueEl.textContent = `${scale.toFixed(1).replace('.0', '')}×`;
    this.zoomSliderEl.value = scale.toFixed(2);
    this.zoomPopoverEl.dataset.zoomed = scale > 1.02 ? 'true' : 'false';
  }

  destroy(): void {
    document.removeEventListener('pointerdown', this.outsideClickHandler);
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.root.remove();
  }
}
