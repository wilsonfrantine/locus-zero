# 02 — Nível 1: O Interruptor Bacteriano (Operon *lac*)

## 1. Cenário, Briefing Inicial e Crise Celular
- **Ambiente:** Citoplasma de *Escherichia coli* (textura citoplasmática sutil sobre `--bg-cytoplasm-*`).
- **Briefing Narrativo Inicial (Onboarding):** Antes de liberar o palco do Nível 1, um card limpo e legível em 1–2 passos curtos contextualiza a crise (*E. coli* no intestino humano após ingestão de leite, lactose alta no meio externo, glicose escassa) com botão **"Entrar na Célula"**, eliminando caixas de texto fixas sobre o DNA.
- **Situação Inicial:** O meio extracelular está **sem glicose** e **rico em lactose** (representado visualmente por moléculas de lactose flutuando acima da membrana e ausência de glicose). A célula está perdendo energia (barra de status em alerta vermelho) porque o operon *lac* está desligado.
- **Meta do Aluno:** Atingir **Transcrição Máxima (100%)** dos genes estruturais (*lacZ, lacY, lacA*) para produzir $\beta$-galactosidase e estabilizar a célula.

## 2. Anatomia do Palco SVG (`LacView.ts`)
- **Borda Superior (Membrana Celular de Borda a Borda):** Bicamada lipídica em arco convexo atravessando 100% da largura da tela, com representação de fosfolipídeos e coloração distinta entre o Meio Extracelular (acima) e o Citoplasma (abaixo). Possui dois canais interativos que **não abrem por clique direto**: clicar no canal abre o **Popup de Foco** explicando sua função e como ativá-lo; o transporte inicia quando o aluno coloca uma molécula externa em contato:
  1. `Canal de Lactose` (inicia fechado; ao colocar **Lactose externa** em contato, permite a entrada de lactose, e a **$\beta$-galactosidase basal** no citoplasma converte parte dessa lactose em **Alolactose**).
  2. `Canal de Glicose` (inicia fechado; experimento de contraste — ao colocar **Glicose externa** em contato, a glicose entra e inibe visivelmente a **Adenilato Ciclase** na face interna da membrana, reduzindo os níveis de **cAMP**).
- **Enzimas Automáticas e Tradução:**
  - **Adenilato Ciclase** (ancorada na membrana): ativa na ausência de glicose (produzindo `cAMP`), inibida quando entra glicose.
  - **$\beta$-galactosidase basal**: converte lactose recém-entrada em `Alolactose`.
  - **Ribossomo + $\beta$-galactosidase**: ao surgir mRNA (`BASAL` ou `HIGH`), um ribossomo se monta na fita e traduz $\beta$-galactosidase, que cliva lactose em glicose (sem retroalimentação autônoma).
- **Centro (Dupla Hélice de DNA do Operon *lac* + Cromossomo Circular em Perspectiva):** Dupla hélice vetorial minimalista que se abre sutilmente nos sítios de encaixe e nos blocos dos genes estruturais, com o restante do cromossomo circular bacteriano recuando em perspectiva no fundo:
  1. `zone-cap` (**Sítio CAP**): Encaixe semicircular esmeralda.
  2. `zone-promoter` (**Promotor `P`**): Encaixe retangular azul-petróleo.
  3. `zone-operator` (**Operador `O`**): Encaixe triangular âmbar (inicia **ocupado** pelo repressor `LacI`).
  4. `genes-structural` (**`lacZ` | `lacY` | `lacA`**): Região de leitura onde a `RNApol` desliza gerando a fita de mRNA policistrônico.

## 3. Catálogo de Moléculas (Scanner & Pool)
As moléculas não descobertas flutuam com destaque sutil (glow discreto e resposta ao hover/toque, sem anéis tracejados chamativos). Ao clicar em uma molécula, abre-se um **Popup de Foco** centralizado; ao fechá-lo no primeiro *scan*, uma cópia animada vai ao Pool Molecular (onde pode ser clicada novamente para reabrir a explicação).
| ID | Label | Estado Inicial | Função / Comportamento |
| :--- | :--- | :--- | :--- |
| `laci` | `LacI` | Preso em `zone-operator` (já visível, clicável para Scan) | Repressor. Bloqueia fisicamente a `RNApol`. Possui bolsão lateral para `allolactose`. |
| `rnap` | `RNApol` | Flutuando (requer Scan) | RNA Polimerase. Encaixa em `zone-promoter`. |
| `allolactose` | `Alolactose` | Formada no citoplasma ao abrir o Canal de Lactose (requer Scan) | Indutor gerado pela conversão da lactose via atividade basal residual de $\beta$-galactosidase. Ao ser arrastada sobre `LacI`, causa mudança alostérica e solta o repressor do DNA. |
| `cap` | `CAP` | Flutuando (requer Scan) | Proteína ativadora. Sozinha tem formato fechado e **não encaixa** em `zone-cap`. |
| `camp` | `cAMP` | Flutuando em alta concentração quando Glicose está fechada (requer Scan) | Sinalizador de escassez de glicose. Arrastar `cAMP` sobre `CAP` realiza *crafting* e forma o complexo ativo `cap-camp`. |
| `cap-camp` | `CAP-cAMP` | Criado via *crafting* (`cAMP` + `CAP`) | Complexo ativo com formato semicircular aberto. Encaixa em `zone-cap` e estabiliza a `RNAP`. |

## 4. Máquina de Estados Biológicos (`LacEngine.ts`)
A engine avalia a combinação atual do estado e retorna o nível de transcrição:

```ts
export interface LacState {
  glucoseOpen: boolean;
  lactoseOpen: boolean;
  repressorBound: boolean;    // Inicia true
  capCampBound: boolean;      // Inicia false
  rnapBound: boolean;         // Inicia false
  transcriptionRate: 'NONE' | 'BASAL' | 'HIGH';
}
```

### Regras de Transição e Feedback Visual
1. **Impedimento Estérico (`BUMP_REPRESSOR`):**
   - *Ação:* Aluno arrasta `RNAP` para `zone-promoter` enquanto `repressorBound === true`.
   - *Resultado:* `RNAP` encaixa brevemente, avança até `zone-operator`, colide com `LacI` (animação `bump-and-detach`) e se solta.
   - *Mensagem:* "Bloqueio físico! O repressor LacI impede a passagem da RNA Polimerase."
2. **Mudança Alostérica (`ALLOSTERIC_SHIFT`):**
   - *Ação:* Aluno arrasta `allolactose` sobre `LacI` (no Operador).
   - *Resultado:* `repressorBound = false`. O SVG do `LacI` altera seu `path` (perde o encaixe triangular) e flutua para fora do DNA.
   - *Mensagem:* "Alosteria! A alolactose mudou a conformação do LacI, liberando o Operador."
3. **Transcrição Basal — Insuficiente (`TRANSCRIPTION_BASAL`):**
   - *Ação:* `repressorBound === false`, `capCampBound === false`, e aluno coloca `RNAP` em `zone-promoter`.
   - *Resultado:* `transcriptionRate = 'BASAL'`. A `RNAP` desliza lentamente e se solta cedo (pouco mRNA). A célula vai para alerta amarelo (30% de saúde).
   - *Mensagem:* "Transcrição basal (muito baixa). Sem glicose, a célula precisa de um ativador para recrutar a RNAP com eficiência."
4. **Crafting Molecular (`COMPLEX_FORMED`):**
   - *Ação:* Aluno arrasta `camp` sobre `cap` (no palco ou no Pool Molecular).
   - *Resultado:* Ambos se fundem com brilho esmeralda, desbloqueando `cap-camp` no Pool.
   - *Mensagem:* "Complexo CAP-cAMP ativado! Agora ele possui afinidade pelo sítio CAP no DNA."
5. **Repressão Catabólica (`GLUCOSE_DROP`):**
   - *Ação:* Aluno abre `Canal de Glicose` a qualquer momento.
   - *Resultado:* A glicose inibe a adenilato ciclase, reduzindo os níveis de `cAMP` no citoplasma; se `capCampBound === true`, o complexo se desfaz e solta do DNA, derrubando a transcrição de `HIGH` para `BASAL`.
   - *Mensagem:* "A glicose inibiu a adenilato ciclase, reduzindo o cAMP! A célula prioriza glicose e desativa o complexo CAP."
6. **Transcrição Máxima — Crise Resolvida (`TRANSCRIPTION_HIGH`):**
   - *Condição:* `repressorBound === false` AND `capCampBound === true` AND `rnapBound === true`.
   - *Resultado:* `transcriptionRate = 'HIGH'`. Fluxo contínuo de `RNAP` e síntese rápida de mRNA policistrônico. Saúde celular sobe para 100% (verde) e libera o botão **"Avançar para Trava de Saída"**.

## 5. Trava de Saída (Desafio de Mutação)
Ao estabilizar a célula, abre-se um modal sobre o palco celular (sem sair da estética) com o caso clínico/laboratorial para destrancar o Nível 2:

> **Anomalia Detectada na Cepa Mutante #42:**
> Uma colônia de *E. coli* está produzindo $\beta$-galactosidase continuamente (expressão constitutiva), **mesmo na ausência total de lactose no meio**.
>
> **Qual mutação explica esse comportamento?**
> - **A)** Mutação que impede a ligação do complexo CAP-cAMP ao DNA.
> - **B)** Mutação de perda de função no gene *lacI*, impedindo o repressor de se ligar ao Operador. *(CORRETA)*
> - **C)** Mutação que destrói o Promotor do operon *lac*.

- **Feedback de Erro:** Explica brevemente por que a opção escolhida causaria o efeito oposto (ausência de transcrição) e permite nova tentativa (registrada em `mutationAttempts`).
- **Feedback de Acerto:** Confirma o diagnóstico de *expressão constitutiva*, salva a telemetria do Nível 1 e destranca o Nível 2.

## 6. Textos do Manual de Bancada (`lacData.ts`)
- **LacI (Repressor):** Proteína reguladora que se liga ao Operador na ausência de lactose, bloqueando fisicamente a RNA Polimerase (controle negativo).
- **Alolactose:** Isômero da lactose gerado no citoplasma pela atividade basal residual de $\beta$-galactosidase quando a lactose entra na célula. Atua como indutor: liga-se ao repressor LacI e altera sua forma tridimensional (alosteria), fazendo-o soltar do DNA.
- **CAP + cAMP:** Controle positivo. Na ausência de glicose, a adenilato ciclase permanece ativa, mantendo altos níveis de cAMP que ativam a proteína CAP. Quando há glicose, ela inibe a adenilato ciclase e reduz o cAMP. O complexo CAP-cAMP dobra o DNA e aumenta drasticamente a afinidade da RNA Polimerase pelo promotor.
- **RNA Polimerase (RNAP):** Enzima responsável por transcrever os genes *lacZ, lacY* e *lacA* em um único mRNA policistrônico.
