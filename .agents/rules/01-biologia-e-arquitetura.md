# Regras de Biologia e Arquitetura — Locus Zero

## Consulta Obrigatória às Specs
- Antes de criar ou alterar qualquer nível ou sistema de avaliação, leia o arquivo correspondente em `specs/` (`01` para arquitetura e avaliação; `02` a `05` para os níveis 1 a 4).
- Não altere regras biológicas, nomes de moléculas, condições de transição ou casos da Trava de Saída sem alinhamento com a spec do nível.

## Separação Engine vs. View
- Todo arquivo `*Engine.ts` deve ser TypeScript puro: proibido importar `document`, `window`, `HTMLElement`, `SVGElement` ou arquivos `.css`.
- A comunicação entre lógica, UI e visualização deve respeitar os contratos em `src/core/types.ts` e `src/core/EventBus.ts`.
- Toda mudança de estado visual deve ser refletida via dados/estados emitidos pela Engine e interpretados pela `*View.ts` ou componentes UI.

## Telemetria e Avaliação
- Preserve o registro silencioso de tentativas válidas/inválidas, aberturas do Manual, tentativas na Trava de Saída e persistência em `localStorage` via `AssessmentEngine.ts`.
- Não simplifique a rubrica nem remova o cálculo de integridade do comprovante final sem atualizar `specs/01-arquitetura-e-avaliacao.md`.
