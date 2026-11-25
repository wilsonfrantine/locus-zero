import type { MoleculeSpec } from '../../core/types';

export const LAC_LEVEL_ID = 'level1-lac';

export interface LevelBriefing {
  eyebrow: string;
  title: string;
  context: string;
  mission: string;
  ctaLabel: string;
}

export const LAC_BRIEFING: LevelBriefing = {
  eyebrow: 'Nível 1 · Operon lac',
  title: 'Crise Metabólica em Escherichia coli',
  context:
    'Esta bactéria Escherichia coli vive no intestino humano. Após a ingestão de leite, o ambiente externo ficou carregado de lactose, enquanto a glicose — seu substrato preferencial — tornou-se escassa.',
  mission:
    'Sua missão é explorar o interior da célula, descobrir como os componentes interagem e ativar o operon lac para produzir enzimas capazes de metabolizar a lactose.',
  ctaLabel: 'Entrar na Célula',
};

export interface MutationOption {
  id: 'A' | 'B' | 'C';
  text: string;
  correct: boolean;
  feedback: string;
}

export interface ExitMutationChallenge {
  title: string;
  scenario: string;
  question: string;
  options: readonly MutationOption[];
  successSummary: string;
}

export const LAC_MOLECULE_CATALOG: ReadonlyArray<Omit<MoleculeSpec, 'discovered' | 'available'>> = [
  {
    id: 'laci',
    label: 'LacI',
    fullName: 'Proteína Repressora LacI',
    role: 'repressor',
    summary: 'Ocupa o Operador (O) na ausência de lactose e bloqueia fisicamente a passagem da RNA Polimerase.',
    manualEntry:
      'LacI (Repressor): Proteína reguladora que se liga ao Operador na ausência de lactose, bloqueando fisicamente a RNA Polimerase (controle negativo).',
  },
  {
    id: 'rnap',
    label: 'RNApol',
    fullName: 'RNA Polimerase Bacteriana (RNApol)',
    role: 'enzyme',
    summary: 'Reconhece o Promotor (P) e transcreve os genes lacZ, lacY e lacA em um mRNA policistrônico.',
    manualEntry:
      'RNA Polimerase (RNApol): Enzima responsável por transcrever os genes lacZ, lacY e lacA em um único mRNA policistrônico.',
  },
  {
    id: 'allolactose',
    label: 'Alolactose',
    fullName: 'Alolactose (Indutor Alostérico)',
    role: 'small-molecule',
    summary: 'Isômero da lactose gerado por β-galactosidase basal. Liga-se ao LacI e o desprende do Operador.',
    manualEntry:
      'Alolactose: Isômero da lactose gerado no citoplasma pela atividade basal residual de β-galactosidase quando a lactose entra na célula. Atua como indutor: liga-se ao repressor LacI e altera sua forma tridimensional (alosteria), fazendo-o soltar do DNA.',
  },
  {
    id: 'cap',
    label: 'CAP',
    fullName: 'Proteína Ativadora de Catabólitos (CAP)',
    role: 'activator',
    summary: 'Ativador transcricional. Sozinha apresenta conformação fechada e não se encaixa no sítio CAP.',
    manualEntry:
      'CAP + cAMP: Controle positivo. Na ausência de glicose, a adenilato ciclase permanece ativa, mantendo altos níveis de cAMP que ativam a proteína CAP. Quando há glicose, ela inibe a adenilato ciclase e reduz o cAMP. O complexo CAP-cAMP dobra o DNA e aumenta drasticamente a afinidade da RNA Polimerase pelo promotor.',
  },
  {
    id: 'camp',
    label: 'cAMP',
    fullName: 'AMP Cíclico (cAMP)',
    role: 'small-molecule',
    summary: 'Sinalizador de escassez de glicose produzido pela adenilato ciclase. Ativa a proteína CAP.',
    manualEntry:
      'CAP + cAMP: Sinalizador intracelular acumulado quando não há glicose disponível. Ao se ligar à proteína CAP (crafting cAMP + CAP), induz a conformação ativa capaz de recrutar a RNA Polimerase.',
  },
  {
    id: 'cap-camp',
    label: 'CAP-cAMP',
    fullName: 'Complexo Ativo CAP-cAMP',
    role: 'activator',
    summary: 'Complexo semicircular aberto. Encaixa no sítio CAP e estabiliza a RNApol para transcrição máxima.',
    manualEntry:
      'Complexo CAP-cAMP: Forma ativa da proteína CAP ligada ao cAMP. Encaixa-se no sítio CAP a montante do promotor e aumenta drasticamente o recrutamento da RNApol, elevando a transcrição de basal para máxima.',
  },
];

export interface StageContextInfo {
  id: string;
  tag: string;
  role: 'enzyme' | 'small-molecule' | 'activator' | 'repressor';
  title: string;
  description: string;
  hint: string;
}

export const LAC_STAGE_CONTEXT_INFO: Record<string, StageContextInfo> = {
  'channel-lactose': {
    id: 'channel-lactose',
    tag: 'Permease',
    role: 'small-molecule',
    title: 'Canal de Lactose (LacY / Permease)',
    description:
      'Transportador de membrana responsável pela entrada de lactose do meio extracelular para o citoplasma.',
    hint: 'Para ativar o transporte, arraste uma molécula de Lactose externa até este canal.',
  },
  'channel-glucose': {
    id: 'channel-glucose',
    tag: 'PTS',
    role: 'activator',
    title: 'Transportador de Glicose',
    description:
      'Quando há glicose externa disponível, sua entrada acoplada inibe a enzima adenilato ciclase na membrana, derrubando os níveis de cAMP.',
    hint: 'Experimento de contraste: arraste a Glicose externa até este canal para observar a repressão catabólica.',
  },
  'adenylate-cyclase': {
    id: 'adenylate-cyclase',
    tag: 'Enzima',
    role: 'enzyme',
    title: 'Adenilato Ciclase',
    description:
      'Enzima associada à membrana que converte ATP em cAMP quando não há entrada de glicose. A entrada de glicose inibe sua atividade.',
    hint: 'Enquanto o canal de glicose estiver fechado, ela mantém o cAMP disponível para ativar CAP.',
  },
  'beta-gal-basal': {
    id: 'beta-gal-basal',
    tag: 'Enzima Basal',
    role: 'enzyme',
    title: 'β-galactosidase Basal',
    description:
      'Mesmo com o operon lac reprimido, existem poucas cópias residuais de β-galactosidase que convertem parte da lactose que entra em Alolactose.',
    hint: 'Após a entrada de lactose, esta enzima gera a Alolactose no citoplasma.',
  },
  ribosome: {
    id: 'ribosome',
    tag: 'Tradução',
    role: 'enzyme',
    title: 'Ribossomos Bacterianos',
    description:
      'Ao surgir mRNA policistrônico da transcrição, os ribossomos montam-se sequencialmente sobre a fita e traduzem novas enzimas β-galactosidase.',
    hint: 'A β-galactosidase gerada cliva a lactose que entra de um lado em glicose e galactose do outro.',
  },
  'gene-lacz': {
    id: 'gene-lacz',
    tag: 'Gene lacZ',
    role: 'enzyme',
    title: 'Gene lacZ → β-galactosidase',
    description:
      'Codifica a enzima β-galactosidase, que hidrolisa a lactose (dissacarídeo) em glicose e galactose, além de converter parte da lactose em alolactose.',
    hint: 'Sem lacZ funcional, a célula não consegue metabolizar a lactose nem produzir o indutor alolactose.',
  },
  'gene-lacy': {
    id: 'gene-lacy',
    tag: 'Gene lacY',
    role: 'small-molecule',
    title: 'Gene lacY → Lactose Permease',
    description:
      'Codifica a proteína de membrana Lactose Permease, o transportador responsável por importar lactose do meio extracelular para o citoplasma.',
    hint: 'Mutações em lacY impedem a entrada eficiente de lactose na bactéria.',
  },
  'gene-laca': {
    id: 'gene-laca',
    tag: 'Gene lacA',
    role: 'activator',
    title: 'Gene lacA → Tiogalactosídeo Transacetilase',
    description:
      'Codifica uma enzima acessória que transfere grupos acetil para β-galactosídeos não metabolizáveis, auxiliando na detoxificação celular.',
    hint: 'É transcrita no mesmo mRNA policistrônico junto com lacZ e lacY.',
  },
};

export const LAC_EXIT_MUTATION: ExitMutationChallenge = {
  title: 'Anomalia Detectada na Cepa Mutante #42',
  scenario:
    'Uma colônia de E. coli está produzindo β-galactosidase continuamente (expressão constitutiva), mesmo na ausência total de lactose no meio.',
  question: 'Qual mutação explica esse comportamento?',
  options: [
    {
      id: 'A',
      text: 'Mutação que impede a ligação do complexo CAP-cAMP ao DNA.',
      correct: false,
      feedback:
        'Incorreto. Sem ligação do complexo CAP-cAMP, o controle positivo falha e a transcrição cai para o nível basal mesmo na presença de lactose — nunca geraria expressão constitutiva elevada.',
    },
    {
      id: 'B',
      text: 'Mutação de perda de função no gene lacI, impedindo o repressor de se ligar ao Operador.',
      correct: true,
      feedback:
        'Diagnóstico confirmado! Sem LacI funcional ligado ao Operador, o bloqueio negativo desaparece e ocorre expressão constitutiva mesmo na ausência de lactose.',
    },
    {
      id: 'C',
      text: 'Mutação que destrói o Promotor do operon lac.',
      correct: false,
      feedback:
        'Incorreto. Destruir o Promotor impede o reconhecimento e o encaixe da RNA Polimerase, causando ausência de transcrição em qualquer condição.',
    },
  ],
  successSummary:
    'Expressão constitutiva diagnosticada com precisão. Telemetria do Nível 1 salva e Nível 2 (Cromatina) desbloqueado!',
};
