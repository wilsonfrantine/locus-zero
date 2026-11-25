# AGENTS.md — Locus Zero

## 1. Visão e Stack
- **Projeto:** `locus-zero` — Simulador educativo interativo de controle de expressão gênica (estética BioRender minimalista em SVG + CSS + TypeScript).
- **Stack:** TypeScript (`strict: true`), HTML5, CSS3 (variáveis CSS e animações), Vite (`vanilla-ts`).
- **Restrição de dependências:** Não instalar frameworks (React, Vue, etc.), libs de animação pesadas ou engines 3D/física sem aprovação explícita.

## 2. Arquitetura e Regras de Ouro
- **Especificações:** Os detalhes de visual, arquitetura e biologia de cada fase estão em `specs/00` a `specs/05`. Sempre consulte a spec correspondente antes de propor ou alterar código.
- **Separação estrita Engine vs. View:**
  - Arquivos `*Engine.ts` são TypeScript puro: **nunca** importe `document`, `window`, `HTMLElement`, `SVGElement` ou arquivos CSS neles.
  - Arquivos `*View.ts` cuidam da renderização SVG e da leitura do estado emitido pela Engine.
- **Responsividade e Interação:** Todo palco SVG usa `viewBox="0 0 1200 700"` e interações via `Pointer Events` (compatível com mouse e toque) + modo clique-para-selecionar/clique-no-alvo.

## 3. Fluxo de Trabalho e Critérios de Pronto (Definition of Done)
- **Planejamento primeiro:** Em tarefas novas ou mudanças estruturais, apresente o plano e os arquivos afetados antes de alterar o código, salvo quando o pedido for pontual e direto.
- **Sessões limpas:** Cada fase do roteiro deve ser executada em uma sessão/conversa focada, apoiando-se neste arquivo e nos specs em `specs/`.
- **Validação obrigatória:** Ao concluir uma etapa, rode `npx tsc --noEmit` e `npm run build` e reporte o resultado. Só considere a etapa concluída quando compilarem sem erros.
