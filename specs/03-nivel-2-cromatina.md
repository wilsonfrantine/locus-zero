# 03 — Nível 2: A Fechadura Cromatínica (Epigenética e Remodelamento)

## 1. Cenário e Crise Celular
- **Ambiente:** Núcleo de uma célula eucariótica humana (fundo `--bg-nucleus-*` com poros nucleares sutis na borda).
- **Situação Inicial:** A célula sofreu dano oxidativo e precisa expressar urgentemente um **gene de reparo celular**, mas o locus está trancado em **Heterocromatina** (altamente compactado) e com o promotor hipermetilado. A barra de integridade celular está em alerta vermelho.
- **Meta do Aluno:** Converter a região em **Eucromatina** acessível, remover o silenciamento do promotor e ativar a transcrição pela **RNA Polimerase II**.

## 2. Anatomia do Palco SVG (`ChromatinView.ts`)
- **Centro (Fibra de Cromatina):** Uma fita de DNA enrolada em 4 **Nucleossomos** (octâmeros de histonas desenhados como cilindros/discos translúcidos com caudas proteicas saindo para fora).
  - *Estado Inicial (Heterocromatina):* Os 4 nucleossomos estão comprimidos no centro, escondendo o `zone-promoter` (TATA box). As caudas das histonas exibem cargas positivas (`+`) atraindo fortemente o DNA (carga negativa).
  - *Marcadores Iniciais:* A região da ilha CpG próxima ao promotor exibe 3 tags violetas de **Metilação (`Me`)**.
  - *Transição Visual (Eucromatina):* Ao acetilar as histonas, as cargas `+` são neutralizadas, tags douradas (`Ac`) aparecem nas caudas e os nucleossomos deslizam lateralmente (`transform: translateX`) revelando o encaixe retangular do `zone-promoter`.

## 3. Catálogo de Moléculas (Scanner & Pool)
| ID | Label | Estado Inicial | Função / Comportamento |
| :--- | :--- | :--- | :--- |
| `me-mark` | `Metil (Me)` | Preso à ilha CpG no DNA (clicável para Scan) | Marca epigenética silenciadora no DNA. Impede o recrutamento eficiente da maquinaria de transcrição. |
| `hat` | `HAT` | Flutuando (requer Scan) | Histona Acetiltransferase. Sozinha está descarregada e precisa de um doador de grupo acetil. |
| `acetyl-coa` | `Acetil-CoA` | Flutuando (requer Scan) | Doador de grupo acetil. Arrastar sobre `HAT` realiza *crafting* e forma `hat-active`. |
| `hat-active` | `HAT-Ac` | Criado via *crafting* (`HAT` + `Acetil-CoA`) | Enzima carregada. Ao ser arrastada sobre as caudas das histonas, adiciona grupos `Ac` e descompacta a cromatina. |
| `hdac` | `HDAC` | Flutuando (requer Scan — distrator/contraste) | Histona Desacetilase. Se arrastada sobre histonas acetiladas, remove os grupos `Ac` e recompacta o DNA. |
| `tet` | `Via TET / Reparo` | Flutuando (requer Scan) | Via TET / Reparo de Base (Desmetilação): oxida a 5-metilcitosina (5mC) para remoção por reparo de excisão de base, removendo os grupos `Me` da ilha CpG do promotor. |
| `rnapii` | `RNAP II` | Flutuando (requer Scan) | RNA Polimerase II eucariótica. Só consegue encaixar em `zone-promoter` quando o DNA está aberto e desmetilado. |

## 4. Máquina de Estados Biológicos (`ChromatinEngine.ts`)
```ts
export interface ChromatinState {
  dnaMethylated: boolean;       // Inicia true
  histonesAcetylated: boolean;  // Inicia false
  chromatinOpen: boolean;       // True quando histonesAcetylated === true
  rnapBound: boolean;           // Inicia false
  transcriptionActive: boolean; // Inicia false
}
```

### Regras de Transição e Feedback Visual
1. **Bloqueio por Compactação (`CHROMATIN_LOCKED`):**
   - *Ação:* Aluno arrasta `rnapii` para o DNA enquanto `histonesAcetylated === false`.
   - *Resultado:* `RNAP II` colide com os nucleossomos compactados (animação `bump-and-detach`) e recua.
   - *Mensagem:* "Acesso bloqueado! Em heterocromatina, o promotor está fisicamente escondido entre os nucleossomos."
2. **Crafting Enzimático (`COMPLEX_FORMED`):**
   - *Ação:* Aluno arrasta `acetyl-coa` sobre `hat`.
   - *Resultado:* Desbloqueia `hat-active` no Pool Molecular com brilho esmeralda.
   - *Mensagem:* "HAT carregada com Acetil-CoA! Pronta para modificar as caudas das histonas."
3. **Acetilação e Abertura (`HISTONES_ACETYLATED`):**
   - *Ação:* Aluno arrasta `hat-active` sobre os nucleossomos.
   - *Resultado:* `histonesAcetylated = true`, `chromatinOpen = true`. As cargas `+` somem, surgem marcas `Ac` e os nucleossomos se afastam suavemente, expondo o promotor.
   - *Mensagem:* "Acetilação concluída! A neutralização das cargas positivas relaxou a cromatina (Eucromatina)."
4. **Silenciamento por Metilação (`PROMOTER_METHYLATED`):**
   - *Ação:* `chromatinOpen === true`, `dnaMethylated === true`, e aluno arrasta `rnapii` para `zone-promoter`.
   - *Resultado:* `RNAP II` se aproxima do promotor exposto, mas é repelida pelas marcas `Me` (animação `bump-and-detach`).
   - *Mensagem:* "Promotor ainda silenciado! A hipermetilação na ilha CpG impede a ligação estável da RNA Polimerase II."
5. **Desmetilação — Via TET / Reparo de Base (`DNA_DEMETHYLATED`):**
   - *Ação:* Aluno arrasta `tet` sobre as marcas `Me` no promotor.
   - *Resultado:* `dnaMethylated = false`. A oxidação da 5mC via TET seguida de reparo por excisão de base remove as marcas `Me`, que se desprendem e desaparecem.
   - *Mensagem:* "Ilha CpG desmetilada via TET / Reparo de Base! O promotor agora está livre para recrutamento."
6. **Recompactação — Experimento de Contraste (`HISTONES_DEACETYLATED`):**
   - *Ação:* Aluno arrasta `hdac` sobre histonas já acetiladas.
   - *Resultado:* `histonesAcetylated = false`, `chromatinOpen = false`, `rnapBound = false`. As marcas `Ac` somem e os nucleossomos voltam a se comprimir, expulsando a `RNAP II` se estiver ligada.
   - *Mensagem:* "HDAC removeu os grupos acetil! As histonas recuperaram carga positiva e recompactaram o DNA."
7. **Transcrição Ativa — Crise Resolvida (`TRANSCRIPTION_ACTIVE`):**
   - *Condição:* `chromatinOpen === true` AND `dnaMethylated === false` AND aluno encaixa `rnapii` em `zone-promoter`.
   - *Resultado:* `transcriptionActive = true`. A `RNAP II` desliza pelo gene de reparo gerando pré-mRNA. Saúde celular sobe para 100% (verde) e libera a **"Trava de Saída"**.

## 5. Trava de Saída (Desafio de Mutação / Epigenética)
> **Anomalia Detectada na Biópsia Celular #17:**
> Em uma linhagem celular tumoral, um gene supressor de tumor está **completamente silenciado**, embora o sequenciamento mostre que não há nenhuma mutação na sequência de bases do DNA.
>
> **Qual alteração epigenética explica esse silenciamento?**
> - **A)** Hiperacetilação contínua das caudas de histonas por enzimas HAT.
> - **B)** Hipermetilação da ilha CpG do promotor associada à atividade excessiva de HDACs. *(CORRETA)*
> - **C)** Inativação permanente das enzimas HDACs no núcleo.

- **Feedback de Erro:** Relembra que a acetilação (HAT) abre a cromatina para ativar genes, enquanto metilação de promotores e remoção de acetil (HDAC) silenciam a expressão.
- **Feedback de Acerto:** Confirma o conceito de *silenciamento epigenético sem alteração de sequência*, salva a telemetria do Nível 2 e destranca o Nível 3.

## 6. Textos do Manual de Bancada (`chromatinData.ts`)
- **HAT (Histona Acetiltransferase):** Usa Acetil-CoA para adicionar grupos acetil às lisinas das caudas de histonas, neutralizando sua carga positiva e afrouxando a interação com o DNA negativo (gera Eucromatina).
- **HDAC (Histona Desacetilase):** Remove grupos acetil das histonas, restaurando a carga positiva e promovendo a compactação do DNA em Heterocromatina (repressão).
- **Metilação de DNA (Ilhas CpG):** Adição de grupos metil em citosinas do promotor que bloqueia o reconhecimento por fatores de transcrição e recruta proteínas repressoras.
- **Via TET / Reparo de Base (Desmetilação):** Remoção ativa das marcas `Me` (5-metilcitosina) por oxidação sequencial mediada por enzimas TET seguida de reparo por excisão de base (BER) — e não por uma desmetilase direta de passo único — reativando promotores silenciados.
