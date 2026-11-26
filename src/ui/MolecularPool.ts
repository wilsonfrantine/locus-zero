import type { EventBus } from '../core/EventBus';
import type { InteractionManager } from '../core/InteractionManager';
import type { InvestigativeClue, MoleculeId, ZoneId } from '../core/types';

export interface PoolCraftingZone {
  zoneId: ZoneId;
  accepts: (draggedId: MoleculeId) => boolean;
}

export type PoolCraftingZoneResolver = (moleculeId: MoleculeId) => PoolCraftingZone | null;

export interface MolecularPoolOptions {
  bus: EventBus;
  interaction: InteractionManager;
}

/**
 * Barra inferior "Pistas": exibe pistas investigativas reais (perguntas-guia e progresso),
 * separando o papel investigativo do acervo completo no Notebook.
 */
export class MolecularPool {
  private readonly root: HTMLElement;
  private readonly toggleBtnEl: HTMLButtonElement;
  private readonly chevronEl: HTMLElement;
  private readonly countPillEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly bus: EventBus;
  private readonly unsubscribers: Array<() => void> = [];
  private clues: InvestigativeClue[] = [];

  constructor(container: HTMLElement, options: MolecularPoolOptions) {
    this.bus = options.bus;

    this.root = document.createElement('section');
    this.root.className = 'molecular-pool';
    this.root.dataset.collapsed = 'true';
    this.root.dataset.interacted = 'false';
    this.root.setAttribute('aria-label', 'Pistas');
    this.root.innerHTML = `
      <button type="button" class="molecular-pool__header molecular-pool__toggle" aria-expanded="false" aria-label="Expandir ou recolher pistas">
        <span class="molecular-pool__label">
          <svg class="molecular-pool__icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Pistas</span>
        </span>
        <span class="pistas-stage-pill" hidden></span>
        <span class="molecular-pool__chevron" aria-hidden="true">▴</span>
      </button>
      <div class="molecular-pool__items"></div>
    `;

    this.toggleBtnEl = this.root.querySelector('.molecular-pool__toggle') as HTMLButtonElement;
    this.chevronEl = this.root.querySelector('.molecular-pool__chevron') as HTMLElement;
    this.countPillEl = this.root.querySelector('.pistas-stage-pill') as HTMLElement;
    this.listEl = this.root.querySelector('.molecular-pool__items') as HTMLElement;

    this.toggleBtnEl.addEventListener('click', () => {
      const nextCollapsed = this.root.dataset.collapsed !== 'true';
      this.root.dataset.collapsed = nextCollapsed ? 'true' : 'false';
      this.root.dataset.interacted = 'true';
      this.toggleBtnEl.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
      this.chevronEl.textContent = nextCollapsed ? '▴' : '▾';
    });

    // Rolagem horizontal fluida sem scrollbar: roda do mouse + arraste com ponteiro no desktop
    this.listEl.addEventListener(
      'wheel',
      (e) => {
        if (this.listEl.scrollWidth <= this.listEl.clientWidth) return;
        if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
          e.preventDefault();
          this.listEl.scrollLeft += e.deltaY;
        }
      },
      { passive: false },
    );

    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragging = false;
    let didDrag = false;

    this.listEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      didDrag = false;
      dragStartX = e.clientX;
      dragStartScroll = this.listEl.scrollLeft;
    });

    this.listEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      if (Math.abs(dx) > 5) {
        didDrag = true;
        this.listEl.scrollLeft = dragStartScroll - dx;
      }
    });

    const endDrag = (): void => {
      dragging = false;
    };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    this.listEl.addEventListener(
      'click',
      (e) => {
        if (didDrag) {
          e.preventDefault();
          e.stopPropagation();
          didDrag = false;
        }
      },
      true,
    );

    this.unsubscribers.push(
      this.bus.on('clues:updated', ({ clues }) => {
        this.setClues(clues);
      }),
    );

    container.appendChild(this.root);
    this.render();
  }

  setClues(clues: InvestigativeClue[]): void {
    this.clues = clues;
    this.render();
  }

  setCraftingZoneResolver(_resolver: PoolCraftingZoneResolver | null): void {
    // Mantido por compatibilidade; o crafting ocorre diretamente na Célula
  }

  private render(): void {
    this.listEl.innerHTML = '';

    if (this.clues.length === 0) {
      this.countPillEl.hidden = true;
      const empty = document.createElement('p');
      empty.className = 'molecular-pool__empty';
      empty.textContent = 'Explore a célula para investigar as pistas desta crise.';
      this.listEl.appendChild(empty);
      return;
    }

    const solvedCount = this.clues.filter((c) => c.solved).length;
    this.countPillEl.hidden = false;
    this.countPillEl.textContent = `${solvedCount}/${this.clues.length} resolvidas`;

    for (const clue of this.clues) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clue-chip';
      btn.dataset.solved = clue.solved ? 'true' : 'false';
      btn.title = clue.detailText;
      btn.innerHTML = `
        <span class="clue-chip__status" aria-hidden="true">${clue.solved ? '✓' : '?'}</span>
        <span class="clue-chip__tag">${this.escapeHtml(clue.tag)}:</span>
        <span class="clue-chip__text">${this.escapeHtml(clue.shortText)}</span>
      `;
      btn.addEventListener('click', () => {
        this.bus.emit('clues:inspect', { clue });
      });
      this.listEl.appendChild(btn);
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
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.root.remove();
  }
}
