import type { EventBus } from '../core/EventBus';
import type { InteractionManager } from '../core/InteractionManager';
import type { MoleculeId, MoleculeSpec, ZoneId } from '../core/types';

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
 * Barra inferior fixa com efeito glassmorphism que armazena as moléculas descobertas via Scan.
 */
export class MolecularPool {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly interaction: InteractionManager;
  private readonly bus: EventBus;
  private readonly unsubscribers: Array<() => void> = [];
  private chipCleanups: Array<() => void> = [];
  private molecules: MoleculeSpec[] = [];
  private craftingZoneResolver: PoolCraftingZoneResolver | null = null;

  constructor(container: HTMLElement, options: MolecularPoolOptions) {
    this.bus = options.bus;
    this.interaction = options.interaction;

    this.root = document.createElement('section');
    this.root.className = 'molecular-pool';
    this.root.setAttribute('aria-label', 'Pool Molecular');
    this.root.innerHTML = `
      <span class="molecular-pool__label">Pool Molecular</span>
      <div class="molecular-pool__items"></div>
    `;

    this.listEl = this.root.querySelector('.molecular-pool__items') as HTMLElement;

    this.unsubscribers.push(
      this.bus.on('pool:updated', ({ molecules }) => {
        this.setMolecules(molecules);
      }),
      this.bus.on('interaction:selection-changed', ({ moleculeId }) => {
        this.syncSelectedVisual(moleculeId);
      }),
    );

    container.appendChild(this.root);
    this.render();
  }

  setMolecules(molecules: MoleculeSpec[]): void {
    this.molecules = molecules.filter((m) => m.discovered && m.available !== false);
    this.render();
  }

  setCraftingZoneResolver(resolver: PoolCraftingZoneResolver | null): void {
    this.craftingZoneResolver = resolver;
    this.render();
  }

  private render(): void {
    for (const cleanup of this.chipCleanups) {
      cleanup();
    }
    this.chipCleanups = [];
    this.listEl.innerHTML = '';

    if (this.molecules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'molecular-pool__empty';
      empty.textContent = 'Toque ou clique nas moléculas no palco para explorá-las.';
      this.listEl.appendChild(empty);
      return;
    }

    const selectedId = this.interaction.getSelectedMoleculeId();

    for (const molecule of this.molecules) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pool-chip';
      chip.dataset.role = molecule.role;
      chip.dataset.moleculeId = molecule.id;
      chip.title = molecule.fullName;

      if (selectedId === molecule.id) {
        chip.dataset.selected = 'true';
        chip.setAttribute('aria-pressed', 'true');
      } else {
        chip.setAttribute('aria-pressed', 'false');
      }

      chip.innerHTML = `
        <span class="pool-chip__dot" aria-hidden="true"></span>
        <span>${this.escapeHtml(molecule.label)}</span>
      `;

      let downX = 0;
      let downY = 0;
      chip.addEventListener('pointerdown', (e) => {
        downX = e.clientX;
        downY = e.clientY;
      });
      chip.addEventListener('click', (e) => {
        if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
          this.bus.emit('pool:inspect', { moleculeId: molecule.id });
        }
      });

      const unregister = this.interaction.registerDraggable({
        moleculeId: molecule.id,
        element: chip,
        source: 'pool',
        discovered: true,
        label: molecule.label,
        role: molecule.role,
      });

      this.chipCleanups.push(unregister);

      const craftingZone = this.craftingZoneResolver?.(molecule.id);
      if (craftingZone) {
        const unregisterZone = this.interaction.registerDropZone({
          id: craftingZone.zoneId,
          element: chip,
          x: 0,
          y: 0,
          hitRadius: 0,
          hitPadding: 12,
          accepts: craftingZone.accepts,
        });
        this.chipCleanups.push(unregisterZone);
      }

      this.listEl.appendChild(chip);
    }
  }

  private syncSelectedVisual(selectedId: MoleculeId | null): void {
    const chips = this.listEl.querySelectorAll<HTMLElement>('.pool-chip');
    for (const chip of chips) {
      const isSelected = selectedId !== null && chip.dataset.moleculeId === selectedId;
      chip.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      if (isSelected) {
        chip.dataset.selected = 'true';
      } else {
        delete chip.dataset.selected;
      }
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
    this.craftingZoneResolver = null;
    for (const cleanup of this.chipCleanups) {
      cleanup();
    }
    this.chipCleanups = [];
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;
    this.root.remove();
  }
}
