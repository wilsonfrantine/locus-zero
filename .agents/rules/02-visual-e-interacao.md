# Regras Visuais e de Interação — Locus Zero

## Estética "BioRender Vivo" e SVG
- Siga a paleta semântica e os tokens definidos em `specs/00-visao-e-design-system.md` e `src/styles/tokens.css`.
- Todo palco principal de nível deve usar `<svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid meet">` com componentes vetoriais limpos (sem PNG/JPG ou WebGL).
- Priorize geometria funcional de encaixe (chave-fechadura), alterações visuais claras em mudanças alostéricas/conformacionais e profundidade em 3 camadas:
  1. Fundo com textura citoplasmática/nuclear orgânica muito sutil (granulação/filamentos discretos, sem bolhas/holofotes fortes).
  2. Palco molecular com DNA em dupla hélice vetorial minimalista (abrindo sutilmente nos sítios de encaixe/genes) e membrana em arco de borda a borda (`x=0` a `x=1200`) quando aplicável.
  3. HUD discreto, sem caixas fixas grandes sobrepondo o palco; use briefing narrativo inicial antes do palco e *toasts* compactos (1–2 linhas) com desaparecimento automático.
- Mantenha rótulos dentro das moléculas curtos e evite ruído visual: sem anéis tracejados chamativos para Scan (use glow sutil / resposta ao hover/toque) e sem rótulos instrutivos redundantes nos canais (estado comunicado visualmente por abertura e fluxo); explicações ficam no card de Scan, no Manual de Bancada ou no feedback da ação.

## Animações e Responsividade
- Use animações CSS leves para movimento browniano, encaixe, colisão (`bump-and-detach`) e fluxos de transcrição/tradução.
- Garanta que todas as interações de Scan, *crafting* e recrutamento funcionem tanto com `Pointer Events` (arrastar com mouse ou toque) quanto com clique/toque para selecionar e clique/toque no alvo.
- Verifique layout e legibilidade em telas largas, em smartphone paisagem (`max-height: 500px`, compactando `StatusHUD` e `MolecularPool` em barras finas) e em portrait estreito (`max-width: 600px`, mantendo legibilidade e oferecendo aviso discreto de orientação sem bloquear o modo vertical).
