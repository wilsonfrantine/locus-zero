import { EventBus } from './EventBus';
import type { DraggableConfig, DropZoneConfig, MoleculeId, SvgPoint, ZoneId } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const STAGE_WIDTH = 1200;
const STAGE_HEIGHT = 700;
const DRAG_THRESHOLD_PX = 6;

interface ActiveDragSession {
  pointerId: number;
  config: DraggableConfig;
  startClientX: number;
  startClientY: number;
  dragging: boolean;
  grabOffset: SvgPoint;
  ghostEl: SVGGElement | null;
  hoveredZoneId: ZoneId | null;
}

/**
 * Gerencia Pointer Events (mouse + toque), conversão exata client -> viewBox (getScreenCTM),
 * pausa de animação browniana durante arraste e modo alternativo clique-para-selecionar + clique-no-alvo.
 */
export class InteractionManager {
  private readonly bus: EventBus;
  private svgRoot: SVGSVGElement | null = null;
  private ghostLayer: SVGGElement | null = null;

  private readonly draggables = new Map<HTMLElement | SVGElement, {
    config: DraggableConfig;
    cleanup: () => void;
  }>();

  private readonly dropZones = new Map<ZoneId, {
    config: DropZoneConfig;
    cleanup: () => void;
  }>();

  private selectedMoleculeId: MoleculeId | null = null;
  private activeDrag: ActiveDragSession | null = null;

  private readonly handleStageClick = (event: MouseEvent): void => {
    if (!this.selectedMoleculeId) return;
    if (event.target === this.svgRoot) {
      this.clearSelection();
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return;
    if (this.activeDrag) {
      this.endDragSession(false);
    }
    if (this.selectedMoleculeId) {
      this.clearSelection();
    }
  };

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  attachStage(svgRoot: SVGSVGElement): void {
    this.detachStage();
    this.svgRoot = svgRoot;
    this.ensureGhostLayer();
    this.svgRoot.addEventListener('click', this.handleStageClick);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  detachStage(): void {
    this.endDragSession(false);
    this.clearRegistry();

    if (this.svgRoot) {
      this.svgRoot.removeEventListener('click', this.handleStageClick);
      delete this.svgRoot.dataset.dragging;
    }
    window.removeEventListener('keydown', this.handleKeyDown);
    this.ghostLayer?.remove();
    this.ghostLayer = null;
    this.svgRoot = null;
  }

  clearRegistry(): void {
    this.endDragSession(false);
    this.clearSelection();

    for (const item of this.draggables.values()) {
      item.cleanup();
    }
    this.draggables.clear();

    for (const zone of this.dropZones.values()) {
      zone.cleanup();
    }
    this.dropZones.clear();
  }

  getSelectedMoleculeId(): MoleculeId | null {
    return this.selectedMoleculeId;
  }

  selectMolecule(moleculeId: MoleculeId | null): void {
    const next = this.selectedMoleculeId === moleculeId ? null : moleculeId;
    this.selectedMoleculeId = next;
    this.syncSelectionAttributes();
    this.bus.emit('interaction:selection-changed', { moleculeId: this.selectedMoleculeId });
  }

  clearSelection(): void {
    if (this.selectedMoleculeId === null) return;
    this.selectedMoleculeId = null;
    this.syncSelectionAttributes();
    this.bus.emit('interaction:selection-changed', { moleculeId: null });
  }

  /**
   * Converte coordenadas de tela (clientX, clientY) para o espaço lógico
   * do palco <svg viewBox="0 0 1200 700"> usando getScreenCTM().
   */
  clientToSvgPoint(clientX: number, clientY: number, clamp = true): SvgPoint {
    if (!this.svgRoot) {
      return { x: clientX, y: clientY };
    }

    const ctm = this.svgRoot.getScreenCTM();
    if (!ctm) {
      return { x: 0, y: 0 };
    }

    const inverse = ctm.inverse();
    let transformedX = clientX;
    let transformedY = clientY;

    if (typeof DOMPoint !== 'undefined') {
      const pt = new DOMPoint(clientX, clientY).matrixTransform(inverse);
      transformedX = pt.x;
      transformedY = pt.y;
    } else {
      const pt = this.svgRoot.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const mapped = pt.matrixTransform(inverse);
      transformedX = mapped.x;
      transformedY = mapped.y;
    }

    if (!clamp) {
      return { x: transformedX, y: transformedY };
    }

    return {
      x: Math.max(0, Math.min(STAGE_WIDTH, transformedX)),
      y: Math.max(0, Math.min(STAGE_HEIGHT, transformedY)),
    };
  }

  registerDraggable(config: DraggableConfig): () => void {
    const existing = this.draggables.get(config.element);
    if (existing) {
      existing.cleanup();
      this.draggables.delete(config.element);
    }

    const el = config.element;
    el.classList.add('draggable');
    el.dataset.moleculeId = config.moleculeId;
    el.setAttribute('aria-pressed', this.selectedMoleculeId === config.moleculeId ? 'true' : 'false');
    if (this.selectedMoleculeId === config.moleculeId) {
      el.dataset.selected = 'true';
    } else {
      delete el.dataset.selected;
    }

    const onPointerDown = (event: Event): void => {
      const pe = event as PointerEvent;
      if (pe.button !== 0 && pe.pointerType === 'mouse') return;

      const latest = this.draggables.get(el)?.config ?? config;
      pe.stopPropagation();
      if (pe.pointerType !== 'mouse' && pe.cancelable) {
        pe.preventDefault();
      }

      if (!latest.discovered) {
        this.bus.emit('interaction:scan', { moleculeId: latest.moleculeId });
        return;
      }

      if (el.setPointerCapture) {
        try {
          el.setPointerCapture(pe.pointerId);
        } catch {
          // Alguns elementos SVG virtuais podem recusar captura em testes
        }
      }

      const pointerSvg = this.clientToSvgPoint(pe.clientX, pe.clientY, false);
      const grabOffset = latest.origin
        ? { x: pointerSvg.x - latest.origin.x, y: pointerSvg.y - latest.origin.y }
        : { x: 0, y: 0 };

      this.activeDrag = {
        pointerId: pe.pointerId,
        config: latest,
        startClientX: pe.clientX,
        startClientY: pe.clientY,
        dragging: false,
        grabOffset,
        ghostEl: null,
        hoveredZoneId: null,
      };
    };

    const onPointerMove = (event: Event): void => {
      const pe = event as PointerEvent;
      const session = this.activeDrag;
      if (!session || session.pointerId !== pe.pointerId || session.config.element !== el) return;

      if (pe.pointerType !== 'mouse' && pe.cancelable) {
        pe.preventDefault();
      }

      if (!session.dragging) {
        const dx = pe.clientX - session.startClientX;
        const dy = pe.clientY - session.startClientY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        this.beginVisualDrag(session);
      }

      const svgPt = this.clientToSvgPoint(pe.clientX, pe.clientY);
      const clientPt = { x: pe.clientX, y: pe.clientY };
      const targetPt = {
        x: Math.max(0, Math.min(STAGE_WIDTH, svgPt.x - session.grabOffset.x)),
        y: Math.max(0, Math.min(STAGE_HEIGHT, svgPt.y - session.grabOffset.y)),
      };

      this.updateGhostPosition(session, targetPt);
      this.updateDropHover(session, svgPt, clientPt, targetPt);
    };

    const onPointerUp = (event: Event): void => {
      const pe = event as PointerEvent;
      const session = this.activeDrag;
      if (!session || session.pointerId !== pe.pointerId || session.config.element !== el) return;

      if (el.releasePointerCapture && el.hasPointerCapture?.(pe.pointerId)) {
        try {
          el.releasePointerCapture(pe.pointerId);
        } catch {
          // Ignora caso já tenha sido liberado
        }
      }

      if (session.dragging) {
        const svgPt = this.clientToSvgPoint(pe.clientX, pe.clientY);
        const clientPt = { x: pe.clientX, y: pe.clientY };
        const targetPt = {
          x: Math.max(0, Math.min(STAGE_WIDTH, svgPt.x - session.grabOffset.x)),
          y: Math.max(0, Math.min(STAGE_HEIGHT, svgPt.y - session.grabOffset.y)),
        };
        const dropZone = this.findMatchingDropZone(
          svgPt,
          session.config.moleculeId,
          clientPt,
          session.config.element,
          targetPt,
        );
        this.endDragSession(false);

        if (dropZone) {
          this.clearSelection();
          this.bus.emit('interaction:apply', {
            moleculeId: session.config.moleculeId,
            targetZoneId: dropZone.id,
            mode: 'drag',
          });
        }
        return;
      }

      // Toque/clique curto (sem arraste)
      this.endDragSession(false);
      this.handleShortTapOnDraggable(session.config);
    };

    const onPointerCancel = (event: Event): void => {
      const pe = event as PointerEvent;
      if (this.activeDrag?.pointerId === pe.pointerId) {
        this.endDragSession(false);
      }
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('lostpointercapture', onPointerCancel);

    const cleanup = (): void => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('lostpointercapture', onPointerCancel);
      el.classList.remove('draggable', 'is-dragging');
      delete el.dataset.selected;
      delete el.dataset.dragging;
    };

    this.draggables.set(el, { config, cleanup });
    return () => {
      cleanup();
      this.draggables.delete(el);
    };
  }

  registerDropZone(config: DropZoneConfig): () => void {
    const existing = this.dropZones.get(config.id);
    if (existing) {
      existing.cleanup();
      this.dropZones.delete(config.id);
    }

    const el = config.element;
    el.dataset.zoneId = config.id;

    const onClick = (event: Event): void => {
      if (!this.selectedMoleculeId) return;
      // Evita interferência caso o próprio draggable já trate o toque
      if (this.draggables.has(el)) return;
      event.stopPropagation();

      const chosen = this.selectedMoleculeId;
      this.clearSelection();
      this.bus.emit('interaction:apply', {
        moleculeId: chosen,
        targetZoneId: config.id,
        mode: 'click',
      });
    };

    el.addEventListener('click', onClick);

    const cleanup = (): void => {
      el.removeEventListener('click', onClick);
      delete el.dataset.dropHover;
      delete el.dataset.targetReady;
    };

    this.dropZones.set(config.id, { config, cleanup });
    this.syncSelectionAttributes();

    return () => {
      cleanup();
      this.dropZones.delete(config.id);
    };
  }

  private handleShortTapOnDraggable(config: DraggableConfig): void {
    // Suporta crafting por clique quando outra molécula já selecionada clica em um alvo (SVG ou Pool)
    if (this.selectedMoleculeId && this.selectedMoleculeId !== config.moleculeId) {
      const selectedId = this.selectedMoleculeId;
      const matchingZone = [...this.dropZones.values()].find(
        (entry) =>
          entry.config.element === config.element &&
          (!entry.config.accepts || entry.config.accepts(selectedId)),
      );
      if (matchingZone) {
        this.clearSelection();
        this.bus.emit('interaction:apply', {
          moleculeId: selectedId,
          targetZoneId: matchingZone.config.id,
          mode: 'click',
        });
        return;
      }
    }

    this.selectMolecule(config.moleculeId);
  }

  private beginVisualDrag(session: ActiveDragSession): void {
    session.dragging = true;
    session.config.element.classList.add('is-dragging');
    session.config.element.dataset.dragging = 'true';
    if (this.svgRoot) {
      this.svgRoot.dataset.dragging = 'true';
    }

    this.ensureGhostLayer();
    if (this.ghostLayer) {
      const ghost = this.createDragGhost(session.config);
      this.ghostLayer.appendChild(ghost);
      session.ghostEl = ghost;
    }
  }

  private endDragSession(keepSelection: boolean): void {
    const session = this.activeDrag;
    if (!session) return;

    session.config.element.classList.remove('is-dragging');
    delete session.config.element.dataset.dragging;
    session.ghostEl?.remove();

    if (this.svgRoot) {
      delete this.svgRoot.dataset.dragging;
    }

    for (const entry of this.dropZones.values()) {
      delete entry.config.element.dataset.dropHover;
    }

    this.activeDrag = null;
    if (!keepSelection) {
      this.syncSelectionAttributes();
    }
  }

  private createDragGhost(config: DraggableConfig): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'drag-ghost');
    group.setAttribute('pointer-events', 'none');

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('r', '26');
    circle.setAttribute('fill', this.roleToCssColor(config.role));
    circle.setAttribute('fill-opacity', '0.92');
    circle.setAttribute('stroke', '#f8fafc');
    circle.setAttribute('stroke-width', '2');

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('fill', '#0f172a');
    label.setAttribute('font-family', 'var(--font-mono)');
    label.setAttribute('font-size', '12');
    label.setAttribute('font-weight', '700');
    label.textContent = config.label ?? config.moleculeId;

    group.append(circle, label);
    return group;
  }

  private updateGhostPosition(session: ActiveDragSession, point: SvgPoint): void {
    if (!session.ghostEl) return;
    session.ghostEl.setAttribute('transform', `translate(${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
  }

  private updateDropHover(
    session: ActiveDragSession,
    svgPoint: SvgPoint,
    clientPoint: SvgPoint,
    ghostPoint?: SvgPoint,
  ): void {
    const match = this.findMatchingDropZone(
      svgPoint,
      session.config.moleculeId,
      clientPoint,
      session.config.element,
      ghostPoint,
    );
    const nextZoneId = match?.id ?? null;

    if (session.hoveredZoneId === nextZoneId) return;
    session.hoveredZoneId = nextZoneId;

    for (const entry of this.dropZones.values()) {
      if (entry.config.id === nextZoneId) {
        entry.config.element.dataset.dropHover = 'true';
      } else {
        delete entry.config.element.dataset.dropHover;
      }
    }
  }

  private findMatchingDropZone(
    svgPoint: SvgPoint,
    moleculeId: MoleculeId,
    clientPoint?: SvgPoint,
    draggedElement?: HTMLElement | SVGElement,
    ghostPoint?: SvgPoint,
  ): DropZoneConfig | null {
    // 1. Testa zonas HTML (ex.: chips de crafting no MolecularPool) em coordenadas de tela
    if (clientPoint) {
      let bestHtmlZone: DropZoneConfig | null = null;
      let bestHtmlDistance = Number.POSITIVE_INFINITY;

      for (const { config } of this.dropZones.values()) {
        if (!(config.element instanceof HTMLElement)) continue;
        if (config.element === draggedElement) continue;
        if (config.accepts && !config.accepts(moleculeId)) continue;

        const rect = config.element.getBoundingClientRect();
        const pad = config.hitPadding ?? 12;
        if (
          clientPoint.x >= rect.left - pad &&
          clientPoint.x <= rect.right + pad &&
          clientPoint.y >= rect.top - pad &&
          clientPoint.y <= rect.bottom + pad
        ) {
          const cx = (rect.left + rect.right) / 2;
          const cy = (rect.top + rect.bottom) / 2;
          const distance = Math.hypot(clientPoint.x - cx, clientPoint.y - cy);
          if (distance < bestHtmlDistance) {
            bestHtmlDistance = distance;
            bestHtmlZone = config;
          }
        }
      }

      if (bestHtmlZone) {
        return bestHtmlZone;
      }
    }

    // 2. Testa zonas SVG no espaço lógico 1200x700
    let bestSvgZone: DropZoneConfig | null = null;
    let bestSvgDistance = Number.POSITIVE_INFINITY;

    for (const { config } of this.dropZones.values()) {
      if (config.element instanceof HTMLElement) continue;
      if (config.element === draggedElement) continue;
      if (config.accepts && !config.accepts(moleculeId)) continue;

      const fingerDist = Math.hypot(svgPoint.x - config.x, svgPoint.y - config.y);
      const ghostDist = ghostPoint
        ? Math.hypot(ghostPoint.x - config.x, ghostPoint.y - config.y)
        : fingerDist;
      const distance = Math.min(fingerDist, ghostDist);
      if (distance <= config.hitRadius && distance < bestSvgDistance) {
        bestSvgDistance = distance;
        bestSvgZone = config;
      }
    }

    return bestSvgZone;
  }

  private syncSelectionAttributes(): void {
    for (const { config } of this.draggables.values()) {
      const selected = this.selectedMoleculeId !== null && config.moleculeId === this.selectedMoleculeId;
      config.element.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if (selected) {
        config.element.dataset.selected = 'true';
      } else {
        delete config.element.dataset.selected;
      }
    }

    for (const { config } of this.dropZones.values()) {
      const ready =
        this.selectedMoleculeId !== null &&
        (!config.accepts || config.accepts(this.selectedMoleculeId));
      if (ready) {
        config.element.dataset.targetReady = 'true';
      } else {
        delete config.element.dataset.targetReady;
      }
    }
  }

  private ensureGhostLayer(): void {
    if (!this.svgRoot) return;
    if (this.ghostLayer && this.ghostLayer.parentNode === this.svgRoot) return;

    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'interaction-ghost-layer');
    layer.setAttribute('pointer-events', 'none');
    this.svgRoot.appendChild(layer);
    this.ghostLayer = layer;
  }

  private roleToCssColor(role: DraggableConfig['role']): string {
    switch (role) {
      case 'activator':
        return 'var(--activator-color)';
      case 'repressor':
        return 'var(--repressor-color)';
      case 'enzyme':
        return 'var(--enzyme-core)';
      case 'small-molecule':
        return 'var(--small-molecule)';
      case 'epigenetic':
        return 'var(--epigenetic-mark)';
      default:
        return 'var(--dna-backbone)';
    }
  }
}
