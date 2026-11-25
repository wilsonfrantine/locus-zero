import type { EventBus } from '../core/EventBus';
import type { MoleculeId, MoleculeSpec } from '../core/types';

export interface BenchManualOptions {
  bus: EventBus;
  getCurrentLevelId: () => string;
}

/**
 * Gaveta lateral "Just-in-Time" exibindo fichas técnicas das moléculas escaneadas.
 * Destaca automaticamente a ficha relevante após 2 erros consecutivos.
 */
export class BenchManual {
  private readonly bus: EventBus;
  private readonly getCurrentLevelId: () => string;
  private readonly backdropEl: HTMLElement;
  private readonly drawerEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly unsubscribers: Array<() => void> = [];

  private entries: MoleculeSpec[] = [];
  private highlightedId: MoleculeId | null = null;
  private isOpen = false;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.isOpen) {
      this.close();
    }
  };

  constructor(container: HTMLElement, options: BenchManualOptions) {
    this.bus = options.bus;
    this.getCurrentLevelId = options.getCurrentLevelId;

    this.backdropEl = document.createElement('div');
    this.backdropEl.className = 'bench-manual-backdrop';
    this.backdropEl.dataset.open = 'false';

    this.drawerEl = document.createElement('aside');
    this.drawerEl.className = 'bench-manual';
    this.drawerEl.dataset.open = 'false';
    this.drawerEl.setAttribute('role', 'dialog');
    this.drawerEl.setAttribute('aria-modal', 'true');
    this.drawerEl.setAttribute('aria-label', 'Manual de Bancada');
    this.drawerEl.innerHTML = `
      <div class="bench-manual__header">
        <div>
          <h2 class="bench-manual__title">Manual de Bancada</h2>
          <p class="bench-manual__subtitle">Fichas desbloqueadas por escaneamento molecular</p>
        </div>
        <button type="button" class="bench-manual__close" aria-label="Fechar manual">&times;</button>
      </div>
      <div class="bench-manual__body"></div>
    `;

    this.bodyEl = this.drawerEl.querySelector('.bench-manual__body') as HTMLElement;
    const closeBtn = this.drawerEl.querySelector('.bench-manual__close') as HTMLButtonElement;

    closeBtn.addEventListener('click', () => this.close());
    this.backdropEl.addEventListener('click', () => this.close());
    window.addEventListener('keydown', this.handleKeyDown);

    this.unsubscribers.push(
      this.bus.on('pool:updated', ({ molecules }) => {
        this.setEntries(molecules);
      }),
      this.bus.on('manual:hint', ({ moleculeId }) => {
        this.highlightEntry(moleculeId ?? null);
      }),
      this.bus.on('feedback:action', (feedback) => {
        if (!feedback.valid && feedback.hintMoleculeId) {
          this.highlightEntry(feedback.hintMoleculeId);
        }
      }),
    );

    container.append(this.backdropEl, this.drawerEl);
    this.render();
  }

  setEntries(molecules: MoleculeSpec[]): void {
    this.entries = molecules.filter((m) => m.discovered);
    this.render();
  }

  highlightEntry(moleculeId: MoleculeId | null): void {
    this.highlightedId = moleculeId;
    this.render();
  }

  open(focusMoleculeId?: MoleculeId): void {
    if (focusMoleculeId) {
      this.highlightedId = focusMoleculeId;
    }
    this.isOpen = true;
    this.backdropEl.dataset.open = 'true';
    this.drawerEl.dataset.open = 'true';
    this.render();

    this.bus.emit('manual:opened', {
      levelId: this.getCurrentLevelId(),
      moleculeId: this.highlightedId ?? undefined,
    });
  }

  close(): void {
    this.isOpen = false;
    this.backdropEl.dataset.open = 'false';
    this.drawerEl.dataset.open = 'false';
  }

  private render(): void {
    this.bodyEl.innerHTML = '';

    if (this.entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'manual-empty';
      empty.textContent =
        'Nenhuma ficha escaneada ainda. Clique em moléculas livres no ambiente celular para registrar sua função biológica aqui.';
      this.bodyEl.appendChild(empty);
      return;
    }

    for (const entry of this.entries) {
      const card = document.createElement('article');
      card.className = 'manual-card';
      if (this.highlightedId === entry.id) {
        card.dataset.highlighted = 'true';
      }

      card.innerHTML = `
        <div class="manual-card__head">
          <span class="manual-card__code">${this.escapeHtml(entry.label)}</span>
          <span class="manual-card__role">${this.escapeHtml(entry.role)}</span>
        </div>
        <h3 class="manual-card__name">${this.escapeHtml(entry.fullName)}</h3>
        <p class="manual-card__text">${this.escapeHtml(entry.manualEntry)}</p>
      `;
      this.bodyEl.appendChild(card);
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.backdropEl.remove();
    this.drawerEl.remove();
  }
}
