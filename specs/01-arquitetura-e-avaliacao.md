# 01 — Arquitetura Técnica e Sistema de Avaliação

## 1. Stack Tecnológica
- **Core:** TypeScript (strict mode), HTML5, CSS3 (Grid/Flexbox + CSS Custom Properties).
- **Build Tool:** Vite (template `vanilla-ts`) para desenvolvimento rápido e build estático leve (fácil hospedagem gratuita no GitHub Pages, Vercel ou Netlify).
- **Zero Dependências Pesadas:** Não usar React, Vue, Phaser ou bibliotecas de física. O DOM + SVG nativo controlado por TypeScript garante controle total sobre animações CSS e código limpo para manutenção.
- **Armazenamento Local:** `localStorage` para persistir o progresso do aluno e a telemetria caso ele recarregue a página.

## 2. Estrutura de Pastas
```text
locus-zero/
├── index.html
├── specs/                        # Documentos de especificação
├── src/
│   ├── main.ts                   # Ponto de entrada e inicialização
│   ├── core/
│   │   ├── types.ts              # Interfaces globais (Molecule, LevelState, Telemetry)
│   │   ├── EventBus.ts           # Pub/Sub simples para desacoplar Engine da UI
│   │   ├── InteractionManager.ts # Drag & Drop (Pointer Events) + Modo Clique-Alvo
│   │   └── AssessmentEngine.ts   # Telemetria silenciosa, cálculo de nota e relatório
│   ├── levels/
│   │   ├── LevelInterface.ts     # Contrato base que todo nível deve implementar
│   │   ├── level1-lac/
│   │   │   ├── LacEngine.ts      # Lógica biológica pura (sem DOM)
│   │   │   ├── LacView.ts        # Renderização SVG e animações do Nível 1
│   │   │   └── lacData.ts        # Textos do Manual de Bancada e Mutação de Saída
│   │   └── ... (demais níveis seguem o mesmo padrão)
│   ├── ui/
│   │   ├── MolecularPool.ts      # Barra inferior de moléculas escaneadas
│   │   ├── BenchManual.ts        # Gaveta lateral "Just-in-Time"
│   │   ├── StatusHUD.ts          # Barra superior de saúde celular e progresso
│   │   └── ReportModal.ts        # Tela final com nota, diagnóstico e exportação
│   └── styles/
│       ├── tokens.css            # Paleta semântica e tipografia (ver spec 00)
│       ├── animations.css        # Movimento browniano, colisões e transições
│       └── layout.css            # Responsividade Desktop/Mobile
```
3. Regra de Ouro: Separação Biologia vs. Visual
Camada Engine (*Engine.ts): TypeScript 100% puro. Nunca importa document, window ou manipula classes CSS. Recebe ações biológicas (ex.: applyMolecule(moleculeId, targetZoneId)) e retorna um novo estado imutável + um evento semântico (ex.: STERIC_HINDRANCE, ALLOSTERIC_SHIFT, TRANSCRIPTION_ACTIVE).

Camada View (*View.ts): Escuta o novo estado emitido pela Engine e atualiza atributos data-state nos elementos SVG (ex.: repressorEl.dataset.state = 'detached'), delegando as transições visuais ao CSS.

4. Contratos Principais (src/core/types.ts)
```TypeScript
export type MoleculeId = string;
export type ZoneId = string;

export interface MoleculeSpec {
  id: MoleculeId;
  label: string;          // Curto: "LacI", "cAMP", "RNAP"
  fullName: string;       // Para o Manual: "Proteína Repressora LacI"
  role: 'activator' | 'repressor' | 'enzyme' | 'small-molecule' | 'epigenetic';
  summary: string;        // 2 linhas para o card de Scan
  manualEntry: string;    // Explicação técnica curta para o Manual
  discovered: boolean;
}

export interface ActionFeedback {
  valid: boolean;
  eventCode: string;      // Ex: 'BUMP_REPRESSOR', 'COMPLEX_FORMED'
  message: string;        // Feedback curto na tela
  hintMoleculeId?: MoleculeId; // Destaca ficha no Manual se houver erro repetido
}

export interface LevelTelemetry {
  levelId: string;
  startTime: number;
  endTime?: number;
  validActions: number;
  invalidActions: number;     // Tentativas de força bruta ou erro conceitual
  manualOpens: number;        // Consultas ao Manual de Bancada
  mutationAttempts: number;   // Tentativas na Trava de Saída (1 = acertou de primeira)
  completed: boolean;
}
```
5. Interação Responsiva (InteractionManager.ts)
Viewport Adaptativa: O palco SVG principal usa viewBox="0 0 1200 700" com preserveAspectRatio="xMidYMid meet", garantindo que o DNA e as moléculas escalem sem distorção em monitores, tablets ou celulares em modo paisagem/retrato. Em telas baixas (`max-height: 500px`), `StatusHUD` e `MolecularPool` se compactam em barras finas para evitar qualquer sobreposição com o DNA; em portrait estreito (`max-width: 600px`), o palco preserva legibilidade e exibe aviso discreto sugerindo rotação para paisagem sem bloquear o uso vertical.

Duplo Modo de Interação:

Drag & Drop: Implementado via Pointer Events (pointerdown, pointermove, pointerup) com setPointerCapture para funcionar perfeitamente com mouse e toque. Durante o arraste (`dragging`), as animações brownianas das peças devem ser pausadas (`animation-play-state: paused`) e todas as zonas de encaixe/alvo devem usar áreas de colisão generosas (`<circle>` transparente maior que o desenho visual) para evitar falhas no toque ou em alvos em movimento.

Acessibilidade / Mobile: Tocar uma molécula no Pool Molecular a deixa "selecionada" (borda brilhante); tocar em um sítio válido no DNA executa o encaixe sem precisar arrastar.

6. Avaliação Invisível (AssessmentEngine.ts)
Sem backend obrigatório: o app avalia o aluno localmente e gera um comprovante verificável para entrega no Moodle/Classroom.

Rubrica Automática (0 a 100 pontos por nível, média final 0 a 10)
Resolução da Crise Celular (50 pts): Concedidos ao estabilizar a célula no nível.

Precisão Experimental (20 pts): Começa em 20 pts; desconta 2 pts por cada tentativa inválida após as 2 primeiras (permite exploração inicial sem punição, mas penaliza força bruta). Mínimo: 4 pts.

Autonomia / Uso do Manual (10 pts): Abrir o Manual não é punido na 1ª vez por ficha (incentiva leitura). A partir de 4 aberturas repetidas no mesmo nível, desconta 2 pts por abertura. Mínimo: 4 pts.

Trava de Saída — Desafio de Mutação (20 pts):

Acerto de 1ª tentativa: 20 pts.

Acerto na 2ª tentativa: 12 pts.

3ª ou mais tentativas: 6 pts.

Entrega para o Professor (Comprovante de Conclusão)
Ao concluir os níveis, o aluno informa seu Nome Completo e Matrícula na tela final (ReportModal.ts). O app gera:

Resumo Visual: Nota final, tempo total e um diagnóstico por tema (ex.: "Ponto forte: Operon lac | Revisar: Remodelamento Cromatínico").

Botão "Exportar Comprovante" (Print/PDF via @media print): Gera um relatório limpo de 1 página contendo os dados do aluno, a tabela de telemetria por nível e um Código de Integridade (hash SHA-256 simples gerado via crypto.subtle combinando matrícula + pontuações + salt fixo) para evitar adulteração trivial da nota.
