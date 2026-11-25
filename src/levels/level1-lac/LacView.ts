import type { ILevel, LevelContext, LevelMetadata } from '../LevelInterface';
import type { ActionFeedback, MoleculeId, MoleculeSpec } from '../../core/types';
import { LacEngine, type LacState } from './LacEngine';
import {
  LAC_BRIEFING,
  LAC_EXIT_MUTATION,
  LAC_LEVEL_ID,
  LAC_STAGE_CONTEXT_INFO,
  type StageContextInfo,
} from './lacData';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Palco SVG BioRender Vivo + Card de Scan + Trava de Saída do Nível 1 (Operon lac).
 */
export class LacView implements ILevel {
  readonly metadata: LevelMetadata = {
    id: LAC_LEVEL_ID,
    order: 1,
    title: 'Operon lac',
    subtitle: 'O Interruptor Bacteriano',
    environment: 'cytoplasm',
  };

  private context: LevelContext | null = null;
  private engine: LacEngine | null = null;
  private unsubscribers: Array<() => void> = [];
  private interactionCleanups: Array<() => void> = [];

  // Referências SVG reutilizáveis (criadas uma única vez em mount)
  private lactoseGateEl!: SVGGElement;
  private glucoseGateEl!: SVGGElement;
  private extLactoseEl!: SVGGElement;
  private extGlucoseEl!: SVGGElement;
  private adenylateCyclaseEl!: SVGGElement;
  private betaGalBasalEl!: SVGGElement;
  private ribosomeGroupEl!: SVGGElement;
  private lactoseDiffusionEl!: SVGGElement;
  private glucoseDiffusionEl!: SVGGElement;
  private laciEl!: SVGGElement;
  private laciPathEl!: SVGPathElement;
  private laciLigandEl!: SVGGElement;
  private capEl!: SVGGElement;
  private campEl!: SVGGElement;
  private capCampEl!: SVGGElement;
  private allolactoseEl!: SVGGElement;
  private rnapEl!: SVGGElement;
  private mrnaGroupEl!: SVGGElement;
  private mrnaPathEl!: SVGPathElement;

  private zoneCapEl!: SVGGElement;
  private zonePromoterEl!: SVGGElement;
  private zoneOperatorEl!: SVGGElement;
  private dnaGroupEl!: SVGGElement;
  private capRnapBridgeEl!: SVGGElement;

  // Overlays HTML do nível
  private overlayLayer!: HTMLElement;
  private briefingBackdropEl!: HTMLElement;
  private focusPopupBackdropEl!: HTMLElement;
  private focusPopupCardEl!: HTMLElement;
  private feedbackToastEl!: HTMLElement;
  private exitLockBtnEl!: HTMLButtonElement;
  private mutationBackdropEl!: HTMLElement;
  private mutationFeedbackEl!: HTMLElement;
  private mutationFooterEl!: HTMLElement;
  private mutationRetryTimer: number | null = null;
  private bumpTimer: number | null = null;
  private feedbackTimer: number | null = null;
  private feedbackHideTimer: number | null = null;
  private pendingFlySpec: MoleculeSpec | null = null;
  private isBumpingRnap = false;

  mount(context: LevelContext): void {
    this.context = context;
    const savedDiscovered = context.assessment.getDiscoveredMolecules(LAC_LEVEL_ID);
    this.engine = new LacEngine(savedDiscovered);

    context.assessment.startLevel(LAC_LEVEL_ID);
    this.buildStageSvg(context.stageSvg);
    context.interaction.attachStage(context.stageSvg);
    this.buildOverlays();
    this.bindEvents();
    this.configurePoolCrafting();

    this.renderState(this.engine.getState());
    this.syncPoolAndManual();
  }

  unmount(): void {
    if (this.bumpTimer !== null) {
      window.clearTimeout(this.bumpTimer);
      this.bumpTimer = null;
    }
    if (this.feedbackTimer !== null) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    if (this.feedbackHideTimer !== null) {
      window.clearTimeout(this.feedbackHideTimer);
      this.feedbackHideTimer = null;
    }
    if (this.mutationRetryTimer !== null) {
      window.clearTimeout(this.mutationRetryTimer);
      this.mutationRetryTimer = null;
    }

    for (const cleanup of this.interactionCleanups) {
      cleanup();
    }
    this.interactionCleanups = [];

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    this.context?.pool.setCraftingZoneResolver(null);
    this.context?.interaction.clearRegistry();
    this.overlayLayer?.remove();
    this.engine = null;
    this.context = null;
  }

  reset(): void {
    if (!this.engine || !this.context) return;
    this.isBumpingRnap = false;
    this.context.interaction.clearSelection();
    const state = this.engine.reset(true);
    this.closeMutationModal();
    this.renderState(state);
    this.syncPoolAndManual();
    this.showFeedback({
      valid: true,
      eventCode: 'LEVEL_RESET',
      message: 'Estado celular reiniciado. Explore os canais e o controle positivo/negativo.',
    });
  }

  private buildStageSvg(svg: SVGSVGElement): void {
    svg.replaceChildren();

    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <linearGradient id="lac-extracellular-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#164e63" stop-opacity="0.46" />
        <stop offset="100%" stop-color="#0e7490" stop-opacity="0.24" />
      </linearGradient>
      <linearGradient id="lac-cytoplasm-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0b1322" stop-opacity="0.52" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.22" />
      </linearGradient>
      <linearGradient id="lac-membrane-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28" />
        <stop offset="50%" stop-color="#0284c7" stop-opacity="0.16" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.28" />
      </linearGradient>
      <linearGradient id="lac-dna-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0ea5e9" />
        <stop offset="50%" stop-color="#38bdf8" />
        <stop offset="100%" stop-color="#0284c7" />
      </linearGradient>
      <linearGradient id="lac-dna-complement-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7" stop-opacity="0.65" />
        <stop offset="50%" stop-color="#7dd3fc" stop-opacity="0.7" />
        <stop offset="100%" stop-color="#0369a1" stop-opacity="0.65" />
      </linearGradient>
      <filter id="lac-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    const root = document.createElementNS(SVG_NS, 'g');
    root.setAttribute('class', 'lac-stage-root');

    // 1. Meio Extracelular + Citoplasma + Membrana Celular arqueada para cima (de fora a fora)
    const membraneGroup = document.createElementNS(SVG_NS, 'g');
    membraneGroup.setAttribute('class', 'cell-membrane');
    membraneGroup.innerHTML = `
      <!-- Compartimento extracelular (acima da membrana, tom mais claro/esverdeado) -->
      <path d="M -1200 -900 L 2400 -900 L 2400 352 Q 600 -188 -1200 352 Z" fill="url(#lac-extracellular-grad)" />
      <!-- Compartimento intracelular / citoplasma (abaixo da membrana, tom azul profundo) -->
      <path d="M -1200 380 Q 600 -160 2400 380 L 2400 1600 L -1200 1600 Z" fill="url(#lac-cytoplasm-grad)" />

      <!-- Moléculas de lactose externas difundindo lentamente da direita para a esquerda -->
      <g class="extracellular-lactose" aria-hidden="true">
        <g transform="translate(130, 32)">
          <g class="diffuse-rtl" style="--diffuse-duration: 14s; --diffuse-delay: -2s">
            <polygon points="0,-9 10,0 0,9 -10,0" fill="var(--small-molecule)" fill-opacity="0.82" stroke="#fef3c7" stroke-width="1.2" />
            <polygon points="14,-6 21,0 14,6 7,0" fill="var(--small-molecule)" fill-opacity="0.68" stroke="#fef3c7" stroke-width="1" />
          </g>
        </g>
        <g transform="translate(340, 24)">
          <g class="diffuse-rtl" style="--diffuse-duration: 16s; --diffuse-delay: -7s">
            <polygon points="0,-8 9,0 0,8 -9,0" fill="var(--small-molecule)" fill-opacity="0.78" stroke="#fef3c7" stroke-width="1.2" />
            <polygon points="13,-6 19,0 13,6 7,0" fill="var(--small-molecule)" fill-opacity="0.65" stroke="#fef3c7" stroke-width="1" />
          </g>
        </g>
        <g transform="translate(560, 18)">
          <g class="diffuse-rtl" style="--diffuse-duration: 13s; --diffuse-delay: -4s">
            <polygon points="0,-9 10,0 0,9 -10,0" fill="var(--small-molecule)" fill-opacity="0.85" stroke="#fef3c7" stroke-width="1.2" />
            <polygon points="14,-6 21,0 14,6 7,0" fill="var(--small-molecule)" fill-opacity="0.7" stroke="#fef3c7" stroke-width="1" />
          </g>
        </g>
        <g transform="translate(790, 26)">
          <g class="diffuse-rtl" style="--diffuse-duration: 15s; --diffuse-delay: -10s">
            <polygon points="0,-8 9,0 0,8 -9,0" fill="var(--small-molecule)" fill-opacity="0.8" stroke="#fef3c7" stroke-width="1.2" />
            <polygon points="13,-6 19,0 13,6 7,0" fill="var(--small-molecule)" fill-opacity="0.66" stroke="#fef3c7" stroke-width="1" />
          </g>
        </g>
        <g transform="translate(1030, 38)">
          <g class="diffuse-rtl" style="--diffuse-duration: 14.5s; --diffuse-delay: -5.5s">
            <polygon points="0,-9 10,0 0,9 -10,0" fill="var(--small-molecule)" fill-opacity="0.82" stroke="#fef3c7" stroke-width="1.2" />
            <polygon points="14,-6 21,0 14,6 7,0" fill="var(--small-molecule)" fill-opacity="0.68" stroke="#fef3c7" stroke-width="1" />
          </g>
        </g>
      </g>

      <!-- Bicamada lipídica em arco convexo (de fora a fora na tela) -->
      <path d="M -1200 352 Q 600 -188 2400 352 L 2400 380 Q 600 -160 -1200 380 Z"
            fill="url(#lac-membrane-grad)" />
      <path d="M -1200 352 Q 600 -188 2400 352"
            fill="none" stroke="var(--dna-backbone)" stroke-opacity="0.45" stroke-width="1.8" />
      <path d="M -1200 380 Q 600 -160 2400 380"
            fill="none" stroke="var(--dna-backbone)" stroke-opacity="0.38" stroke-width="1.8" />
    `;

    membraneGroup.appendChild(this.createPhospholipidBilayer());

    this.lactoseGateEl = this.createChannelNode({
      id: 'channel-lactose',
      x: 340,
      y: 102,
      angle: -2.5,
      label: 'Canal de Lactose',
      accent: 'var(--small-molecule)',
      onInspect: () => this.openContextPopup('channel-lactose'),
      onClose: () => this.handleToggleLactose(),
    });
    this.glucoseGateEl = this.createChannelNode({
      id: 'channel-glucose',
      x: 860,
      y: 102,
      angle: 2.5,
      label: 'Canal de Glicose',
      accent: 'var(--dna-backbone)',
      onInspect: () => this.openContextPopup('channel-glucose'),
      onClose: () => this.handleToggleGlucose(),
    });
    membraneGroup.append(this.lactoseGateEl, this.glucoseGateEl);

    // Moléculas externas interativas para contato com os canais
    this.extLactoseEl = this.createExternalLactoseNode();
    this.extGlucoseEl = this.createExternalGlucoseNode();
    membraneGroup.append(this.extLactoseEl, this.extGlucoseEl);

    // Enzimas automáticas de contexto: Adenilato Ciclase (membrana) e β-galactosidase basal (citoplasma)
    this.adenylateCyclaseEl = this.createAdenylateCyclaseNode();
    this.betaGalBasalEl = this.createBetaGalBasalNode();
    membraneGroup.append(this.adenylateCyclaseEl, this.betaGalBasalEl);

    // Difusão citoplasmática de Lactose (direita -> esquerda) e Glicose (esquerda -> direita)
    this.lactoseDiffusionEl = this.createCytoplasmDiffusionGroup('rtl');
    this.glucoseDiffusionEl = this.createCytoplasmDiffusionGroup('ltr');
    membraneGroup.append(this.lactoseDiffusionEl, this.glucoseDiffusionEl);

    // 2. Cromossomo Circular Bacteriano em Perspectiva (fundo) + Dupla Hélice Principal
    const dnaGroup = document.createElementNS(SVG_NS, 'g');
    dnaGroup.setAttribute('class', 'lac-dna-strand');
    dnaGroup.dataset.capBent = 'false';
    this.dnaGroupEl = dnaGroup;
    dnaGroup.appendChild(this.createCircularChromosomeBackdrop());

    const capBendGroup = document.createElementNS(SVG_NS, 'g');
    capBendGroup.setAttribute('class', 'dna-cap-bend-group');
    capBendGroup.innerHTML = `
      <!-- Fita complementar a montante (x=48..378, dobra quando CAP-cAMP encaixa) -->
      <path d="M 48 480
               C 72 480, 86 442, 114 442
               C 142 442, 156 484, 184 484
               C 200 484, 206 486, 215 486
               L 275 486
               C 292 486, 304 442, 326 442
               C 348 442, 358 488, 378 488"
            stroke="url(#lac-dna-complement-grad)" stroke-width="5" stroke-linecap="round" fill="none" />
      <!-- Fita principal a montante (x=48..378) -->
      <path d="M 48 446
               C 72 446, 86 484, 114 484
               C 142 484, 156 444, 184 444
               C 200 444, 206 445, 215 445
               M 275 445
               C 292 445, 304 484, 326 484
               C 348 484, 358 445, 378 445"
            stroke="url(#lac-dna-grad)" stroke-width="6.5" stroke-linecap="round" fill="none" />
    `;
    capBendGroup.appendChild(this.createForegroundBasePairRungs('upstream'));
    dnaGroup.appendChild(capBendGroup);
    dnaGroup.appendChild(this.createForegroundBasePairRungs('downstream'));

    const dnaForeground = document.createElementNS(SVG_NS, 'g');
    dnaForeground.innerHTML = `
      <!-- Fita complementar a jusante (x=378..1172) -->
      <path d="M 378 488
               L 452 488
               C 472 488, 482 442, 502 442
               C 520 442, 526 488, 542 488
               L 598 488
               C 616 488, 624 444, 642 444
               C 652 444, 658 492, 665 492
               H 1118
               C 1134 492, 1146 446, 1172 446"
            stroke="url(#lac-dna-complement-grad)" stroke-width="5" stroke-linecap="round" fill="none" />

      <!-- Fita principal a jusante (x=452..1172) -->
      <path d="M 452 445
               C 472 445, 482 484, 502 484
               C 520 484, 526 445, 542 445
               M 598 445
               C 616 445, 624 484, 642 484
               C 652 484, 658 428, 665 428
               H 1118
               C 1134 428, 1146 480, 1172 480"
            stroke="url(#lac-dna-grad)" stroke-width="6.5" stroke-linecap="round" fill="none" />

      <!-- Cassetes dos genes estruturais lacZ, lacY, lacA (abertura da dupla hélice) -->
      <g class="genes-structural">
        <g class="gene-cassette" data-gene="gene-lacz" role="button" tabindex="0" aria-label="Gene lacZ">
          <rect x="665" y="428" width="145" height="64" rx="12" fill="rgba(56, 189, 248, 0.13)" stroke="var(--dna-backbone)" stroke-width="2" />
          <text x="737" y="465" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-mono)" font-size="18" font-weight="700">lacZ</text>
        </g>

        <g class="gene-cassette" data-gene="gene-lacy" role="button" tabindex="0" aria-label="Gene lacY">
          <rect x="824" y="428" width="145" height="64" rx="12" fill="rgba(56, 189, 248, 0.13)" stroke="var(--dna-backbone)" stroke-width="2" />
          <text x="896" y="465" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-mono)" font-size="18" font-weight="700">lacY</text>
        </g>

        <g class="gene-cassette" data-gene="gene-laca" role="button" tabindex="0" aria-label="Gene lacA">
          <rect x="983" y="428" width="135" height="64" rx="12" fill="rgba(56, 189, 248, 0.13)" stroke="var(--dna-backbone)" stroke-width="2" />
          <text x="1050" y="465" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-mono)" font-size="18" font-weight="700">lacA</text>
        </g>
      </g>
    `;
    dnaGroup.appendChild(dnaForeground);

    for (const geneEl of dnaForeground.querySelectorAll<SVGGElement>('.gene-cassette')) {
      const geneId = geneEl.dataset.gene;
      if (!geneId) continue;
      geneEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openContextPopup(geneId);
      });
      geneEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.openContextPopup(geneId);
        }
      });
    }

    // Zonas de encaixe com geometria chave-fechadura e áreas de colisão generosas
    this.zoneCapEl = this.createDnaZone({
      id: 'zone-cap',
      cx: 245,
      cy: 445,
      hitRadius: 60,
      notchPath: 'M 215 445 A 30 30 0 0 0 275 445',
      stroke: 'var(--activator-color)',
      label: 'Sítio CAP',
      labelY: 522,
    });

    this.zonePromoterEl = this.createDnaZone({
      id: 'zone-promoter',
      cx: 415,
      cy: 445,
      hitRadius: 62,
      notchPath: 'M 378 445 V 474 H 452 V 445',
      stroke: 'var(--dna-promoter)',
      label: 'Promotor (P)',
      labelY: 522,
    });

    this.zoneOperatorEl = this.createDnaZone({
      id: 'zone-operator',
      cx: 570,
      cy: 445,
      hitRadius: 62,
      notchPath: 'M 542 445 L 570 477 L 598 445',
      stroke: 'var(--dna-operator)',
      label: 'Operador (O)',
      labelY: 522,
    });

    capBendGroup.appendChild(this.zoneCapEl);
    dnaGroup.append(this.zonePromoterEl, this.zoneOperatorEl);

    // Ponte de recrutamento/estabilização entre CAP-cAMP e RNApol
    this.capRnapBridgeEl = document.createElementNS(SVG_NS, 'g');
    this.capRnapBridgeEl.setAttribute('id', 'cap-rnap-bridge');
    this.capRnapBridgeEl.setAttribute('class', 'cap-rnap-bridge');
    this.capRnapBridgeEl.dataset.active = 'false';
    this.capRnapBridgeEl.innerHTML = `
      <path d="M 282 412 Q 326 382 372 414" fill="none" stroke="var(--activator-color)" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round" />
      <circle cx="326" cy="397" r="4" fill="#6ee7b7" />
    `;
    dnaGroup.appendChild(this.capRnapBridgeEl);

    // 3. Fita de mRNA policistrônico (animação stroke-dashoffset)
    this.mrnaGroupEl = document.createElementNS(SVG_NS, 'g');
    this.mrnaGroupEl.setAttribute('class', 'lac-mrna-group');
    this.mrnaPathEl = document.createElementNS(SVG_NS, 'path');
    this.mrnaPathEl.setAttribute(
      'd',
      'M 432 414 Q 505 386, 585 386 T 735 386 T 885 386 T 1035 386 T 1118 386',
    );
    this.mrnaPathEl.setAttribute('fill', 'none');
    this.mrnaPathEl.setAttribute('stroke', 'var(--mrna-strand)');
    this.mrnaPathEl.setAttribute('stroke-width', '5');
    this.mrnaPathEl.setAttribute('stroke-linecap', 'round');
    this.mrnaPathEl.setAttribute('class', 'mrna-flow-strand');

    const mrnaTag = document.createElementNS(SVG_NS, 'text');
    mrnaTag.setAttribute('x', '890');
    mrnaTag.setAttribute('y', '334');
    mrnaTag.setAttribute('text-anchor', 'middle');
    mrnaTag.setAttribute('fill', 'var(--mrna-strand)');
    mrnaTag.setAttribute('font-family', 'var(--font-mono)');
    mrnaTag.setAttribute('font-size', '11.5');
    mrnaTag.textContent = 'mRNA policistrônico (lacZ · lacY · lacA)';

    this.ribosomeGroupEl = this.createRibosomeTranslationNode();
    this.mrnaGroupEl.append(this.mrnaPathEl, mrnaTag, this.ribosomeGroupEl);

    // 4. Moléculas no Palco (criadas uma única vez e atualizadas declarativamente)
    this.laciEl = this.createLaciNode();
    this.capEl = this.createCapNode();
    this.campEl = this.createCampNode();
    this.capCampEl = this.createCapCampNode();
    this.allolactoseEl = this.createAllolactoseNode();
    this.rnapEl = this.createRnapNode();

    root.append(
      membraneGroup,
      dnaGroup,
      this.mrnaGroupEl,
      this.laciEl,
      this.capCampEl,
      this.rnapEl,
      this.capEl,
      this.campEl,
      this.allolactoseEl,
      this.extLactoseEl,
      this.extGlucoseEl,
    );
    svg.appendChild(root);
  }

  private createCircularChromosomeBackdrop(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'circular-chromosome-backdrop');
    group.setAttribute('aria-hidden', 'true');
    group.style.pointerEvents = 'none';

    const evalCubic = (
      p0: [number, number],
      p1: [number, number],
      p2: [number, number],
      p3: [number, number],
      t: number,
    ): { x: number; y: number; tx: number; ty: number } => {
      const omt = 1 - t;
      const x =
        omt * omt * omt * p0[0] +
        3 * omt * omt * t * p1[0] +
        3 * omt * t * t * p2[0] +
        t * t * t * p3[0];
      const y =
        omt * omt * omt * p0[1] +
        3 * omt * omt * t * p1[1] +
        3 * omt * t * t * p2[1] +
        t * t * t * p3[1];
      const tx =
        3 * omt * omt * (p1[0] - p0[0]) +
        6 * omt * t * (p2[0] - p1[0]) +
        3 * t * t * (p3[0] - p2[0]);
      const ty =
        3 * omt * omt * (p1[1] - p0[1]) +
        6 * omt * t * (p2[1] - p1[1]) +
        3 * t * t * (p3[1] - p2[1]);
      return { x, y, tx, ty };
    };

    const sampleArc = (s: number) => {
      const pt =
        s <= 0.5
          ? evalCubic([48, 463], [-48, 463], [-12, 678], [610, 678], s * 2)
          : evalCubic([610, 678], [1232, 678], [1268, 463], [1172, 463], (s - 0.5) * 2);

      const len = Math.hypot(pt.tx, pt.ty) || 1;
      // Normal perpendicular à curva
      const nx = -pt.ty / len;
      const ny = pt.tx / len;
      const perspective = 1 - 0.72 * Math.sin(Math.PI * s);
      const amp = 17 * perspective;
      const phase = s * Math.PI * 22;
      const offset = amp * Math.cos(phase);

      return {
        x1: pt.x + nx * offset,
        y1: pt.y + ny * offset,
        x2: pt.x - nx * offset,
        y2: pt.y - ny * offset,
        perspective,
      };
    };

    const steps = 84;
    const pts = Array.from({ length: steps + 1 }, (_, i) => sampleArc(i / steps));
    const parts: string[] = [];

    for (let i = 0; i < steps; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const p = (a.perspective + b.perspective) * 0.5;
      const widthMain = (1.6 + 3.4 * p).toFixed(2);
      const widthComp = (1.3 + 2.6 * p).toFixed(2);
      const opMain = (0.14 + 0.44 * p).toFixed(2);
      const opComp = (0.1 + 0.32 * p).toFixed(2);

      if (i % 3 === 1) {
        parts.push(
          `<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${a.x2.toFixed(1)}" y2="${a.y2.toFixed(1)}" stroke="#38bdf8" stroke-opacity="${(0.06 + 0.16 * p).toFixed(2)}" stroke-width="${(0.9 + 1.1 * p).toFixed(2)}" stroke-linecap="round" />`,
        );
      }

      parts.push(
        `<line x1="${a.x2.toFixed(1)}" y1="${a.y2.toFixed(1)}" x2="${b.x2.toFixed(1)}" y2="${b.y2.toFixed(1)}" stroke="#7dd3fc" stroke-opacity="${opComp}" stroke-width="${widthComp}" stroke-linecap="round" />`,
        `<line x1="${a.x1.toFixed(1)}" y1="${a.y1.toFixed(1)}" x2="${b.x1.toFixed(1)}" y2="${b.y1.toFixed(1)}" stroke="#38bdf8" stroke-opacity="${opMain}" stroke-width="${widthMain}" stroke-linecap="round" />`,
      );
    }

    group.innerHTML = parts.join('');
    return group;
  }

  private createPhospholipidBilayer(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'phospholipid-bilayer');
    group.setAttribute('aria-hidden', 'true');

    // Curva externa: P0=(-1200, 352), P1=(600, -188), P2=(2400, 352)
    const parts: string[] = [];
    const total = 150;
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const omt = 1 - t;
      const x = omt * omt * -1200 + 2 * omt * t * 600 + t * t * 2400;
      if (x < -480 || x > 1680) continue;
      // Pula aberturas dos dois canais de membrana
      if ((x > 288 && x < 392) || (x > 808 && x < 912)) continue;

      const yOuter = omt * omt * 352 + 2 * omt * t * -188 + t * t * 352;
      const yInner = yOuter + 28;
      const dy = 2 * omt * (-188 - 352) + 2 * t * (352 - -188);
      const dx = 3600;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const ox = x.toFixed(1);
      const oy = yOuter.toFixed(1);
      const ix = (x + nx * 28).toFixed(1);
      const iy = (yInner).toFixed(1);

      const t1x = (x + nx * 12 - 2.2).toFixed(1);
      const t1y = (yOuter + ny * 12).toFixed(1);
      const t2x = (x + nx * 12 + 2.2).toFixed(1);
      const t2y = (yOuter + ny * 12).toFixed(1);

      const b1x = (x + nx * 16 - 2.2).toFixed(1);
      const b1y = (yInner - ny * 12).toFixed(1);
      const b2x = (x + nx * 16 + 2.2).toFixed(1);
      const b2y = (yInner - ny * 12).toFixed(1);

      parts.push(
        `<line x1="${(x - 2.2).toFixed(1)}" y1="${oy}" x2="${t1x}" y2="${t1y}" stroke="#7dd3fc" stroke-opacity="0.34" stroke-width="1.2" />`,
        `<line x1="${(x + 2.2).toFixed(1)}" y1="${oy}" x2="${t2x}" y2="${t2y}" stroke="#7dd3fc" stroke-opacity="0.34" stroke-width="1.2" />`,
        `<line x1="${(Number(ix) - 2.2).toFixed(1)}" y1="${iy}" x2="${b1x}" y2="${b1y}" stroke="#7dd3fc" stroke-opacity="0.3" stroke-width="1.2" />`,
        `<line x1="${(Number(ix) + 2.2).toFixed(1)}" y1="${iy}" x2="${b2x}" y2="${b2y}" stroke="#7dd3fc" stroke-opacity="0.3" stroke-width="1.2" />`,
        `<circle cx="${ox}" cy="${oy}" r="4.2" fill="#38bdf8" fill-opacity="0.55" stroke="#bae6fd" stroke-opacity="0.45" stroke-width="0.9" />`,
        `<circle cx="${ix}" cy="${iy}" r="4.2" fill="#38bdf8" fill-opacity="0.48" stroke="#bae6fd" stroke-opacity="0.38" stroke-width="0.9" />`,
      );
    }

    group.innerHTML = parts.join('');
    return group;
  }

  private createCytoplasmDiffusionGroup(direction: 'rtl' | 'ltr'): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', `cytoplasm-diffusion-${direction}`);
    group.setAttribute('aria-hidden', 'true');
    group.style.display = 'none';

    const seeds =
      direction === 'rtl'
        ? [
            { x: 960, y: 175, dur: '12.5s', delay: '-1s' },
            { x: 760, y: 240, dur: '14.5s', delay: '-5s' },
            { x: 540, y: 195, dur: '13.5s', delay: '-8.5s' },
            { x: 340, y: 270, dur: '15.2s', delay: '-3.2s' },
          ]
        : [
            { x: 260, y: 185, dur: '12.8s', delay: '-1.5s' },
            { x: 480, y: 255, dur: '14.2s', delay: '-6s' },
            { x: 700, y: 190, dur: '13.4s', delay: '-9s' },
            { x: 900, y: 265, dur: '15s', delay: '-3.5s' },
          ];

    const animClass = direction === 'rtl' ? 'diffuse-rtl' : 'diffuse-ltr';
    group.innerHTML = seeds
      .map((s) => {
        if (direction === 'rtl') {
          return `
            <g transform="translate(${s.x}, ${s.y})">
              <g class="${animClass}" style="--diffuse-duration: ${s.dur}; --diffuse-delay: ${s.delay}">
                <polygon points="0,-8 9,0 0,8 -9,0" fill="var(--small-molecule)" fill-opacity="0.65" stroke="#fef3c7" stroke-width="1" />
                <polygon points="12,-5 18,0 12,5 6,0" fill="var(--small-molecule)" fill-opacity="0.5" stroke="#fef3c7" stroke-width="0.9" />
              </g>
            </g>
          `;
        }
        return `
          <g transform="translate(${s.x}, ${s.y})">
            <g class="${animClass}" style="--diffuse-duration: ${s.dur}; --diffuse-delay: ${s.delay}">
              <polygon points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4" fill="var(--dna-backbone)" fill-opacity="0.6" stroke="#e0f2fe" stroke-width="1.1" />
            </g>
          </g>
        `;
      })
      .join('');

    return group;
  }

  private createForegroundBasePairRungs(region: 'upstream' | 'downstream'): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('stroke', 'var(--dna-backbone)');
    group.setAttribute('stroke-opacity', '0.28');
    group.setAttribute('stroke-width', '2.1');
    group.setAttribute('stroke-linecap', 'round');

    type Pt = [number, number];
    const evalY = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
      const omt = 1 - t;
      const x =
        omt * omt * omt * p0[0] +
        3 * omt * omt * t * p1[0] +
        3 * omt * t * t * p2[0] +
        t * t * t * p3[0];
      const y =
        omt * omt * omt * p0[1] +
        3 * omt * omt * t * p1[1] +
        3 * omt * t * t * p2[1] +
        t * t * t * p3[1];
      return [x, y];
    };

    const pairs: Array<{ comp: [Pt, Pt, Pt, Pt]; main: [Pt, Pt, Pt, Pt] }> =
      region === 'upstream'
        ? [
            { comp: [[48, 480], [72, 480], [86, 442], [114, 442]], main: [[48, 446], [72, 446], [86, 484], [114, 484]] },
            { comp: [[114, 442], [142, 442], [156, 484], [184, 484]], main: [[114, 484], [142, 484], [156, 444], [184, 444]] },
            { comp: [[275, 486], [292, 486], [304, 442], [326, 442]], main: [[275, 445], [292, 445], [304, 484], [326, 484]] },
            { comp: [[326, 442], [348, 442], [358, 488], [378, 488]], main: [[326, 484], [348, 484], [358, 445], [378, 445]] },
          ]
        : [
            { comp: [[452, 488], [472, 488], [482, 442], [502, 442]], main: [[452, 445], [472, 445], [482, 484], [502, 484]] },
            { comp: [[502, 442], [520, 442], [526, 488], [542, 488]], main: [[502, 484], [520, 484], [526, 445], [542, 445]] },
            { comp: [[598, 488], [616, 488], [624, 444], [642, 444]], main: [[598, 445], [616, 445], [624, 484], [642, 484]] },
            { comp: [[1118, 492], [1134, 492], [1146, 446], [1172, 446]], main: [[1118, 428], [1134, 428], [1146, 480], [1172, 480]] },
          ];

    const lines: string[] = [];
    for (const seg of pairs) {
      for (const t of [0.22, 0.5, 0.78]) {
        const [x1, y1] = evalY(...seg.comp, t);
        const [x2, y2] = evalY(...seg.main, t);
        if (Math.abs(y1 - y2) < 7) continue;
        lines.push(
          `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" />`,
        );
      }
    }
    group.innerHTML = lines.join('');
    return group;
  }

  private createExternalLactoseNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-ext-lactose');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(430, 34)');
    group.innerHTML = `
      <g class="mol-visual brownian" style="--brownian-duration: 5.2s">
        <circle r="24" fill="var(--small-molecule)" fill-opacity="0.14" stroke="var(--small-molecule)" stroke-opacity="0.35" stroke-width="1.2" />
        <polygon points="-8,-11 4,0 -8,11 -20,0" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="1.6" />
        <polygon points="10,-8 20,0 10,8 0,0" fill="var(--small-molecule)" fill-opacity="0.88" stroke="#fef3c7" stroke-width="1.4" />
        <text y="22" text-anchor="middle" fill="#fde68a" font-family="var(--font-mono)" font-size="9.5" font-weight="700">Lactose</text>
        <circle class="drop-zone-hitarea" r="56" />
      </g>
    `;
    return group;
  }

  private createExternalGlucoseNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-ext-glucose');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(995, 36)');
    group.innerHTML = `
      <g class="mol-visual brownian" style="--brownian-duration: 5.6s; --brownian-delay: -1.8s">
        <circle r="22" fill="var(--dna-backbone)" fill-opacity="0.12" stroke="var(--dna-backbone)" stroke-opacity="0.32" stroke-width="1.2" />
        <polygon points="0,-13 11,-6 11,6 0,13 -11,6 -11,-6" fill="var(--dna-backbone)" stroke="#e0f2fe" stroke-width="1.6" />
        <text y="22" text-anchor="middle" fill="#bae6fd" font-family="var(--font-mono)" font-size="9.5" font-weight="700">Glicose</text>
        <circle class="drop-zone-hitarea" r="56" />
      </g>
    `;
    return group;
  }

  private createAdenylateCyclaseNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'enzyme-ac');
    group.setAttribute('class', 'auto-enzyme');
    group.setAttribute('transform', 'translate(935, 134)');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', 'Adenilato Ciclase');
    group.dataset.active = 'true';
    group.style.cursor = 'pointer';

    group.innerHTML = `
      <rect x="-36" y="-22" width="72" height="58" rx="12" fill="transparent" />
      <path class="ac-body" d="M -24 -12 C -24 -24, 24 -24, 24 -12 L 28 14 C 28 24, -28 24, -28 14 Z"
            fill="#0f766e" fill-opacity="0.88" stroke="#5eead4" stroke-width="1.8" />
      <text y="2" text-anchor="middle" dominant-baseline="central" fill="#ccfbf1" font-family="var(--font-mono)" font-size="11" font-weight="700">AC</text>
      <text class="ac-status-tag" y="32" text-anchor="middle" fill="#5eead4" font-family="var(--font-mono)" font-size="9.5" font-weight="600">ATP → cAMP</text>
    `;

    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openContextPopup('adenylate-cyclase');
    });
    return group;
  }

  private createBetaGalBasalNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'enzyme-betagal-basal');
    group.setAttribute('class', 'auto-enzyme');
    group.setAttribute('transform', 'translate(340, 174)');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', 'β-galactosidase basal');
    group.dataset.active = 'false';
    group.style.cursor = 'pointer';

    group.innerHTML = `
      <rect x="-44" y="-22" width="88" height="48" rx="12" fill="transparent" />
      <g class="betagal-visual">
        <circle cx="-11" cy="-2" r="11" fill="#4f46e5" fill-opacity="0.85" stroke="#a5b4fc" stroke-width="1.5" />
        <circle cx="11" cy="-2" r="11" fill="#4338ca" fill-opacity="0.85" stroke="#a5b4fc" stroke-width="1.5" />
        <text y="-2" text-anchor="middle" dominant-baseline="central" fill="#eef2ff" font-family="var(--font-mono)" font-size="9.5" font-weight="700">β-gal</text>
      </g>
      <text class="betagal-tag" y="20" text-anchor="middle" fill="#fde68a" font-family="var(--font-mono)" font-size="9" font-weight="600">Lactose → Alolactose</text>
    `;

    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openContextPopup('beta-gal-basal');
    });
    return group;
  }

  private createRibosomeTranslationNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'ribosome-group');
    group.setAttribute('class', 'auto-enzyme');
    group.setAttribute('transform', 'translate(765, 384)');
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', 'Ribossomos traduzindo β-galactosidase');
    group.style.cursor = 'pointer';

    group.innerHTML = `
      <rect x="-35" y="-56" width="350" height="78" rx="14" fill="transparent" />

      <!-- Ribossomos montando-se sequencialmente sobre o mRNA e liberando β-galactosidase -->
      <g class="ribosome-unit-1">
        <ellipse cx="0" cy="-12" rx="20" ry="11" fill="#8b5cf6" fill-opacity="0.9" stroke="#ddd6fe" stroke-width="1.5" />
        <ellipse cx="0" cy="2" rx="15" ry="7.5" fill="#7c3aed" fill-opacity="0.92" stroke="#ddd6fe" stroke-width="1.3" />
        <g class="nascent-betagal" transform="translate(0, -28)">
          <circle cx="-5" cy="0" r="6.5" fill="#4f46e5" stroke="#a5b4fc" stroke-width="1.1" />
          <circle cx="5" cy="0" r="6.5" fill="#4338ca" stroke="#a5b4fc" stroke-width="1.1" />
        </g>
      </g>

      <g class="ribosome-unit-2">
        <ellipse cx="0" cy="-12" rx="20" ry="11" fill="#8b5cf6" fill-opacity="0.9" stroke="#ddd6fe" stroke-width="1.5" />
        <ellipse cx="0" cy="2" rx="15" ry="7.5" fill="#7c3aed" fill-opacity="0.92" stroke="#ddd6fe" stroke-width="1.3" />
        <g class="nascent-betagal" transform="translate(0, -28)">
          <circle cx="-5" cy="0" r="6.5" fill="#4f46e5" stroke="#a5b4fc" stroke-width="1.1" />
          <circle cx="5" cy="0" r="6.5" fill="#4338ca" stroke="#a5b4fc" stroke-width="1.1" />
        </g>
      </g>

      <!-- β-galactosidase gerada: Lactose entra de um lado e sai Glicose do outro -->
      <g class="ribosome-product" transform="translate(238, -28)">
        <g class="cleavage-stream">
          <polygon points="-58,-7 -49,0 -58,7 -67,0" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="1" />
          <polygon points="-46,-5 -39,0 -46,5 -53,0" fill="var(--small-molecule)" fill-opacity="0.82" stroke="#fef3c7" stroke-width="0.9" />
          <text x="-31" y="3" fill="#fde68a" font-family="var(--font-mono)" font-size="11">→</text>
        </g>

        <circle cx="-7" cy="0" r="12" fill="#4f46e5" stroke="#a5b4fc" stroke-width="1.4" />
        <circle cx="7" cy="0" r="12" fill="#4338ca" stroke="#a5b4fc" stroke-width="1.4" />
        <text y="0" text-anchor="middle" dominant-baseline="central" fill="#eef2ff" font-family="var(--font-mono)" font-size="8.5" font-weight="700">β-gal</text>

        <g class="cleavage-stream">
          <text x="24" y="3" fill="#7dd3fc" font-family="var(--font-mono)" font-size="11">→</text>
          <polygon points="48,-9 56,-4 56,4 48,9 40,4 40,-4" fill="var(--dna-backbone)" stroke="#e0f2fe" stroke-width="1.3" />
          <text x="48" y="21" text-anchor="middle" fill="#bae6fd" font-family="var(--font-mono)" font-size="9" font-weight="700">Glicose</text>
        </g>
      </g>
    `;

    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openContextPopup('ribosome');
    });
    return group;
  }

  private createChannelNode(opts: {
    id: string;
    x: number;
    y: number;
    angle: number;
    label: string;
    accent: string;
    onInspect: () => void;
    onClose: () => void;
  }): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', opts.id);
    group.setAttribute('class', 'membrane-channel');
    group.setAttribute('transform', `translate(${opts.x}, ${opts.y}) rotate(${opts.angle})`);
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', opts.label);
    group.dataset.open = 'false';
    group.dataset.interacted = 'false';

    group.innerHTML = `
      <rect x="-72" y="-34" width="144" height="76" rx="14" fill="transparent" cursor="pointer" />
      <rect class="channel-pore" x="-16" y="-22" width="32" height="44" rx="6" fill="${opts.accent}" fill-opacity="0" />
      <rect class="channel-body channel-body--left" x="-48" y="-24" width="38" height="48" rx="10" fill="#1e293b" stroke="${opts.accent}" stroke-width="2.4" />
      <rect class="channel-body channel-body--right" x="10" y="-24" width="38" height="48" rx="10" fill="#1e293b" stroke="${opts.accent}" stroke-width="2.4" />
      <line class="channel-gate" x1="-10" y1="0" x2="10" y2="0" stroke="${opts.accent}" stroke-width="5" stroke-linecap="round" />
      <g class="channel-stream">
        <circle class="channel-particle" cx="-5" cy="-34" r="4.8" fill="${opts.accent}" />
        <circle class="channel-particle channel-particle--delayed" cx="5" cy="-42" r="4.2" fill="${opts.accent}" />
        <circle class="channel-particle channel-particle--late" cx="0" cy="-38" r="3.8" fill="${opts.accent}" />
      </g>
      <g class="channel-shutoff" transform="translate(56, -24)" role="button" tabindex="0" aria-label="Fechar ${opts.label}">
        <circle r="12" fill="#0f172a" stroke="#f43f5e" stroke-width="1.8" />
        <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#fda4af" stroke-width="2" stroke-linecap="round" />
      </g>
      <text class="channel-name-label" x="0" y="46" text-anchor="middle" fill="var(--text-primary)" font-family="var(--font-ui)" font-size="12.5" font-weight="600">
        ${opts.label}
      </text>
    `;

    const shutoffEl = group.querySelector('.channel-shutoff') as SVGGElement;
    shutoffEl.addEventListener('click', (event) => {
      event.stopPropagation();
      if (group.dataset.open === 'true') {
        opts.onClose();
      }
    });
    shutoffEl.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && group.dataset.open === 'true') {
        event.preventDefault();
        event.stopPropagation();
        opts.onClose();
      }
    });

    const trigger = () => {
      group.dataset.interacted = 'true';
      opts.onInspect();
    };

    group.addEventListener('click', (event) => {
      if (this.context?.interaction.getSelectedMoleculeId()) {
        return;
      }
      event.stopPropagation();
      trigger();
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        trigger();
      }
    });

    return group;
  }

  private createDnaZone(opts: {
    id: string;
    cx: number;
    cy: number;
    hitRadius: number;
    notchPath: string;
    stroke: string;
    label: string;
    labelY: number;
  }): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', opts.id);
    group.setAttribute('class', 'dna-drop-zone');

    const notch = document.createElementNS(SVG_NS, 'path');
    notch.setAttribute('d', opts.notchPath);
    notch.setAttribute('fill', 'rgba(15, 23, 42, 0.88)');
    notch.setAttribute('stroke', opts.stroke);
    notch.setAttribute('stroke-width', '4.5');
    notch.setAttribute('stroke-linejoin', 'round');

    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('class', 'drop-zone-hitarea');
    hit.setAttribute('cx', String(opts.cx));
    hit.setAttribute('cy', String(opts.cy));
    hit.setAttribute('r', String(opts.hitRadius));

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(opts.cx));
    label.setAttribute('y', String(opts.labelY));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', opts.stroke);
    label.setAttribute('font-family', 'var(--font-mono)');
    label.setAttribute('font-size', '13');
    label.setAttribute('font-weight', '600');
    label.textContent = opts.label;

    group.append(notch, label, hit);
    return group;
  }

  private createLaciNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-laci');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(570, 412)');
    group.style.cursor = 'pointer';

    const halo = this.createScanHalo('var(--repressor-color)', 46);

    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual');

    // Forma inicial ligada ao Operador: ombro estérico à esquerda bloqueia fisicamente a RNApol + sítio alostérico em losango
    this.laciPathEl = document.createElementNS(SVG_NS, 'path');
    this.laciPathEl.setAttribute(
      'd',
      'M -98 2 C -98 -38, 42 -42, 42 -22 L 42 -12 L 22 2 L 42 16 L 42 26 L 24 26 L 0 64 L -24 26 L -92 26 C -98 26, -98 14, -98 2 Z',
    );
    this.laciPathEl.setAttribute('fill', 'var(--repressor-color)');
    this.laciPathEl.setAttribute('stroke', '#fda4af');
    this.laciPathEl.setAttribute('stroke-width', '2.2');
    this.laciPathEl.setAttribute('stroke-linejoin', 'round');

    this.laciLigandEl = document.createElementNS(SVG_NS, 'g');
    this.laciLigandEl.setAttribute('transform', 'translate(36, 2)');
    this.laciLigandEl.setAttribute('opacity', '0');
    this.laciLigandEl.innerHTML = `
      <polygon points="0,-14 15,0 0,14 -15,0" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="1.5" />
    `;

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('y', '-4');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('fill', '#fff1f2');
    label.setAttribute('font-family', 'var(--font-mono)');
    label.setAttribute('font-size', '14');
    label.setAttribute('font-weight', '700');
    label.textContent = 'LacI';

    const hit = document.createElementNS(SVG_NS, 'circle');
    hit.setAttribute('class', 'drop-zone-hitarea');
    hit.setAttribute('r', '56');

    body.append(this.laciPathEl, this.laciLigandEl, label);
    group.append(halo, body, hit);

    // Clique para Scan quando ainda não foi escaneado (sem atrapalhar o dropZone quando já selecionado)
    group.addEventListener('click', (event) => {
      if (!this.engine || !this.context) return;
      const spec = this.engine.getMoleculeSpecs().find((m) => m.id === 'laci');
      if (spec && !spec.discovered && !this.context.interaction.getSelectedMoleculeId()) {
        event.stopPropagation();
        this.context.bus.emit('interaction:scan', { moleculeId: 'laci' });
      }
    });

    return group;
  }

  private createCapNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-cap');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(165, 225)');

    const halo = this.createScanHalo('var(--activator-color)', 42);
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual brownian');
    body.style.setProperty('--brownian-duration', '5.8s');

    // Conformação fechada (não encaixa no Sítio CAP)
    body.innerHTML = `
      <path d="M -34 -18 C -34 -34, 34 -34, 34 -18 L 30 18 C 16 26, -16 26, -30 18 Z"
            fill="var(--activator-color)" fill-opacity="0.82" stroke="#6ee7b7" stroke-width="2.2" />
      <text y="0" text-anchor="middle" dominant-baseline="central" fill="#022c22" font-family="var(--font-mono)" font-size="14" font-weight="700">CAP</text>
      <circle class="drop-zone-hitarea" r="52" />
    `;

    group.append(halo, body);
    return group;
  }

  private createCampNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-camp');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(990, 220)');

    const halo = this.createScanHalo('var(--small-molecule)', 34);
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual brownian');
    body.style.setProperty('--brownian-duration', '4.6s');
    body.style.setProperty('--brownian-delay', '-1.4s');

    body.innerHTML = `
      <circle r="24" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="2.2" />
      <circle r="16" fill="none" stroke="#92400e" stroke-opacity="0.45" stroke-width="1.5" stroke-dasharray="4 3" />
      <text y="0" text-anchor="middle" dominant-baseline="central" fill="#451a03" font-family="var(--font-mono)" font-size="11" font-weight="700">cAMP</text>
      <circle class="drop-zone-hitarea" r="48" />
    `;

    group.append(halo, body);
    return group;
  }

  private createCapCampNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-cap-camp');
    group.setAttribute('transform', 'translate(195, 230)');

    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual brownian');
    body.style.setProperty('--brownian-duration', '5.1s');

    // Conformação aberta com saliência semicircular inferior que encaixa em zone-cap
    body.innerHTML = `
      <path d="M -40 -26 C -32 -40, 32 -40, 40 -26 L 34 14 L 29 14 A 29 29 0 0 1 -29 14 L -34 14 Z"
            fill="var(--activator-color)" stroke="#a7f3d0" stroke-width="2.5" filter="url(#lac-soft-glow)" />
      <circle cx="-22" cy="-26" r="8" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="1.5" />
      <circle cx="22" cy="-26" r="8" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="1.5" />
      <text y="-2" text-anchor="middle" dominant-baseline="central" fill="#022c22" font-family="var(--font-mono)" font-size="11" font-weight="700">CAP-cAMP</text>
    `;

    group.append(body);
    return group;
  }

  private createAllolactoseNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-allolactose');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(340, 210)');

    const halo = this.createScanHalo('var(--small-molecule)', 36);
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual brownian');
    body.style.setProperty('--brownian-duration', '4.3s');

    body.innerHTML = `
      <polygon points="0,-24 26,0 0,24 -26,0" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="2.2" />
      <text y="0" text-anchor="middle" dominant-baseline="central" fill="#451a03" font-family="var(--font-mono)" font-size="9.5" font-weight="700">Alolactose</text>
    `;

    group.append(halo, body);
    return group;
  }

  private createRnapNode(): SVGGElement {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('id', 'mol-rnap');
    group.setAttribute('class', 'stage-molecule');
    group.setAttribute('transform', 'translate(415, 200)');

    const halo = this.createScanHalo('var(--enzyme-core)', 50);
    const body = document.createElementNS(SVG_NS, 'g');
    body.setAttribute('class', 'mol-visual brownian');
    body.style.setProperty('--brownian-duration', '6.4s');

    // Enzima com pé retangular inferior compatível com Promotor (P) e saída dorsal de mRNA nascente
    body.innerHTML = `
      <path class="rnap-nascent-mrna mrna-flow-strand" d="M -8 -34 Q -24 -64, -6 -92 T -18 -134"
            fill="none" stroke="var(--mrna-strand)" stroke-width="4.5" stroke-linecap="round" opacity="0" />
      <path d="M -50 -14 C -50 -42, 50 -42, 50 -14 L 46 16 L 34 16 L 34 42 L -34 42 L -34 16 L -46 16 Z"
            fill="var(--enzyme-core)" stroke="#a5b4fc" stroke-width="2.4" stroke-linejoin="round" />
      <text y="-8" text-anchor="middle" dominant-baseline="central" fill="#eef2ff" font-family="var(--font-mono)" font-size="13.5" font-weight="700">RNApol</text>
    `;

    group.append(halo, body);
    return group;
  }

  private createScanHalo(color: string, radius: number): SVGCircleElement {
    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('class', 'scan-glow');
    halo.setAttribute('r', String(radius));
    halo.setAttribute('fill', color);
    halo.setAttribute('fill-opacity', '0.12');
    halo.setAttribute('stroke', color);
    halo.setAttribute('stroke-opacity', '0.28');
    halo.setAttribute('stroke-width', '1.2');
    return halo;
  }

  private buildOverlays(): void {
    const app = document.getElementById('app');
    if (!app) return;

    this.overlayLayer = document.createElement('div');
    this.overlayLayer.className = 'level-overlay-layer';
    this.overlayLayer.innerHTML = `
      <div class="level-briefing-backdrop" data-open="true">
        <section class="level-briefing-card" role="dialog" aria-modal="true" aria-labelledby="briefing-title">
          <span class="level-briefing-card__eyebrow">${LAC_BRIEFING.eyebrow}</span>
          <h2 class="level-briefing-card__title" id="briefing-title">${LAC_BRIEFING.title}</h2>
          <div class="level-briefing-steps">
            <div class="level-briefing-step">
              <span class="level-briefing-step__num">1</span>
              <p class="level-briefing-step__text">${LAC_BRIEFING.context}</p>
            </div>
            <div class="level-briefing-step">
              <span class="level-briefing-step__num">2</span>
              <p class="level-briefing-step__text">${LAC_BRIEFING.mission}</p>
            </div>
          </div>
          <div class="level-briefing-card__actions">
            <button type="button" class="btn-primary" data-action="enter-cell">${LAC_BRIEFING.ctaLabel}</button>
          </div>
        </section>
      </div>

      <div class="orientation-hint" role="status">
        <span>Para melhor visualização, gire o celular na horizontal. Você também pode usar o zoom em pinça.</span>
        <button type="button" class="orientation-hint__close" aria-label="Fechar dica">&times;</button>
      </div>

      <div class="focus-popup-backdrop" data-open="false" hidden>
        <section class="focus-popup" role="dialog" aria-modal="true" aria-labelledby="focus-popup-title"></section>
      </div>
      <div class="feedback-toast" hidden data-visible="false" aria-live="polite"></div>
      <button type="button" class="exit-lock-cta" hidden>Avançar para Trava de Saída</button>

      <div class="mutation-backdrop" data-open="false" hidden>
        <section class="mutation-modal" role="dialog" aria-modal="true" aria-labelledby="mutation-title">
          <div class="mutation-modal__head">
            <span class="mutation-modal__badge">Trava de Saída · Nível 1</span>
            <h2 class="mutation-modal__title" id="mutation-title">${LAC_EXIT_MUTATION.title}</h2>
            <p class="mutation-modal__scenario">${LAC_EXIT_MUTATION.scenario}</p>
            <p class="mutation-modal__question">${LAC_EXIT_MUTATION.question}</p>
          </div>
          <div class="mutation-options"></div>
          <div class="mutation-feedback" hidden></div>
          <div class="mutation-footer" hidden></div>
        </section>
      </div>
    `;

    this.briefingBackdropEl = this.overlayLayer.querySelector('.level-briefing-backdrop') as HTMLElement;
    const enterCellBtn = this.overlayLayer.querySelector('[data-action="enter-cell"]') as HTMLButtonElement;
    enterCellBtn.addEventListener('click', () => {
      this.briefingBackdropEl.dataset.open = 'false';
      this.briefingBackdropEl.hidden = true;
    });

    const orientationHintEl = this.overlayLayer.querySelector('.orientation-hint') as HTMLElement;
    const orientationCloseBtn = this.overlayLayer.querySelector('.orientation-hint__close') as HTMLButtonElement;
    orientationCloseBtn.addEventListener('click', () => {
      orientationHintEl.hidden = true;
    });

    this.focusPopupBackdropEl = this.overlayLayer.querySelector('.focus-popup-backdrop') as HTMLElement;
    this.focusPopupCardEl = this.overlayLayer.querySelector('.focus-popup') as HTMLElement;
    this.focusPopupBackdropEl.addEventListener('click', (e) => {
      if (e.target === this.focusPopupBackdropEl) {
        this.closeFocusPopup();
      }
    });
    this.feedbackToastEl = this.overlayLayer.querySelector('.feedback-toast') as HTMLElement;
    this.exitLockBtnEl = this.overlayLayer.querySelector('.exit-lock-cta') as HTMLButtonElement;
    this.mutationBackdropEl = this.overlayLayer.querySelector('.mutation-backdrop') as HTMLElement;
    this.mutationFeedbackEl = this.overlayLayer.querySelector('.mutation-feedback') as HTMLElement;
    this.mutationFooterEl = this.overlayLayer.querySelector('.mutation-footer') as HTMLElement;

    const optionsContainer = this.overlayLayer.querySelector('.mutation-options') as HTMLElement;
    for (const option of LAC_EXIT_MUTATION.options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mutation-option';
      btn.dataset.optionId = option.id;
      btn.innerHTML = `
        <span class="mutation-option__letter">${option.id}</span>
        <span class="mutation-option__text">${option.text}</span>
      `;
      btn.addEventListener('click', () => this.handleMutationAnswer(option.id));
      optionsContainer.appendChild(btn);
    }

    this.exitLockBtnEl.addEventListener('click', () => this.openMutationModal());

    app.appendChild(this.overlayLayer);
  }

  private bindEvents(): void {
    if (!this.context) return;

    this.unsubscribers.push(
      this.context.bus.on('interaction:scan', ({ moleculeId }) => {
        this.handleScan(moleculeId);
      }),
      this.context.bus.on('pool:inspect', ({ moleculeId }) => {
        if (!this.engine) return;
        const spec = this.engine.getMoleculeSpecs().find((m) => m.id === moleculeId);
        if (spec) {
          this.pendingFlySpec = null;
          this.showMoleculeFocusPopup(spec);
        }
      }),
      this.context.bus.on('interaction:apply', ({ moleculeId, targetZoneId }) => {
        this.handleApply(moleculeId, targetZoneId);
      }),
    );
  }

  private configurePoolCrafting(): void {
    this.context?.pool.setCraftingZoneResolver((moleculeId) => {
      if (moleculeId === 'cap') {
        return {
          zoneId: 'pool-craft-cap',
          accepts: (draggedId) => draggedId === 'camp',
        };
      }
      if (moleculeId === 'camp') {
        return {
          zoneId: 'pool-craft-camp',
          accepts: (draggedId) => draggedId === 'cap',
        };
      }
      return null;
    });
  }

  private handleScan(moleculeId: MoleculeId): void {
    if (!this.engine || !this.context) return;
    const result = this.engine.discoverMolecule(moleculeId);
    if (!result.spec) return;

    if (result.newlyDiscovered) {
      this.context.assessment.recordMoleculeDiscovered(LAC_LEVEL_ID, moleculeId);
      this.pendingFlySpec = result.spec;
    } else {
      this.pendingFlySpec = null;
    }

    this.renderState(result.state);
    this.syncPoolAndManual();
    this.showMoleculeFocusPopup(result.spec);
  }

  private handleToggleLactose(): void {
    if (!this.engine || !this.context) return;
    const result = this.engine.toggleLactoseChannel();
    if (!result.state.allolactoseAvailable && this.context.interaction.getSelectedMoleculeId() === 'allolactose') {
      this.context.interaction.clearSelection();
    }
    this.renderState(result.state);
    this.syncPoolAndManual();
    this.showFeedback(result.feedback);
  }

  private handleToggleGlucose(): void {
    if (!this.engine || !this.context) return;
    const result = this.engine.toggleGlucoseChannel();
    const selected = this.context.interaction.getSelectedMoleculeId();
    if (!result.state.campAvailable && (selected === 'camp' || selected === 'cap-camp')) {
      this.context.interaction.clearSelection();
    }
    this.renderState(result.state);
    this.syncPoolAndManual();
    this.showFeedback(result.feedback);
  }

  private handleApply(moleculeId: MoleculeId, targetZoneId: string): void {
    if (!this.engine || !this.context) return;

    const result = this.engine.applyMolecule(moleculeId, targetZoneId);
    if (result.recordInTelemetry) {
      const telemetry = this.context.assessment.recordAction(
        LAC_LEVEL_ID,
        result.feedback.valid,
        result.feedback.hintMoleculeId,
      );
      if (telemetry.shouldHighlightManual) {
        this.context.bus.emit('manual:hint', {
          moleculeId: result.feedback.hintMoleculeId,
          consecutiveErrors: telemetry.consecutiveErrors,
        });
      }
    }

    this.context.bus.emit('feedback:action', result.feedback);
    this.renderState(result.state);
    this.syncPoolAndManual();
    this.showFeedback(result.feedback);

    if (result.feedback.eventCode === 'BUMP_REPRESSOR') {
      this.triggerRnapBumpAnimation();
    } else if (result.feedback.eventCode === 'COMPLEX_FORMED') {
      this.triggerSnapAnimation(this.capCampEl);
    } else if (result.feedback.eventCode === 'CAP_CAMP_BOUND') {
      this.triggerSnapAnimation(this.capCampEl);
    }
  }

  private renderState(state: LacState): void {
    if (!this.context) return;

    // 1. Atualiza canais de membrana, enzimas automáticas e difusão citoplasmática
    this.updateChannelVisual(this.lactoseGateEl, state.lactoseOpen);
    this.updateChannelVisual(this.glucoseGateEl, state.glucoseOpen);
    this.lactoseDiffusionEl.style.display = state.lactoseOpen ? '' : 'none';
    this.glucoseDiffusionEl.style.display = state.glucoseOpen ? '' : 'none';

    this.adenylateCyclaseEl.dataset.active = state.glucoseOpen ? 'false' : 'true';
    const acTag = this.adenylateCyclaseEl.querySelector('.ac-status-tag');
    if (acTag) {
      acTag.textContent = state.glucoseOpen ? 'INIBIDA (Glicose)' : 'ATP → cAMP';
    }
    this.betaGalBasalEl.dataset.active = state.lactoseOpen ? 'true' : 'false';

    // 2. Atualiza LacI (mudança alostérica real de path + desprendimento)
    const laciDiscovered = state.discoveredIds.includes('laci');
    this.setHaloVisible(this.laciEl, !laciDiscovered);

    if (state.repressorBound) {
      this.laciEl.dataset.state = 'bound';
      this.laciEl.setAttribute('transform', 'translate(570, 412)');
      this.laciPathEl.setAttribute(
        'd',
        'M -98 2 C -98 -38, 42 -42, 42 -22 L 42 -12 L 22 2 L 42 16 L 42 26 L 24 26 L 0 64 L -24 26 L -92 26 C -98 26, -98 14, -98 2 Z',
      );
      this.laciLigandEl.setAttribute('opacity', '0');
      this.laciEl.querySelector('.mol-visual')?.classList.remove('brownian');
    } else {
      this.laciEl.dataset.state = 'detached';
      this.laciEl.setAttribute('transform', 'translate(610, 236)');
      // Perde a saliência triangular inferior ao mudar de conformação, mantendo o sítio alostérico em losango
      this.laciPathEl.setAttribute(
        'd',
        'M -46 -22 C -46 -42, 42 -42, 42 -22 L 42 -12 L 22 2 L 42 16 L 42 24 C 22 30, -24 30, -46 24 Z',
      );
      this.laciLigandEl.setAttribute('opacity', '1');
      this.laciEl.querySelector('.mol-visual')?.classList.add('brownian');
    }

    // 3. Atualiza CAP, cAMP, CAP-cAMP e Alolactose (visibilidade determinística)
    const showCapFree = !(state.capCampCrafted && state.campAvailable);
    this.capEl.style.display = showCapFree ? '' : 'none';
    this.setHaloVisible(this.capEl, !state.discoveredIds.includes('cap'));

    const showCampFree = state.campAvailable && !state.capCampCrafted;
    this.campEl.style.display = showCampFree ? '' : 'none';
    this.setHaloVisible(this.campEl, !state.discoveredIds.includes('camp'));

    const showCapCamp = state.capCampCrafted && state.campAvailable;
    this.capCampEl.style.display = showCapCamp ? '' : 'none';
    const capCampVisual = this.capCampEl.querySelector('.mol-visual');
    const isCapBound = state.capCampBound && showCapCamp;
    this.dnaGroupEl.dataset.capBent = isCapBound ? 'true' : 'false';
    this.capRnapBridgeEl.dataset.active = isCapBound ? 'true' : 'false';

    if (isCapBound) {
      this.capCampEl.setAttribute('transform', 'translate(245, 422) rotate(5)');
      capCampVisual?.classList.remove('brownian');
    } else {
      this.capCampEl.setAttribute('transform', 'translate(195, 230)');
      capCampVisual?.classList.add('brownian');
    }

    this.allolactoseEl.style.display = state.allolactoseAvailable ? '' : 'none';
    this.setHaloVisible(this.allolactoseEl, !state.discoveredIds.includes('allolactose'));

    // 4. Atualiza RNAP e mRNA policistrônico
    this.setHaloVisible(this.rnapEl, !state.discoveredIds.includes('rnap'));
    const rnapVisual = this.rnapEl.querySelector('.mol-visual');
    rnapVisual?.classList.remove('rnap-glide-basal', 'rnap-glide-high');

    if (state.rnapBound && !this.isBumpingRnap) {
      rnapVisual?.classList.remove('brownian');
      this.rnapEl.setAttribute('transform', 'translate(415, 432)');
      if (state.transcriptionRate === 'BASAL') {
        rnapVisual?.classList.add('rnap-glide-basal');
      } else if (state.transcriptionRate === 'HIGH') {
        rnapVisual?.classList.add('rnap-glide-high');
      }
    } else if (!this.isBumpingRnap) {
      this.rnapEl.setAttribute('transform', 'translate(415, 200)');
      rnapVisual?.classList.add('brownian');
    }

    this.mrnaGroupEl.dataset.transcription = state.transcriptionRate;
    this.ribosomeGroupEl.dataset.rate = state.transcriptionRate;
    const nascentMrna = this.rnapEl.querySelector('.rnap-nascent-mrna') as SVGPathElement | null;
    if (state.transcriptionRate === 'NONE') {
      this.mrnaGroupEl.style.opacity = '0';
      if (nascentMrna) nascentMrna.setAttribute('opacity', '0');
    } else if (state.transcriptionRate === 'BASAL') {
      this.mrnaGroupEl.style.opacity = '0.45';
      this.mrnaPathEl.style.animationDuration = '2.8s';
      if (nascentMrna) nascentMrna.setAttribute('opacity', '0.55');
    } else {
      this.mrnaGroupEl.style.opacity = '1';
      this.mrnaPathEl.style.animationDuration = '0.95s';
      if (nascentMrna) nascentMrna.setAttribute('opacity', '1');
    }

    // 5. Atualiza StatusHUD e botão da Trava de Saída
    const severity =
      state.transcriptionRate === 'HIGH'
        ? 'ok'
        : state.transcriptionRate === 'BASAL'
          ? 'warning'
          : 'danger';

    const statusText =
      state.transcriptionRate === 'HIGH'
        ? 'Transcrição Máxima — Crise Resolvida'
        : state.transcriptionRate === 'BASAL'
          ? 'Transcrição Basal Insuficiente'
          : 'Operon lac Reprimido — Crise Energética';

    this.context.hud.update({
      levelId: LAC_LEVEL_ID,
      levelLabel: 'Nível 1 · Operon lac',
      statusText,
      cellHealth: state.cellHealth,
      severity,
    });

    this.exitLockBtnEl.hidden = state.transcriptionRate !== 'HIGH';

    // 6. Re-registra draggables e dropZones de acordo com o estado atual
    this.syncStageInteractions(state);
  }

  private syncStageInteractions(state: LacState): void {
    if (!this.context) return;

    for (const cleanup of this.interactionCleanups) {
      cleanup();
    }
    this.interactionCleanups = [];

    const { interaction } = this.context;
    const discovered = new Set(state.discoveredIds);

    // Zonas no DNA e canais de membrana (ativação por contato)
    this.interactionCleanups.push(
      interaction.registerDropZone({
        id: 'channel-lactose',
        element: this.lactoseGateEl,
        x: 340,
        y: 102,
        hitRadius: 90,
        accepts: (id) => id === 'ext-lactose',
      }),
      interaction.registerDropZone({
        id: 'channel-glucose',
        element: this.glucoseGateEl,
        x: 860,
        y: 102,
        hitRadius: 90,
        accepts: (id) => id === 'ext-glucose',
      }),
      interaction.registerDropZone({
        id: 'zone-cap',
        element: this.zoneCapEl,
        x: 245,
        y: 445,
        hitRadius: 76,
        accepts: (id) => id === 'cap-camp' || id === 'cap' || id === 'camp',
      }),
      interaction.registerDropZone({
        id: 'zone-promoter',
        element: this.zonePromoterEl,
        x: 415,
        y: 445,
        hitRadius: 76,
        accepts: (id) => id === 'rnap',
      }),
      interaction.registerDropZone({
        id: 'zone-operator',
        element: this.zoneOperatorEl,
        x: 570,
        y: 445,
        hitRadius: 76,
        accepts: (id) => id === 'allolactose' || id === 'rnap',
      }),
      interaction.registerDropZone({
        id: 'target-laci',
        element: this.laciEl,
        x: state.repressorBound ? 570 : 610,
        y: state.repressorBound ? 412 : 236,
        hitRadius: 74,
        accepts: (id) => id === 'allolactose',
      }),
    );

    // Moléculas arrastáveis e alvos de crafting no palco
    this.interactionCleanups.push(
      interaction.registerDraggable({
        moleculeId: 'ext-lactose',
        element: this.extLactoseEl,
        source: 'stage',
        discovered: true,
        label: 'Lactose',
        role: 'small-molecule',
        origin: { x: 430, y: 34 },
      }),
      interaction.registerDraggable({
        moleculeId: 'ext-glucose',
        element: this.extGlucoseEl,
        source: 'stage',
        discovered: true,
        label: 'Glicose',
        role: 'small-molecule',
        origin: { x: 995, y: 36 },
      }),
      interaction.registerDraggable({
        moleculeId: 'rnap',
        element: this.rnapEl,
        source: 'stage',
        discovered: discovered.has('rnap'),
        label: 'RNApol',
        role: 'enzyme',
        origin: { x: 415, y: state.rnapBound ? 432 : 200 },
      }),
    );

    if (!(state.capCampCrafted && state.campAvailable)) {
      this.interactionCleanups.push(
        interaction.registerDraggable({
          moleculeId: 'cap',
          element: this.capEl,
          source: 'stage',
          discovered: discovered.has('cap'),
          label: 'CAP',
          role: 'activator',
          origin: { x: 165, y: 225 },
        }),
        interaction.registerDropZone({
          id: 'stage-craft-cap',
          element: this.capEl,
          x: 165,
          y: 225,
          hitRadius: 60,
          accepts: (id) => id === 'camp',
        }),
      );
    }

    if (state.campAvailable && !state.capCampCrafted) {
      this.interactionCleanups.push(
        interaction.registerDraggable({
          moleculeId: 'camp',
          element: this.campEl,
          source: 'stage',
          discovered: discovered.has('camp'),
          label: 'cAMP',
          role: 'small-molecule',
          origin: { x: 990, y: 220 },
        }),
        interaction.registerDropZone({
          id: 'stage-craft-camp',
          element: this.campEl,
          x: 990,
          y: 220,
          hitRadius: 56,
          accepts: (id) => id === 'cap',
        }),
      );
    }

    if (state.capCampCrafted && state.campAvailable) {
      this.interactionCleanups.push(
        interaction.registerDraggable({
          moleculeId: 'cap-camp',
          element: this.capCampEl,
          source: 'stage',
          discovered: true,
          label: 'CAP-cAMP',
          role: 'activator',
          origin: state.capCampBound ? { x: 245, y: 434 } : { x: 195, y: 230 },
        }),
      );
    }

    if (state.allolactoseAvailable) {
      this.interactionCleanups.push(
        interaction.registerDraggable({
          moleculeId: 'allolactose',
          element: this.allolactoseEl,
          source: 'stage',
          discovered: discovered.has('allolactose'),
          label: 'Alolactose',
          role: 'small-molecule',
          origin: { x: 340, y: 210 },
        }),
      );
    }
  }

  private syncPoolAndManual(): void {
    if (!this.engine || !this.context) return;
    const specs = this.engine.getMoleculeSpecs();
    this.context.bus.emit('pool:updated', {
      molecules: specs,
      selectedId: this.context.interaction.getSelectedMoleculeId(),
    });
  }

  private updateChannelVisual(channelEl: SVGGElement, open: boolean): void {
    channelEl.dataset.open = open ? 'true' : 'false';
  }

  private setHaloVisible(molEl: SVGGElement, visible: boolean): void {
    molEl.dataset.discovered = visible ? 'false' : 'true';
    const halo = molEl.querySelector('.scan-glow') as SVGCircleElement | null;
    if (halo) {
      halo.style.display = visible ? '' : 'none';
    }
  }

  private triggerRnapBumpAnimation(): void {
    if (this.bumpTimer !== null) {
      window.clearTimeout(this.bumpTimer);
    }
    this.isBumpingRnap = true;
    const visual = this.rnapEl.querySelector('.mol-visual');
    visual?.classList.remove('brownian', 'is-bumping');
    this.rnapEl.setAttribute('transform', 'translate(415, 430)');

    // Força reflow SVG para reiniciar a animação de colisão
    void this.rnapEl.getBoundingClientRect();
    visual?.classList.add('is-bumping');

    this.bumpTimer = window.setTimeout(() => {
      this.isBumpingRnap = false;
      visual?.classList.remove('is-bumping');
      if (this.engine) {
        this.renderState(this.engine.getState());
      }
    }, 520);
  }

  private triggerSnapAnimation(targetEl: SVGGElement): void {
    const visual = targetEl.querySelector('.mol-visual');
    if (!visual) return;
    visual.classList.remove('is-snapping');
    void targetEl.getBoundingClientRect();
    visual.classList.add('is-snapping');
    window.setTimeout(() => visual.classList.remove('is-snapping'), 460);
  }

  private showMoleculeFocusPopup(spec: MoleculeSpec): void {
    this.focusPopupCardEl.innerHTML = `
      <div class="focus-popup__head">
        <div class="focus-popup__thumb" aria-hidden="true">${this.getThumbnailSvg(spec.id)}</div>
        <div class="focus-popup__heading">
          <span class="scan-card__tag" data-role="${spec.role}">${spec.label}</span>
          <h3 class="focus-popup__title" id="focus-popup-title">${spec.fullName}</h3>
        </div>
        <button type="button" class="focus-popup__close" aria-label="Fechar janela">&times;</button>
      </div>
      <p class="focus-popup__body">${spec.summary}</p>
      <p class="focus-popup__detail">${spec.manualEntry}</p>
      <div class="focus-popup__footer">
        <button type="button" class="btn-primary focus-popup__ok">${
          this.pendingFlySpec ? 'Guardar no Pool Molecular' : 'Entendi'
        }</button>
      </div>
    `;

    this.openFocusPopupEl();
  }

  private openContextPopup(contextId: string): void {
    const info: StageContextInfo | undefined = LAC_STAGE_CONTEXT_INFO[contextId];
    if (!info || !this.engine) return;

    const state = this.engine.getState();
    const isOpenChannel =
      (contextId === 'channel-lactose' && state.lactoseOpen) ||
      (contextId === 'channel-glucose' && state.glucoseOpen);

    this.pendingFlySpec = null;
    this.focusPopupCardEl.innerHTML = `
      <div class="focus-popup__head">
        <div class="focus-popup__thumb" aria-hidden="true">${this.getThumbnailSvg(contextId)}</div>
        <div class="focus-popup__heading">
          <span class="scan-card__tag" data-role="${info.role}">${info.tag}</span>
          <h3 class="focus-popup__title" id="focus-popup-title">${info.title}</h3>
        </div>
        <button type="button" class="focus-popup__close" aria-label="Fechar janela">&times;</button>
      </div>
      <p class="focus-popup__body">${info.description}</p>
      <p class="focus-popup__detail">${info.hint}</p>
      <div class="focus-popup__footer">
        ${
          isOpenChannel
            ? `<button type="button" class="btn-ghost" data-action="close-channel">Fechar Canal</button>`
            : ''
        }
        <button type="button" class="btn-primary focus-popup__ok">Entendi</button>
      </div>
    `;

    const closeChannelBtn = this.focusPopupCardEl.querySelector('[data-action="close-channel"]') as HTMLButtonElement | null;
    if (closeChannelBtn) {
      closeChannelBtn.addEventListener('click', () => {
        if (contextId === 'channel-lactose') {
          this.handleToggleLactose();
        } else if (contextId === 'channel-glucose') {
          this.handleToggleGlucose();
        }
        this.closeFocusPopup();
      });
    }

    this.openFocusPopupEl();
  }

  private openFocusPopupEl(): void {
    this.focusPopupBackdropEl.hidden = false;
    this.focusPopupBackdropEl.dataset.open = 'true';

    const closeBtn = this.focusPopupCardEl.querySelector('.focus-popup__close') as HTMLButtonElement;
    const okBtn = this.focusPopupCardEl.querySelector('.focus-popup__ok') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.closeFocusPopup());
    okBtn.addEventListener('click', () => this.closeFocusPopup());
  }

  private closeFocusPopup(): void {
    const flySpec = this.pendingFlySpec;
    this.pendingFlySpec = null;
    this.focusPopupBackdropEl.dataset.open = 'false';
    this.focusPopupBackdropEl.hidden = true;

    if (flySpec) {
      this.animateCopyToPool(flySpec);
    }
  }

  private animateCopyToPool(spec: MoleculeSpec): void {
    const targetChip = document.querySelector(`.pool-chip[data-molecule-id="${spec.id}"]`) as HTMLElement | null;
    const endRect = targetChip?.getBoundingClientRect();
    const startX = window.innerWidth * 0.5;
    const startY = window.innerHeight * 0.48;
    const endX = endRect ? endRect.left + endRect.width / 2 : window.innerWidth * 0.5;
    const endY = endRect ? endRect.top + endRect.height / 2 : window.innerHeight - 44;

    const token = document.createElement('div');
    token.className = 'pool-fly-token';
    token.dataset.role = spec.role;
    token.textContent = spec.label;
    token.style.left = `${startX}px`;
    token.style.top = `${startY}px`;
    document.body.appendChild(token);

    requestAnimationFrame(() => {
      token.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.75)`;
      token.style.opacity = '0.2';
    });

    window.setTimeout(() => {
      token.remove();
      if (targetChip) {
        targetChip.classList.add('is-snapping');
        window.setTimeout(() => targetChip.classList.remove('is-snapping'), 420);
      }
    }, 520);
  }

  private getThumbnailSvg(id: string): string {
    switch (id) {
      case 'laci':
        return `<svg viewBox="-64 -48 118 116"><path d="M -56 2 C -56 -34, 38 -38, 38 -20 L 38 -11 L 20 2 L 38 15 L 38 22 L 20 22 L 0 54 L -20 22 L -52 22 Z" fill="var(--repressor-color)" stroke="#fda4af" stroke-width="3" /></svg>`;
      case 'rnap':
        return `<svg viewBox="-56 -46 112 96"><path d="M -46 -14 C -46 -38, 46 -38, 46 -14 L 42 14 L 30 14 L 30 38 L -30 38 L -30 14 L -42 14 Z" fill="var(--enzyme-core)" stroke="#a5b4fc" stroke-width="3" /></svg>`;
      case 'cap':
        return `<svg viewBox="-44 -40 88 80"><path d="M -32 -16 C -32 -30, 32 -30, 32 -16 L 28 16 C 14 24, -14 24, -28 16 Z" fill="var(--activator-color)" stroke="#6ee7b7" stroke-width="3" /></svg>`;
      case 'camp':
        return `<svg viewBox="-32 -32 64 64"><circle r="22" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="2.5" /><circle r="14" fill="none" stroke="#92400e" stroke-width="2" stroke-dasharray="4 3" /></svg>`;
      case 'cap-camp':
        return `<svg viewBox="-48 -44 96 80"><path d="M -36 -22 C -28 -36, 28 -36, 36 -22 L 30 12 L 25 12 A 25 25 0 0 1 -25 12 L -30 12 Z" fill="var(--activator-color)" stroke="#a7f3d0" stroke-width="3" /><circle cx="-18" cy="-22" r="7" fill="var(--small-molecule)" /><circle cx="18" cy="-22" r="7" fill="var(--small-molecule)" /></svg>`;
      case 'allolactose':
        return `<svg viewBox="-34 -34 68 68"><polygon points="0,-24 26,0 0,24 -26,0" fill="var(--small-molecule)" stroke="#fef3c7" stroke-width="2.5" /></svg>`;
      case 'adenylate-cyclase':
        return `<svg viewBox="-36 -32 72 64"><path d="M -22 -12 C -22 -24, 22 -24, 22 -12 L 26 14 C 26 24, -26 24, -26 14 Z" fill="#0f766e" stroke="#5eead4" stroke-width="2.5" /><text y="4" text-anchor="middle" fill="#ccfbf1" font-family="monospace" font-size="14" font-weight="700">AC</text></svg>`;
      case 'beta-gal-basal':
        return `<svg viewBox="-34 -24 68 48"><circle cx="-11" cy="0" r="14" fill="#4f46e5" stroke="#a5b4fc" stroke-width="2" /><circle cx="11" cy="0" r="14" fill="#4338ca" stroke="#a5b4fc" stroke-width="2" /></svg>`;
      case 'ribosome':
        return `<svg viewBox="-32 -28 64 56"><ellipse cx="0" cy="-6" rx="22" ry="12" fill="#8b5cf6" stroke="#ddd6fe" stroke-width="2" /><ellipse cx="0" cy="10" rx="16" ry="8" fill="#7c3aed" stroke="#ddd6fe" stroke-width="2" /></svg>`;
      case 'channel-lactose':
      case 'channel-glucose': {
        const accent = id === 'channel-lactose' ? 'var(--small-molecule)' : 'var(--dna-backbone)';
        return `<svg viewBox="-40 -32 80 64"><rect x="-32" y="-20" width="24" height="40" rx="7" fill="#1e293b" stroke="${accent}" stroke-width="2.5" /><rect x="8" y="-20" width="24" height="40" rx="7" fill="#1e293b" stroke="${accent}" stroke-width="2.5" /></svg>`;
      }
      default:
        return `<svg viewBox="-40 -26 80 52"><rect x="-32" y="-18" width="64" height="36" rx="8" fill="rgba(56, 189, 248, 0.22)" stroke="var(--dna-backbone)" stroke-width="2.5" /></svg>`;
    }
  }

  private showFeedback(feedback: ActionFeedback): void {
    if (this.feedbackTimer !== null) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    if (this.feedbackHideTimer !== null) {
      window.clearTimeout(this.feedbackHideTimer);
      this.feedbackHideTimer = null;
    }

    this.feedbackToastEl.innerHTML = `
      <span class="feedback-toast__text"></span>
      <button type="button" class="feedback-toast__close" aria-label="Fechar aviso">&times;</button>
    `;
    const textEl = this.feedbackToastEl.querySelector('.feedback-toast__text') as HTMLElement;
    const closeBtn = this.feedbackToastEl.querySelector('.feedback-toast__close') as HTMLButtonElement;
    textEl.textContent = feedback.message;

    const dismiss = () => {
      if (this.feedbackTimer !== null) {
        window.clearTimeout(this.feedbackTimer);
        this.feedbackTimer = null;
      }
      this.feedbackToastEl.dataset.visible = 'false';
      this.feedbackHideTimer = window.setTimeout(() => {
        this.feedbackToastEl.hidden = true;
      }, 280);
    };

    closeBtn.addEventListener('click', dismiss);

    this.feedbackToastEl.dataset.tone = feedback.valid ? 'ok' : 'error';
    this.feedbackToastEl.hidden = false;
    void this.feedbackToastEl.offsetWidth;
    this.feedbackToastEl.dataset.visible = 'true';

    this.feedbackTimer = window.setTimeout(dismiss, 7500);
  }

  private openMutationModal(): void {
    this.mutationBackdropEl.hidden = false;
    this.mutationBackdropEl.dataset.open = 'true';
  }

  private closeMutationModal(): void {
    this.mutationBackdropEl.dataset.open = 'false';
    this.mutationBackdropEl.hidden = true;
  }

  private handleMutationAnswer(optionId: 'A' | 'B' | 'C'): void {
    if (!this.context) return;
    const option = LAC_EXIT_MUTATION.options.find((o) => o.id === optionId);
    if (!option) return;

    const { nextLevelId } = this.context.assessment.recordMutationAttempt(
      LAC_LEVEL_ID,
      option.correct,
    );

    this.mutationFeedbackEl.hidden = false;
    this.mutationFeedbackEl.dataset.correct = option.correct ? 'true' : 'false';
    this.mutationFeedbackEl.textContent = option.feedback;

    const buttons = this.mutationBackdropEl.querySelectorAll<HTMLButtonElement>('.mutation-option');
    for (const btn of buttons) {
      if (btn.dataset.optionId === optionId) {
        btn.dataset.state = option.correct ? 'correct' : 'wrong';
      } else {
        delete btn.dataset.state;
      }
    }

    if (!option.correct) {
      this.mutationFooterEl.hidden = true;
      return;
    }

    const score = this.context.assessment.calculateLevelScore(LAC_LEVEL_ID);
    this.context.bus.emit('level:completed', {
      levelId: LAC_LEVEL_ID,
      nextLevelId,
    });

    this.mutationFooterEl.hidden = false;
    this.mutationFooterEl.innerHTML = `
      <div class="mutation-summary">
        <p class="mutation-summary__text">${LAC_EXIT_MUTATION.successSummary}</p>
        <p class="mutation-summary__score">Pontuação do Nível 1: <strong>${score.total} / 100 pts</strong></p>
      </div>
      <div class="mutation-summary__actions">
        <button type="button" class="btn-ghost" data-action="replay">Repetir Nível 1</button>
        <button type="button" class="btn-primary" data-action="close">Concluir Nível 1</button>
      </div>
    `;

    const replayBtn = this.mutationFooterEl.querySelector('[data-action="replay"]') as HTMLButtonElement;
    const closeBtn = this.mutationFooterEl.querySelector('[data-action="close"]') as HTMLButtonElement;

    replayBtn.addEventListener('click', () => this.reset());
    closeBtn.addEventListener('click', () => {
      this.closeMutationModal();
      this.showFeedback({
        valid: true,
        eventCode: 'LEVEL_COMPLETED',
        message: 'Nível 1 concluído! Nível 2 (Cromatina) desbloqueado para a próxima fase.',
      });
    });
  }
}
