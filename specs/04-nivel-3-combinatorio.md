# 04 — Nível 3: O Painel Combinatório (Controle Transcricional Eucariótico)

## 1. Cenário e Crise Celular
- **Ambiente:** Núcleo de um **Hepatócito** (célula do fígado, fundo `--bg-nucleus-*`). Um indicador discreto no HUD mostra: *"Genoma: 100% idêntico ao de um Neurônio | Tecido atual: Fígado"*.
- **Situação Inicial:** O locus do gene da **Albumina (`ALB`)** já está em eucromatina aberta, mas a transcrição está desligada. Sem albumina, o organismo perde o equilíbrio osmótico sanguíneo (barra de status em alerta vermelho).
- **Meta do Aluno:** Montar a combinação correta de **Fatores de Transcrição** (gerais e tecido-específicos) e conectar o *Enhancer* distal ao promotor via **Complexo Mediador** (induzindo o *DNA looping*) para atingir **Transcrição Máxima (100%)**.

## 2. Anatomia do Palco SVG (`CombinatorialView.ts`)
- **Centro (Fita de DNA Distal + Proximal):** Para o *DNA looping*, o Enhancer e os fatores ligados a ele são agrupados em um `<g id="enhancer-assembly">` conectado ao promotor por uma curva Bézier (`<path>`). Ao acoplar o Mediador, anima-se o grupo `<g id="enhancer-assembly">` e atualizam-se os pontos da curva Bézier em vez de tentar interpolar caminhos SVG complexos com `d` mutável. Da esquerda para a direita:
  1. `zone-enhancer` (**Enhancer Distal**, a -10 kb): Região esmeralda com **dois encaixes geométricos distintos** (`slot-tf-1` semicircular e `slot-tf-2` hexagonal) que exigem a combinação correta de ativadores hepáticos.
  2. `zone-silencer` (**Silencer**): Encaixe coral/vermelho entre o enhancer e o promotor (funciona como experimento de contraste/armadilha).
  3. `zone-promoter` (**Promotor Central / TATA Box**): Encaixe retangular azul-petróleo.
  4. `gene-alb` (**Gene `ALB`**): Região codificadora da Albumina.

## 3. Catálogo de Moléculas (Scanner & Pool)
| ID | Label | Estado Inicial | Função / Comportamento |
| :--- | :--- | :--- | :--- |
| `gtf` | `GTFs` | Flutuando (requer Scan) | Fatores Gerais de Transcrição (ex.: TFIID/TFIIB). Reconhecem a TATA Box em `zone-promoter` e criam a plataforma de ancoragem para a `RNAP II`. |
| `rnapii` | `RNAP II` | Flutuando (requer Scan) | RNA Polimerase II. Só encaixa em `zone-promoter` **sobre** os `GTFs`. Sozinha, produz apenas transcrição basal insuficiente. |
| `tf-hnf1` | `HNF-1` | Flutuando (requer Scan) | Fator de transcrição ativador hepático. Encaixa em `slot-tf-1` do Enhancer. |
| `tf-cebp` | `C/EBP` | Flutuando (requer Scan) | Segundo fator ativador hepático. Encaixa em `slot-tf-2` do Enhancer. |
| `tf-neuro` | `NeuroD` | Flutuando (requer Scan — distrator) | Fator específico de neurônios. Possui geometria incompatível com o Enhancer da Albumina. |
| `silencer-rep` | `Repressor` | Flutuando (requer Scan — contraste) | Proteína repressora. Se encaixada em `zone-silencer`, impede a formação do complexo Mediador e desliga o gene. |
| `mediator` | `Mediador` | Flutuando (requer Scan) | Grande complexo proteico em ponte. Conecta os ativadores no Enhancer à `RNAP II` no Promotor, dobrando o DNA em alça. |

## 4. Máquina de Estados Biológicos (`CombinatorialEngine.ts`)
```ts
export interface CombinatorialState {
  gtfBound: boolean;           // Inicia false
  rnapBound: boolean;          // Inicia false
  enhancerSlot1Bound: boolean; // HNF-1 (Inicia false)
  enhancerSlot2Bound: boolean; // C/EBP (Inicia false)
  silencerBound: boolean;      // Inicia false
  mediatorBound: boolean;      // Inicia false (true ativa DNA looping)
  transcriptionRate: 'NONE' | 'BASAL' | 'HIGH';
}
```

### Regras de Transição e Feedback Visual
1. **Promotor Não Reconhecido (`MISSING_GTF`):**
   - *Ação:* Aluno arrasta `rnapii` para `zone-promoter` enquanto `gtfBound === false`.
   - *Resultado:* `RNAP II` escorrega e se solta (`bump-and-detach`).
   - *Mensagem:* "A RNA Polimerase II eucariótica não reconhece a TATA Box sozinha! Recrute primeiro os Fatores Gerais de Transcrição (GTFs)."
2. **Transcrição Basal — Insuficiente (`TRANSCRIPTION_BASAL`):**
   - *Ação:* Aluno encaixa `gtf` em `zone-promoter` e depois `rnapii` sobre `gtf` (sem Enhancer + Mediador).
   - *Resultado:* `transcriptionRate = 'BASAL'`. Fita de mRNA surge muito lentamente; saúde celular sobe apenas para 25% (alerta amarelo).
   - *Mensagem:* "Transcrição basal muito baixa! Para expressar Albumina em nível hepático, ative o Enhancer distal."
3. **Incompatibilidade Tecidual (`WRONG_TF_SHAPE`):**
   - *Ação:* Aluno arrasta `tf-neuro` para `zone-enhancer`.
   - *Resultado:* Rejeição geométrica imediata (`bump-and-detach`).
   - *Mensagem:* "Incompatível! NeuroD é um fator neuronal e não reconhece a sequência do Enhancer hepático."
4. **Bloqueio por Silencer — Experimento de Contraste (`SILENCER_ACTIVE`):**
   - *Ação:* Aluno arrasta `silencer-rep` para `zone-silencer`.
   - *Resultado:* `silencerBound = true`. Se `mediatorBound === true`, o Mediador se desacopla, o DNA se desdobra e a transcrição cai para `NONE`. (O aluno pode clicar no repressor no Silencer para removê-lo e testar novamente).
   - *Mensagem:* "Silencer ativado! O repressor bloqueou a comunicação entre o Enhancer e o Promotor."
5. **Tentativa Prematura de Mediador (`MEDIATOR_INCOMPLETE`):**
   - *Ação:* Aluno arrasta `mediator` para o palco sem ter `rnapBound === true` OU sem ambos os ativadores (`HNF-1` e `C/EBP`) no Enhancer, OU com `silencerBound === true`.
   - *Resultado:* O Mediador pisca em alerta e retorna ao Pool.
   - *Mensagem:* "O Complexo Mediador precisa da combinação completa: Enhancer ocupado (HNF-1 + C/EBP), RNAP II ancorada no promotor e Silencer livre."
6. **DNA Looping e Transcrição Máxima — Crise Resolvida (`DNA_LOOP_ACTIVE`):**
   - *Condição:* `enhancerSlot1Bound && enhancerSlot2Bound && gtfBound && rnapBound && !silencerBound` e aluno aplica `mediator`.
   - *Resultado:* `mediatorBound = true`, `transcriptionRate = 'HIGH'`. **Animação chave:** a fita de DNA curva-se suavemente em alça (*looping*), aproximando fisicamente o Enhancer da `RNAP II` através da ponte do Mediador. Síntese intensa de mRNA, saúde celular vai para 100% (verde) e libera a **"Trava de Saída"**.

## 5. Trava de Saída (Desafio de Mutação)
> **Anomalia Detectada no Sequenciamento #89:**
> Um paciente apresenta uma pequena deleção localizada a **10.000 pares de bases (10 kb) antes do promotor** do gene da Albumina, removendo completamente o *Enhancer* hepático. O promotor (TATA Box) e a região codificadora do gene estão 100% intactos.
>
> **Qual é a consequência esperada nas células do fígado desse paciente?**
> - **A)** A proteína Albumina será produzida em quantidade normal, pois a mutação está longe do gene.
> - **B)** A transcrição da Albumina cairá drasticamente (nível basal ou nulo), pois os ativadores não conseguem recrutar o Mediador para potencializar a RNAP II. *(CORRETA)*
> - **C)** O fígado produzirá uma proteína Albumina com sequência de aminoácidos alterada.

- **Feedback de Erro:** Explica que *enhancers* atuam a longas distâncias graças ao dobramento do DNA (*looping*), e que mutações em regiões regulatórias alteram a *quantidade* de expressão, não a sequência de aminoácidos da proteína.
- **Feedback de Acerto:** Confirma o princípio do controle combinatório a distância, salva a telemetria do Nível 3 e destranca o Nível 4.

## 6. Textos do Manual de Bancada (`combinatorialData.ts`)
- **GTFs (Fatores Gerais de Transcrição):** Conjunto de proteínas necessárias em praticamente todos os genes eucarióticos para posicionar a RNA Polimerase II no promotor (TATA Box). Garantem apenas transcrição basal.
- **Enhancers e Fatores Específicos:** Sequências regulatórias distantes que se ligam a ativadores presentes apenas em certos tecidos (como HNF-1 e C/EBP no fígado), explicando por que células com o mesmo DNA expressam genes diferentes.
- **Silencers:** Sequências de DNA que, ao ligarem proteínas repressoras, inibem a transcrição do gene alvo.
- **Complexo Mediador:** Grande ponte proteica que conecta os fatores ligados ao Enhancer distal à RNA Polimerase II no promotor, promovendo o dobramento do DNA (*DNA looping*) e disparando a transcrição em alta taxa.
