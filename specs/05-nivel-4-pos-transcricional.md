# 05 — Nível 4: O Filtro Pós-Transcricional (Splicing, Estabilidade e RNAi)

## 1. Cenário e Crise Celular (Fase Final)
- **Ambiente:** Fronteira **Núcleo-Citoplasma** (metade superior com fundo `--bg-nucleus-*`, membrana nuclear com um poro central dividindo a tela, metade inferior com fundo `--bg-cytoplasm-*`).
- **Situação Inicial:** A transcrição já ocorreu, mas a célula enfrenta uma crise dupla (alerta vermelho):
  1. **No Núcleo:** Um pré-mRNA de reparo contém um **Éxon 2 defeituoso** que precisa ser pulado (*splicing* alternativo) e a fita madura está desprotegida contra degradação no citoplasma.
  2. **No Citoplasma:** Um **mRNA tóxico (superexpresso)** está sendo traduzido continuamente por ribossomos, intoxicando a célula.
- **Meta do Aluno:** Produzir a isoforma funcional estável do mRNA de reparo **E** silenciar o mRNA tóxico via interferência por RNA (RNAi) para estabilizar a célula em 100%.

## 2. Anatomia do Palco SVG (`PostTransView.ts`)
- **Metade Superior — Núcleo (Pré-mRNA de Reparo):**
  - Fita horizontal em `--mrna-strand` dividida em blocos claros: `[Éxon 1]` — `[Íntron A]` — `[Éxon 2 (Defeituoso)]` — `[Íntron B]` — `[Éxon 3]`.
  - `zone-exon2`: Sítio sobre o Éxon 2 onde o repressor de splicing pode se acoplar.
  - `zone-premRNA`: Área geral da fita onde o Spliceossomo atua.
  - `zone-tail`: Extremidades 5' e 3' do mRNA maduro (ficam expostas a **Exonucleases** que patrulham o citoplasma).
- **Metade Inferior — Citoplasma (mRNA Tóxico):**
  - Segunda fita de mRNA acoplada a um ribossomo animado sintetizando proteínas tóxicas vermelhas.
  - `zone-3utr`: Região 3' UTR com encaixe geométrico complementar para o complexo `RISC-miRNA`.

## 3. Catálogo de Moléculas (Scanner & Pool)
| ID | Label | Estado Inicial | Função / Comportamento |
| :--- | :--- | :--- | :--- |
| `spliceosome` | `Spliceossomo` | Flutuando no núcleo (requer Scan) | Remove íntrons e une éxons. Sem reguladores, realiza *splicing* padrão (inclui Éxon 1 + 2 + 3). |
| `splicing-rep` | `hnRNP` | Flutuando no núcleo (requer Scan) | Repressor de *splicing*. Ao ser colocado em `zone-exon2`, mascara o Éxon 2 e força o Spliceossomo a pulá-lo (*exon skipping*). |
| `polya-pabp` | `Cap 5' + Poli-A` | Flutuando próximo ao poro (requer Scan) | Proteção dupla das extremidades (Cap 5' + cauda Poli-A com PABP). Impede que exonucleases degradem o mRNA maduro no citoplasma. |
| `risc` | `RISC` | Flutuando no citoplasma (requer Scan) | Complexo proteico silenciador (com proteína Argonauta). Sozinho não reconhece o mRNA alvo. |
| `mirna` | `miRNA` | Flutuando no citoplasma (requer Scan) | MicroRNA guia complementar à região 3' UTR do mRNA tóxico. Arrastar sobre `RISC` realiza *crafting* e forma `risc-mirna`. |
| `risc-mirna` | `RISC-miRNA` | Criado via *crafting* (`miRNA` + `RISC`) | Complexo silenciador ativo. Encaixa em `zone-3utr`, bloqueia o ribossomo e degrada o mRNA tóxico. |

## 4. Máquina de Estados Biológicos (`PostTransEngine.ts`)
```ts
export interface PostTransState {
  exon2Masked: boolean;          // Inicia false
  splicedIsoform: 'NONE' | 'DEFECTIVE' | 'FUNCTIONAL';
  mrnaStabilized: boolean;       // Inicia false
  toxicMrnaSilenced: boolean;    // Inicia false
  crisisResolved: boolean;       // True quando FUNCTIONAL + stabilized + silenced
}
```

### Regras de Transição e Feedback Visual
1. **Splicing Padrão — Isoforma Defeituosa (`SPLICING_DEFECTIVE`):**
   - *Ação:* Aluno arrasta `spliceosome` para `zone-premRNA` enquanto `exon2Masked === false`.
   - *Resultado:* Íntrons A e B são removidos, mas o Éxon 2 defeituoso permanece (`Éxon 1 + 2 + 3`). Um alerta âmbar pisca e aciona automaticamente um reset do pré-mRNA após ~2,5s (mantendo as moléculas já escaneadas no Pool) para evitar becos sem saída, além de oferecer um botão rápido **"Resetar Pré-mRNA"**.
   - *Mensagem:* "Isoforma defeituosa! O Spliceossomo incluiu o Éxon 2. Use um repressor de splicing (hnRNP) para mascarar o Éxon 2 antes do corte."
2. **Exon Skipping — Isoforma Funcional (`SPLICING_FUNCTIONAL`):**
   - *Ação:* Aluno coloca `splicing-rep` em `zone-exon2` e depois aplica `spliceosome` em `zone-premRNA`.
   - *Resultado:* `splicedIsoform = 'FUNCTIONAL'`. Íntrons e Éxon 2 são excisados em alça, unindo `Éxon 1 + Éxon 3`. O mRNA maduro atravessa o poro nuclear para o citoplasma (saúde sobe para 40%).
   - *Mensagem:* "Splicing alternativo concluído! O mRNA funcional chegou ao citoplasma, mas está vulnerável às exonucleases."
3. **Estabilização do mRNA (`MRNA_STABILIZED`):**
   - *Ação:* Aluno arrasta `polya-pabp` (`Cap 5' + Poli-A`) para `zone-tail` do mRNA funcional.
   - *Resultado:* `mrnaStabilized = true`. Surge um escudo dourado duplo nas extremidades (Cap 5' + Poli-A com PABP) que repele visualmente as exonucleases. Ribossomos iniciam a tradução da proteína de reparo (saúde sobe para 70%).
   - *Mensagem:* "mRNA estabilizado! A proteção dupla Cap 5' + Poli-A (com PABP) protege o transcrito contra exonucleases."
4. **Crafting de Silenciamento (`COMPLEX_FORMED`):**
   - *Ação:* Aluno arrasta `mirna` sobre `risc`.
   - *Resultado:* Desbloqueia `risc-mirna` no Pool Molecular.
   - *Mensagem:* "Complexo RISC carregado com miRNA guia! Pronto para reconhecer a região 3' UTR complementar."
5. **Silenciamento por RNAi (`TOXIC_MRNA_SILENCED`):**
   - *Ação:* Aluno arrasta `risc-mirna` para `zone-3utr` do mRNA tóxico.
   - *Resultado:* `toxicMrnaSilenced = true`. O ribossomo se desprende do mRNA tóxico e a fita se fragmenta suavemente em pedaços que desaparecem.
   - *Mensagem:* "mRNA tóxico silenciado! O pareamento do miRNA na 3' UTR interrompeu a tradução."
6. **Crise Resolvida (`LEVEL_COMPLETE`):**
   - *Condição:* `splicedIsoform === 'FUNCTIONAL' && mrnaStabilized && toxicMrnaSilenced`.
   - *Resultado:* `crisisResolved = true`. Saúde celular atinge 100% (verde) e libera a **"Trava de Saída Final"**.

## 5. Trava de Saída (Desafio de Mutação Final)
> **Anomalia Detectada na Análise Molecular #104:**
> Uma mutação pontual ocorreu na **região 3' UTR** (região não traduzida) de um proto-oncogene, destruindo exatamente o sítio de reconhecimento de um **miRNA regulador**. A sequência codificadora da proteína não sofreu nenhuma alteração.
>
> **Qual será o impacto celular mais provável dessa mutação?**
> - **A)** Nenhum impacto, pois mutações fora da região codificadora nunca alteram a expressão gênica.
> - **B)** Acúmulo excessivo da proteína do proto-oncogene, pois o complexo RISC-miRNA não consegue mais silenciar esse mRNA. *(CORRETA)*
> - **C)** A RNA Polimerase II não conseguirá mais iniciar a transcrição do gene no núcleo.

- **Feedback de Erro:** Relembra que a 3' UTR controla o destino pós-transcricional do mRNA (estabilidade e tradução) via ligação de miRNAs e proteínas reguladoras.
- **Feedback de Acerto:** Salva a telemetria do Nível 4, marca a missão como concluída e abre automaticamente o **`ReportModal.ts`** para emissão da nota e do Comprovante de Conclusão.

## 6. Textos do Manual de Bancada (`postTransData.ts`)
- **Spliceossomo:** Complexo ribonucleoproteico nuclear que remove íntrons e une éxons do pré-mRNA.
- **Splicing Alternativo (hnRNP):** Proteínas reguladoras podem mascarar ou expor sítios de corte, permitindo que um único gene gere diferentes isoformas de proteínas a partir de combinações distintas de éxons.
- **Cap 5' + Poli-A (com PABP):** Proteção dupla das extremidades do mRNA eucariótico — o Cap 5' na extremidade inicial e a cauda Poli-A ligada a proteínas PABP na extremidade 3' — conferindo resistência contra degradação por exonucleases e facilitando a tradução.
- **miRNA e Complexo RISC:** Pequenos RNAs não codificadores que guiam o complexo proteico RISC até sequências complementares na região 3' UTR de mRNAs alvo, inibindo sua tradução ou induzindo sua degradação.
