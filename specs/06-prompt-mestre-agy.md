# 06 — Roteiro de Prompts para o Antigravity (Execução em Fases)

## Como usar este roteiro
1. Crie o repositório `locus-zero` e coloque todos os arquivos (`00` a `05`) dentro da pasta `/specs`.
2. Envie **um prompt por vez** ao Antigravity.
3. Ao final de cada fase, rode `npm run dev`, teste no navegador (desktop e modo mobile no DevTools) e só avance para a fase seguinte quando a atual estiver funcionando sem erros.

---

## Fase 1 — Fundação, Design System e Core
*Objetivo: Criar o projeto Vite + TypeScript, tokens visuais, animações base e os módulos centrais sem nenhum nível ainda.*

```text
Leia atentamente os arquivos `specs/00-visao-e-design-system.md` e `specs/01-arquitetura-e-avaliacao.md`.

Implemente a Fase 1 (Fundação) do projeto `locus-zero`:
1. Inicialize o projeto com Vite (`vanilla-ts`, TypeScript strict mode, sem frameworks externos).
2. Crie a estrutura de pastas exata definida em `specs/01-arquitetura-e-avaliacao.md`.
3. Implemente `src/styles/tokens.css`, `animations.css` (incluindo movimento browniano, snap magnético e colisão `bump-and-detach`) e `layout.css` (responsivo desktop/mobile).
4. Implemente `src/core/types.ts`, `EventBus.ts`, `InteractionManager.ts` (suportando Pointer Events Drag & Drop + modo alternativo clique-para-selecionar/clique-no-alvo) e `AssessmentEngine.ts` (com persistência em `localStorage` e rubrica completa).
5. Implemente os shells de UI: `StatusHUD.ts`, `MolecularPool.ts` e `BenchManual.ts` (gaveta lateral com destaque automático após 2 erros consecutivos).

Não implemente os níveis ainda. Crie uma tela inicial limpa com o título "Locus Zero: Crise Intracelular" e um botão "Iniciar Missão". Verifique se o build (`npm run build`) passa sem erros de TypeScript.
```

---

## Fase 2 — Nível 1: Operon *lac* (MVP Jogável)
*Objetivo: Validar toda a estética "BioRender Vivo", o Scanner/Pool Molecular, o crafting e a Trava de Saída.*

```text
Leia `specs/02-nivel-1-operon-lac.md` e siga rigorosamente a separação Engine vs. View definida em `specs/01-arquitetura-e-avaliacao.md`.

Implemente o Nível 1 completo em `src/levels/level1-lac/`:
1. `LacEngine.ts`: lógica 100% pura em TypeScript (sem acesso ao DOM), cobrindo todos os estados e eventos (`BUMP_REPRESSOR`, `ALLOSTERIC_SHIFT`, `TRANSCRIPTION_BASAL`, `COMPLEX_FORMED`, `GLUCOSE_DROP`, `TRANSCRIPTION_HIGH`).
2. `LacView.ts`: palco SVG (`viewBox="0 0 1200 700"`) com estética BioRender minimalista:
   - Membrana superior com canais clicáveis de Lactose e Glicose.
   - DNA com encaixes geométricos distintos (chave-fechadura) para Sítio CAP, Promotor e Operador.
   - Transição visual real de forma (alosteria) no SVG do repressor `LacI` ao receber `Alolactose`.
   - Crafting arrastando `cAMP` sobre `CAP` (no palco ou no Pool) para gerar `CAP-cAMP`.
   - Animação de colisão da `RNAP` no repressor e fluxo de mRNA policistrônico na transcrição ativa.
3. `lacData.ts`: textos de Scan, fichas do Manual de Bancada e o modal da Trava de Saída (Desafio de Mutação da Cepa #42) integrado ao `AssessmentEngine`.

Conecte o botão "Iniciar Missão" ao Nível 1 e garanta que toda interação funcione com mouse e toque.
```

---

## Fase 3 — Nível 2: A Fechadura Cromatínica (Epigenética)
*Objetivo: Adicionar a estética nuclear, compactação/descompactação de nucleossomos e progressão entre níveis.*

```text
Leia `specs/03-nivel-2-cromatina.md` e mantenha o mesmo padrão arquitetural e visual do Nível 1.

Implemente o Nível 2 completo em `src/levels/level2-chromatin/`:
1. `ChromatinEngine.ts`: lógica pura cobrindo metilação de DNA, acetilação/desacetilação de histonas, crafting `HAT + Acetil-CoA -> HAT-Ac` e recrutamento da `RNAP II`.
2. `ChromatinView.ts`: ambiente nuclear (`--bg-nucleus-*`), 4 nucleossomos SVG com caudas de histonas exibindo cargas `+`, marcas `Me` na ilha CpG e transição suave de deslizamento lateral dos nucleossomos (Heterocromatina -> Eucromatina) ao acetilar, além da recompactação ao testar `HDAC`.
3. `chromatinData.ts`: fichas do Manual e Trava de Saída (Biópsia Celular #17).

Conecte a conclusão da Trava de Saída do Nível 1 para desbloquear e carregar automaticamente o Nível 2.
```

---

## Fase 4 — Nível 3: O Painel Combinatório (Controle Eucariótico)
*Objetivo: Implementar a animação de DNA looping e a lógica combinatória tecido-específica.*

```text
Leia `specs/04-nivel-3-combinatorio.md` e mantenha o padrão arquitetural dos níveis anteriores.

Implemente o Nível 3 completo em `src/levels/level3-combinatorial/`:
1. `CombinatorialEngine.ts`: lógica pura exigindo `GTFs` antes de `RNAP II`, combinação exata no Enhancer (`HNF-1` + `C/EBP`), rejeição de `NeuroD`, bloqueio reversível por `Silencer` e ativação pelo `Mediador`.
2. `CombinatorialView.ts`: indicador de tecido no HUD (*Hepatócito*), fita de DNA com dois slots geométricos no Enhancer distal, Silencer e TATA Box. Ao aplicar o `Mediador` com todas as condições válidas, anime o dobramento do DNA em alça (*DNA looping*) conectando o Enhancer à `RNAP II`.
3. `combinatorialData.ts`: fichas do Manual e Trava de Saída (Sequenciamento #89).

Conecte a conclusão do Nível 2 para carregar o Nível 3.
```

---

## Fase 5 — Nível 4: O Filtro Pós-Transcricional (Splicing e RNAi)
*Objetivo: Implementar a tela dividida Núcleo/Citoplasma, exon skipping e silenciamento por miRNA.*

```text
Leia `specs/05-nivel-4-pos-transcricional.md` e mantenha o padrão arquitetural dos níveis anteriores.

Implemente o Nível 4 completo em `src/levels/level4-posttrans/`:
1. `PostTransEngine.ts`: lógica pura gerenciando a crise dupla (splicing padrão vs. exon skipping com `hnRNP`, estabilização com `Poli-A + PABP`, crafting `RISC + miRNA` e silenciamento do mRNA tóxico).
2. `PostTransView.ts`: viewport dividida por membrana nuclear com poro central (Núcleo em cima, Citoplasma embaixo). Animação do corte de íntrons/Éxon 2, passagem do mRNA maduro pelo poro, exonucleases patrulhando o citoplasma e fragmentação do mRNA tóxico ao aplicar `RISC-miRNA`. Inclua reset automático rápido do pré-mRNA caso o aluno gere a isoforma defeituosa.
3. `postTransData.ts`: fichas do Manual e Trava de Saída Final (Análise Molecular #104).

Conecte a conclusão do Nível 3 para carregar o Nível 4.
```

---

## Fase 6 — Relatório Final, Comprovante e Polimento
*Objetivo: Fechar o ciclo avaliativo com exportação de nota verificável e garantir qualidade de entrega.*

```text
Leia a seção 6 de `specs/01-arquitetura-e-avaliacao.md`.

Implemente a fase final do `locus-zero`:
1. Crie `src/ui/ReportModal.ts` acionado ao concluir a Trava de Saída do Nível 4:
   - Campos para Nome Completo e Matrícula do aluno.
   - Exibição da nota final (0 a 10), tempo total, tabela de desempenho por nível e diagnóstico de pontos fortes / temas a revisar.
   - Geração de Código de Integridade (hash SHA-256 via `crypto.subtle` combinando matrícula + pontuações + salt fixo).
   - Botão "Exportar Comprovante (PDF)" usando `window.print()` com folha de estilo `@media print` limpa de 1 página (fundo branco, alto contraste, ocultando o palco SVG).
2. Adicione um seletor discreto de níveis já desbloqueados no `StatusHUD` para o aluno poder revisitar fases concluídas.
3. Revise todo o projeto: verifique responsividade em mobile (375px), garanta que nenhum `*Engine.ts` importe DOM e valide `npm run build` sem warnings ou erros.
```

---

## Prompt de Resgate (use apenas se o agente perder a qualidade visual)
```text
Revise os SVGs de `[NomeDoNivel]View.ts`. Os elementos estão muito genéricos (círculos/retângulos simples). Refatore seguindo `specs/00-visao-e-design-system.md`: use geometria de encaixe chave-fechadura real entre proteínas e sítios do DNA, aplique a paleta semântica de `tokens.css`, adicione profundidade com sombras sutis e mantenha o movimento browniano leve nas moléculas livres.
```
