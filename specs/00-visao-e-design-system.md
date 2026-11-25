# 00 — Visão do Produto e Design System ("BioRender Vivo")

## 1. Visão Geral
Aplicação web educativa interativa em formato de *Escape Room Intracelular* para ensino e avaliação de **Controle de Expressão Gênica** (nível graduação em Genética Molecular). O aluno atua dentro da célula manipulando diretamente moléculas, enzimas e sinais ambientais para resolver crises celulares, aprendendo os mecanismos por experimentação visual direta, sem aulas expositivas prévias.

## 2. Princípios Visuais (Estética BioRender Minimalista)
- **Imersão Intracelular:** A viewport inteira representa o interior da célula (citoplasma bacteriano ou núcleo eucariótico). Evitar aparência de "dashboard corporativo" ou "quiz escolar".
- **100% Vetorial (SVG + CSS):** Todas as moléculas, fitas de DNA, receptores e organelas de fundo devem ser construídos em SVG limpo e geométrico. Não usar imagens rasterizadas (PNG/JPG) ou engines 3D (WebGL).
- **Geometria Funcional (Chave-Fechadura):** As formas devem comunicar a biologia sem depender de texto.
  - Sítios de ligação no DNA (Promotor, Operador, Enhancer) devem ter reentrâncias geométricas distintas.
  - Proteínas ligantes (Repressor, CAP, Fatores de Transcrição) devem ter saliências que encaixam visualmente nesses sítios.
  - Mudanças alostéricas devem alterar visivelmente a silhueta do SVG (via transição de `path` ou rotação/deformação de subunidades).
- **Profundidade em 3 Camadas:**
  1. *Fundo (z-index: 1):* Textura citoplasmática/nuclear orgânica muito sutil (granulação e filamentos discretos com baixa opacidade sobre gradiente suave, evitando "holofotes" ou bolhas de degradê chamativas).
  2. *Palco Molecular (z-index: 10):* Fita de DNA em dupla hélice vetorial minimalista (que se abre sutilmente nos sítios regulatórios e blocos gênicos), membrana celular em arco de borda a borda (`x=0` a `x=1200`, quando aplicável) e moléculas interativas com sombras sutis (`drop-shadow`).
  3. *HUD Minimalista (z-index: 20):* Barra de status vital da célula no topo, botão discreto do "Manual de Bancada" e o *Pool Molecular* na base. Em telas baixas (`max-height: 500px`), o HUD e o Pool devem se compactar em barras finas para maximizar o palco SVG.
- **Briefing Narrativo Inicial & Feedback Discreto:**
  - Cada nível pode apresentar um card de briefing narrativo curto (1–2 passos) antes de liberar o palco (ex.: botão "Entrar na Célula"), substituindo caixas fixas grandes sobre o DNA.
  - Mensagens de feedback de ação (*toasts*) devem ser compactas (máx. 1–2 linhas), posicionadas de forma discreta sem cobrir o DNA ou canais, e desaparecer suavemente de forma automática.

## 3. Paleta de Cores Semântica (CSS Variables)
As cores têm significado biológico fixo em todos os níveis:

```css
:root {
  /* Ambiente */
  --bg-cytoplasm-start: #0f172a;   /* Azul profundo suave */
  --bg-cytoplasm-end: #1e293b;
  --bg-nucleus-start: #1a1625;     /* Roxo escuro suave para níveis eucarióticos */
  --bg-nucleus-end: #2d243b;

  /* Estruturas Genéticas */
  --dna-backbone: #38bdf8;         /* Azul-petróleo / Ciano */
  --dna-promoter: #0284c7;
  --dna-operator: #f59e0b;         /* Âmbar */
  --mrna-strand: #a78bfa;          /* Lilás */

  /* Moléculas Funcionais */
  --activator-color: #10b981;      /* Esmeralda (CAP, HATs, Enhancers) */
  --repressor-color: #f43f5e;      /* Coral/Vermelho (LacI, HDACs, Silencers) */
  --enzyme-core: #6366f1;          /* Índigo (RNA Polimerase, Spliceossomo) */
  --small-molecule: #fbbf24;       /* Dourado (Alolactose, cAMP, Acetil) */
  --epigenetic-mark: #c084fc;      /* Violeta (Metilação/Acetilação) */

  /* Feedback e HUD */
  --hud-glass: rgba(15, 23, 42, 0.72);
  --hud-border: rgba(255, 255, 255, 0.12);
  --text-primary: #f8fafc;
  --text-muted: #94a3b8;
  --status-ok: #22c55e;
  --status-danger: #ef4444;
}
```
4. Tipografia e Legibilidade
Fonte UI: Inter ou system-ui, sans-serif (limpa e neutra).

Fonte Dados/Genes: JetBrains Mono ou monospace para nomes de genes (lacZ, lacI), sequências e métricas celulares.

Regra de Texto na Tela: Rótulos dentro das moléculas devem ser curtos (ex.: LacI, RNAP, CAP). Explicações detalhadas ficam restritas ao tooltip de escaneamento e ao Manual de Bancada.

5. Movimento e Micro-interações (CSS)
Movimento Browniano: Moléculas livres no citoplasma/nucleoplasma devem ter animação contínua e leve (translate de ±6px e rotate de ±4deg em ciclos de 4s a 7s, ease-in-out infinite alternate).

Feedback Físico:

Encaixe válido: Snap magnético suave + pulso luminoso (box-shadow ou stroke brilhante).

Impedimento estérico / Bloqueio: Animação de colisão (bump-and-detach: avança 8px, vibra horizontalmente e recua soltando-se).

Transcrição ativa: Deslizamento contínuo da RNA Polimerase sobre o DNA gerando uma fita de mRNA animada via stroke-dashoffset.

6. Mecânica de UI: "Scanner & Pool Molecular"
Para evitar sobrecarga cognitiva, o aluno descobre as peças no ambiente antes de usá-las:

Descoberta (Scan): Moléculas novas flutuam na célula com destaque sutil (glow discreto e resposta ao hover/toque, sem anéis tracejados chamativos). Ao clicar/tocar, um card flutuante de 2 linhas explica sua função biológica e a molécula é adicionada ao Pool Molecular (barra inferior fixa com efeito glassmorphism).

Canais e Estruturas Interativas: Evitar rótulos instrutivos redundantes (ex.: "FECHADO (clique)"); o estado deve ser comunicado visualmente pela abertura da estrutura e pelo fluxo de partículas, revelando nome/função quando o aluno interagir.

Recrutamento (Drag & Drop): O aluno arrasta moléculas do Pool Molecular diretamente para os sítios-alvo no DNA ou sobre outras proteínas (permitindo crafting molecular, ex.: ligar cAMP à proteína CAP).

Suporte Híbrido (Desktop + Mobile): Toda ação de arrastar deve funcionar via Pointer Events (pointerdown, pointermove, pointerup) E também permitir o modo alternativo clique-para-selecionar + clique-no-alvo para acessibilidade em telas pequenas.

Manual "Just-in-Time": Botão discreto no canto superior direito que abre uma gaveta lateral com as fichas das moléculas já escaneadas. Se o aluno cometer 2 erros consecutivos no mesmo mecanismo, o botão pulsa suavemente destacando a ficha relevante.
