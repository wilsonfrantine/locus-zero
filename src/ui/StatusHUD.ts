import type { EventBus } from '../core/EventBus';
import type { HudStatusState } from '../core/types';

export interface StatusHUDOptions {
  bus: EventBus;
  onOpenManual: () => void;
  onToggleAudio?: () => boolean;
  initialMuted?: boolean;
  onZoomChange?: (action: 'in' | 'out' | 'reset') => void;
}

/**
 * Barra superior minimalista: status vital da célula e acesso ao Manual de Bancada.
 */
export class StatusHUD {
  private readonly root: HTMLElement;
  private readonly dotEl: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly statusEl: HTMLElement;
  private readonly healthFillEl: HTMLElement;
  private readonly healthValueEl: HTMLElement;
  private readonly zoomResetBtnEl: HTMLButtonElement;
  private readonly audioBtnEl: HTMLButtonElement;
  private readonly manualBtnEl: HTMLButtonElement;
  private readonly manualBadgeEl: HTMLElement;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(container: HTMLElement, options: StatusHUDOptions) {
    this.root = document.createElement('header');
    this.root.className = 'status-hud';

    this.root.innerHTML = `
      <div class="status-hud__brand">
        <span class="status-hud__dot" data-severity="ok" aria-hidden="true"></span>
        <div class="status-hud__titles">
          <span class="status-hud__level">Locus Zero</span>
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
        <div class="hud-zoom-group" aria-label="Controle de zoom do palco">
          <button type="button" class="hud-zoom-btn" data-zoom="out" aria-label="Diminuir zoom">&minus;</button>
          <button type="button" class="hud-zoom-btn hud-zoom-btn--reset" data-zoom="reset" aria-label="Resetar zoom">1&times;</button>
          <button type="button" class="hud-zoom-btn" data-zoom="in" aria-label="Aumentar zoom">+</button>
        </div>
        <button type="button" class="hud-audio-btn" aria-label="Alternar som" title="Som / Mudo">
          <svg class="hud-audio-btn__icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path class="audio-wave" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path class="audio-wave" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        </button>
        <button type="button" class="hud-manual-btn" aria-haspopup="dialog">
          <span>Manual de Bancada</span>
          <span class="hud-manual-btn__badge">0</span>
        </button>
      </div>
    `;

    this.dotEl = this.root.querySelector('.status-hud__dot') as HTMLElement;
    this.levelEl = this.root.querySelector('.status-hud__level') as HTMLElement;
    this.statusEl = this.root.querySelector('.status-hud__status') as HTMLElement;
    this.healthFillEl = this.root.querySelector('.health-gauge__fill') as HTMLElement;
    this.healthValueEl = this.root.querySelector('.health-gauge__value') as HTMLElement;
    this.zoomResetBtnEl = this.root.querySelector('.hud-zoom-btn--reset') as HTMLButtonElement;
    this.audioBtnEl = this.root.querySelector('.hud-audio-btn') as HTMLButtonElement;
    this.manualBtnEl = this.root.querySelector('.hud-manual-btn') as HTMLButtonElement;
    this.manualBadgeEl = this.root.querySelector('.hud-manual-btn__badge') as HTMLElement;

    for (const btn of this.root.querySelectorAll<HTMLButtonElement>('.hud-zoom-btn')) {
      btn.addEventListener('click', () => {
        const action = btn.dataset.zoom as 'in' | 'out' | 'reset' | undefined;
        if (action && options.onZoomChange) {
          options.onZoomChange(action);
        }
      });
    }

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
      options.bus.on('pool:updated', ({ molecules }) => {
        const discoveredCount = molecules.filter((m) => m.discovered).length;
        this.setManualCount(discoveredCount);
      }),
    );

    container.appendChild(this.root);
  }

  update(state: HudStatusState): void {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(state.cellHealth)));
    this.levelEl.textContent = state.levelLabel;
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

  setAudioMuted(muted: boolean): void {
    this.audioBtnEl.dataset.muted = muted ? 'true' : 'false';
    this.audioBtnEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.audioBtnEl.title = muted ? 'Ativar som' : 'Silenciar som';
  }

  setZoomScale(scale: number): void {
    this.zoomResetBtnEl.textContent = `${scale.toFixed(1).replace('.0', '')}×`;
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.root.remove();
  }
}
