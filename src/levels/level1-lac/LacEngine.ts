import type { ActionFeedback, MoleculeId, MoleculeSpec, ZoneId } from '../../core/types';
import { LAC_MOLECULE_CATALOG } from './lacData';

export type TranscriptionRate = 'NONE' | 'BASAL' | 'HIGH';

export interface LacState {
  glucoseOpen: boolean;
  lactoseOpen: boolean;
  repressorBound: boolean;       // Inicia true
  capCampBound: boolean;         // Inicia false
  rnapBound: boolean;            // Inicia false
  transcriptionRate: TranscriptionRate;
  campAvailable: boolean;        // !glucoseOpen
  allolactoseAvailable: boolean; // lactoseOpen
  capCampCrafted: boolean;       // false até crafting (e limpo se glicose entrar)
  cellHealth: number;            // 15 | 30 | 100
  discoveredIds: MoleculeId[];
}

export interface LacTransitionResult {
  state: LacState;
  feedback: ActionFeedback;
  recordInTelemetry: boolean;
}

const CAP_CRAFT_TARGETS = new Set<ZoneId>(['stage-craft-cap', 'pool-craft-cap', 'target-cap']);
const CAMP_CRAFT_TARGETS = new Set<ZoneId>(['stage-craft-camp', 'pool-craft-camp', 'target-camp']);
const LACI_TARGETS = new Set<ZoneId>(['zone-operator', 'target-laci']);

/**
 * Máquina de estados biológicos 100% pura do Nível 1 (Operon lac).
 * Nunca referencia document, window, HTMLElement, SVGElement ou CSS.
 */
export class LacEngine {
  private state: LacState;

  constructor(initialDiscoveredIds: readonly MoleculeId[] = []) {
    this.state = this.createInitialState(initialDiscoveredIds);
  }

  getState(): LacState {
    return {
      ...this.state,
      discoveredIds: [...this.state.discoveredIds],
    };
  }

  getMoleculeSpecs(): MoleculeSpec[] {
    const discoveredSet = new Set(this.state.discoveredIds);
    return LAC_MOLECULE_CATALOG.map((item) => {
      let available = true;
      if (item.id === 'laci') {
        available = false;
      } else if (item.id === 'allolactose') {
        available = this.state.allolactoseAvailable;
      } else if (item.id === 'camp') {
        available = this.state.campAvailable;
      } else if (item.id === 'cap-camp') {
        available = this.state.capCampCrafted && this.state.campAvailable;
      }

      return {
        ...item,
        discovered: discoveredSet.has(item.id),
        available,
      };
    });
  }

  discoverMolecule(moleculeId: MoleculeId): {
    state: LacState;
    newlyDiscovered: boolean;
    spec?: MoleculeSpec;
  } {
    const known = LAC_MOLECULE_CATALOG.some((item) => item.id === moleculeId);
    if (!known) {
      return { state: this.getState(), newlyDiscovered: false };
    }

    const already = this.state.discoveredIds.includes(moleculeId);
    if (!already) {
      this.state = {
        ...this.state,
        discoveredIds: [...this.state.discoveredIds, moleculeId],
      };
    }

    const spec = this.getMoleculeSpecs().find((item) => item.id === moleculeId);
    return {
      state: this.getState(),
      newlyDiscovered: !already,
      spec,
    };
  }

  toggleLactoseChannel(): LacTransitionResult {
    if (!this.state.lactoseOpen) {
      this.state = {
        ...this.state,
        lactoseOpen: true,
        allolactoseAvailable: true,
      };
      return {
        state: this.getState(),
        recordInTelemetry: false,
        feedback: {
          valid: true,
          eventCode: 'LACTOSE_INFLUX',
          message:
            'Canal de Lactose aberto! A β-galactosidase basal converte parte da lactose em Alolactose no citoplasma.',
        },
      };
    }

    // Fechar o canal cessa o suprimento de indutor e permite que LacI volte ao Operador
    const nextRepressorBound = true;
    const nextRnapBound = false;
    const derived = this.computeTranscriptionAndHealth(
      nextRepressorBound,
      this.state.capCampBound,
      nextRnapBound,
    );

    this.state = {
      ...this.state,
      lactoseOpen: false,
      allolactoseAvailable: false,
      repressorBound: nextRepressorBound,
      rnapBound: nextRnapBound,
      ...derived,
    };

    return {
      state: this.getState(),
      recordInTelemetry: false,
      feedback: {
        valid: true,
        eventCode: 'LACTOSE_CLOSED',
        message:
          'Canal de Lactose fechado. Sem alolactose, o repressor LacI retoma sua forma ativa e volta a bloquear o Operador.',
      },
    };
  }

  toggleGlucoseChannel(): LacTransitionResult {
    if (!this.state.glucoseOpen) {
      const nextCapCampBound = false;
      const derived = this.computeTranscriptionAndHealth(
        this.state.repressorBound,
        nextCapCampBound,
        this.state.rnapBound,
      );

      this.state = {
        ...this.state,
        glucoseOpen: true,
        campAvailable: false,
        capCampCrafted: false,
        capCampBound: nextCapCampBound,
        ...derived,
      };

      return {
        state: this.getState(),
        recordInTelemetry: false,
        feedback: {
          valid: true,
          eventCode: 'GLUCOSE_DROP',
          message:
            'A glicose inibiu a adenilato ciclase, reduzindo o cAMP! A célula prioriza glicose e desativa o complexo CAP.',
        },
      };
    }

    this.state = {
      ...this.state,
      glucoseOpen: false,
      campAvailable: true,
    };

    return {
      state: this.getState(),
      recordInTelemetry: false,
      feedback: {
        valid: true,
        eventCode: 'GLUCOSE_CLOSED',
        message:
          'Canal de Glicose fechado. A adenilato ciclase volta a produzir cAMP no citoplasma.',
      },
    };
  }

  applyMolecule(moleculeId: MoleculeId, targetZoneId: ZoneId): LacTransitionResult {
    // 0. Ativação de canais por contato com molécula externa
    if (moleculeId === 'ext-lactose' && targetZoneId === 'channel-lactose') {
      if (this.state.lactoseOpen) {
        return {
          state: this.getState(),
          recordInTelemetry: false,
          feedback: {
            valid: true,
            eventCode: 'LACTOSE_ALREADY_OPEN',
            message: 'O Canal de Lactose já está aberto e a β-galactosidase basal continua gerando Alolactose.',
          },
        };
      }
      return this.toggleLactoseChannel();
    }

    if (moleculeId === 'ext-glucose' && targetZoneId === 'channel-glucose') {
      if (this.state.glucoseOpen) {
        return {
          state: this.getState(),
          recordInTelemetry: false,
          feedback: {
            valid: true,
            eventCode: 'GLUCOSE_ALREADY_OPEN',
            message: 'O Canal de Glicose já está ativo, mantendo a adenilato ciclase inibida.',
          },
        };
      }
      return this.toggleGlucoseChannel();
    }

    // 1. Crafting simétrico cAMP <-> CAP (no palco ou no Pool Molecular)
    const isCampOnCap = moleculeId === 'camp' && CAP_CRAFT_TARGETS.has(targetZoneId);
    const isCapOnCamp = moleculeId === 'cap' && CAMP_CRAFT_TARGETS.has(targetZoneId);

    if (isCampOnCap || isCapOnCamp) {
      if (this.state.glucoseOpen || !this.state.campAvailable) {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: false,
            eventCode: 'LOW_CAMP',
            hintMoleculeId: 'camp',
            message:
              'Concentração insuficiente de cAMP: feche o Canal de Glicose para reativar a adenilato ciclase.',
          },
        };
      }

      if (this.state.capCampCrafted) {
        return {
          state: this.getState(),
          recordInTelemetry: false,
          feedback: {
            valid: true,
            eventCode: 'COMPLEX_ALREADY_FORMED',
            message: 'O complexo CAP-cAMP já está montado e pronto para encaixar no Sítio CAP.',
          },
        };
      }

      const discoveredIds = this.state.discoveredIds.includes('cap-camp')
        ? this.state.discoveredIds
        : [...this.state.discoveredIds, 'cap-camp'];

      this.state = {
        ...this.state,
        capCampCrafted: true,
        discoveredIds,
      };

      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: true,
          eventCode: 'COMPLEX_FORMED',
          message:
            'Complexo CAP-cAMP ativado! Agora ele possui afinidade pelo sítio CAP no DNA.',
        },
      };
    }

    // 2. Mudança alostérica: Alolactose sobre LacI / Operador
    if (moleculeId === 'allolactose' && LACI_TARGETS.has(targetZoneId)) {
      if (!this.state.allolactoseAvailable) {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: false,
            eventCode: 'NO_ALLOLACTOSE',
            hintMoleculeId: 'allolactose',
            message: 'Abra o Canal de Lactose para gerar Alolactose no citoplasma.',
          },
        };
      }

      if (!this.state.repressorBound) {
        return {
          state: this.getState(),
          recordInTelemetry: false,
          feedback: {
            valid: true,
            eventCode: 'REPRESSOR_ALREADY_DETACHED',
            message: 'O repressor LacI já se soltou do Operador.',
          },
        };
      }

      const nextRepressorBound = false;
      const derived = this.computeTranscriptionAndHealth(
        nextRepressorBound,
        this.state.capCampBound,
        this.state.rnapBound,
      );

      this.state = {
        ...this.state,
        repressorBound: nextRepressorBound,
        ...derived,
      };

      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: true,
          eventCode: 'ALLOSTERIC_SHIFT',
          message:
            'Alosteria! A alolactose mudou a conformação do LacI, liberando o Operador.',
        },
      };
    }

    // 3. Ligação do complexo ativo CAP-cAMP no Sítio CAP
    if (moleculeId === 'cap-camp' && targetZoneId === 'zone-cap') {
      if (this.state.glucoseOpen || !this.state.campAvailable || !this.state.capCampCrafted) {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: false,
            eventCode: 'LOW_CAMP',
            hintMoleculeId: 'camp',
            message:
              'Sem cAMP disponível, o complexo CAP-cAMP se desfaz. Feche o Canal de Glicose e refaça o complexo.',
          },
        };
      }

      if (this.state.capCampBound) {
        return {
          state: this.getState(),
          recordInTelemetry: false,
          feedback: {
            valid: true,
            eventCode: 'CAP_ALREADY_BOUND',
            message: 'O complexo CAP-cAMP já está encaixado no Sítio CAP.',
          },
        };
      }

      const nextCapCampBound = true;
      const derived = this.computeTranscriptionAndHealth(
        this.state.repressorBound,
        nextCapCampBound,
        this.state.rnapBound,
      );

      this.state = {
        ...this.state,
        capCampBound: nextCapCampBound,
        ...derived,
      };

      if (derived.transcriptionRate === 'HIGH') {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: true,
            eventCode: 'TRANSCRIPTION_HIGH',
            message:
              'Transcrição máxima (100%)! CAP-cAMP estabilizou a RNApol nos genes lacZ, lacY e lacA.',
          },
        };
      }

      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: true,
          eventCode: 'CAP_CAMP_BOUND',
          message:
            'CAP-cAMP encaixado no Sítio CAP! O Promotor agora recruta a RNApol com alta eficiência.',
        },
      };
    }

    // 4. Recrutamento da RNAP no Promotor
    if (moleculeId === 'rnap' && targetZoneId === 'zone-promoter') {
      if (this.state.repressorBound) {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: false,
            eventCode: 'BUMP_REPRESSOR',
            hintMoleculeId: 'laci',
            message:
              'Bloqueio físico! O repressor LacI impede a passagem da RNA Polimerase.',
          },
        };
      }

      const nextRnapBound = true;
      const derived = this.computeTranscriptionAndHealth(
        this.state.repressorBound,
        this.state.capCampBound,
        nextRnapBound,
      );

      this.state = {
        ...this.state,
        rnapBound: nextRnapBound,
        ...derived,
      };

      if (derived.transcriptionRate === 'HIGH') {
        return {
          state: this.getState(),
          recordInTelemetry: true,
          feedback: {
            valid: true,
            eventCode: 'TRANSCRIPTION_HIGH',
            message:
              'Transcrição máxima (100%)! Síntese acelerada de mRNA policistrônico (lacZ, lacY, lacA).',
          },
        };
      }

      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: true,
          eventCode: 'TRANSCRIPTION_BASAL',
          hintMoleculeId: 'cap',
          message:
            'Transcrição basal (muito baixa). Sem glicose, a célula precisa de um ativador para recrutar a RNApol com eficiência.',
        },
      };
    }

    // 5. Rejeições didáticas específicas
    if (moleculeId === 'cap' && targetZoneId === 'zone-cap') {
      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: false,
          eventCode: 'CAP_INACTIVE',
          hintMoleculeId: 'camp',
          message:
            'A proteína CAP sozinha tem formato fechado e não encaixa no DNA. Combine-a com cAMP primeiro.',
        },
      };
    }

    if (moleculeId === 'camp' && targetZoneId === 'zone-cap') {
      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: false,
          eventCode: 'CAMP_NEEDS_CAP',
          hintMoleculeId: 'cap',
          message:
            'O cAMP não se liga diretamente ao DNA. Arraste-o sobre a proteína CAP para formar o ativador.',
        },
      };
    }

    if (moleculeId === 'rnap' && targetZoneId === 'zone-operator') {
      return {
        state: this.getState(),
        recordInTelemetry: true,
        feedback: {
          valid: false,
          eventCode: 'WRONG_SITE_RNAP',
          hintMoleculeId: 'rnap',
          message: 'A RNA Polimerase reconhece o Promotor (P), não diretamente o Operador (O).',
        },
      };
    }

    return {
      state: this.getState(),
      recordInTelemetry: true,
      feedback: {
        valid: false,
        eventCode: 'WRONG_TARGET',
        hintMoleculeId: moleculeId,
        message: 'Encaixe incompatível: observe a geometria do sítio e a função molecular.',
      },
    };
  }

  reset(preserveDiscovered = false): LacState {
    const preserved = preserveDiscovered ? this.state.discoveredIds : [];
    this.state = this.createInitialState(preserved);
    return this.getState();
  }

  private createInitialState(initialDiscoveredIds: readonly MoleculeId[]): LacState {
    const validCatalogIds = new Set(LAC_MOLECULE_CATALOG.map((item) => item.id));
    const discoveredIds = [...new Set(initialDiscoveredIds)].filter((id) =>
      validCatalogIds.has(id),
    );

    return {
      glucoseOpen: false,
      lactoseOpen: false,
      repressorBound: true,
      capCampBound: false,
      rnapBound: false,
      transcriptionRate: 'NONE',
      campAvailable: true,
      allolactoseAvailable: false,
      capCampCrafted: false,
      cellHealth: 15,
      discoveredIds,
    };
  }

  private computeTranscriptionAndHealth(
    repressorBound: boolean,
    capCampBound: boolean,
    rnapBound: boolean,
  ): { transcriptionRate: TranscriptionRate; cellHealth: number } {
    if (repressorBound || !rnapBound) {
      return { transcriptionRate: 'NONE', cellHealth: 15 };
    }
    if (capCampBound) {
      return { transcriptionRate: 'HIGH', cellHealth: 100 };
    }
    return { transcriptionRate: 'BASAL', cellHealth: 30 };
  }
}
