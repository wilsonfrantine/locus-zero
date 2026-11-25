import type { EventBus } from '../core/EventBus';
import type { HudStatusState } from '../core/types';

export interface StatusHUDOptions {
  bus: EventBus;
  onOpenManual: () => void;
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
    this.manualBtnEl = this.root.querySelector('.hud-manual-btn') as HTMLButtonElement;
    this.manualBadgeEl = this.root.querySelector('.hud-manual-btn__badge') as HTMLElement;

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

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.root.remove();
  }
}
