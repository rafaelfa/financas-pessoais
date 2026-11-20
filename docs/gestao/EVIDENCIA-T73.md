# Evidência da T73 — inventário de capturas

Ficheiro do **Lead**, e por isso em `docs/gestao/`: `relatorios/` é do QA (`AGENTS.md`
§ Quem escreve o quê) e eu não assino provas na pasta de outra pessoa.

Gerado pelo Lead em 2026-11-20, no fecho da T73, depois de a política dos `.png` ter
sido decidida (ver `.gitignore` § «Capturas de evidência»): as imagens **ficam no disco
desta máquina e não entram no índice**, porque o repositório é público (`gh api
repos/rafaelfa/financas-pessoais` → `visibility: public`, `private: false`) e cada captura é
um ecrã com dados. Medido no texto da própria página (`relatorios/.qa-t73/depois.json`,
campo `texto`): numa das quatro configurações lê-se «Televisor 4K (T73)», «Cartão
Millennium» e **10** montantes em euros (36 no ficheiro, que tem as quatro). O
que entra no git é esta tabela: quem quiser confirmar uma captura que viu localmente compara
o SHA-256 contra ela.

Geração:

```powershell
cd relatorios
Get-ChildItem -Filter 'T73-*.png' | ForEach-Object {
  $b = [IO.File]::ReadAllBytes($_.FullName)
  $by = $b[16..19]; [Array]::Reverse($by); $w = [BitConverter]::ToUInt32($by,0)
  $by = $b[20..23]; [Array]::Reverse($by); $h = [BitConverter]::ToUInt32($by,0)
  '| `' + $_.Name + '` | ' + $_.Length + ' | ' + $w + '×' + $h + ' | `' +
    (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower() + '` |'
}
```

## As 10 capturas

| Ficheiro | Bytes | Pixéis (L×A) | SHA-256 |
| --- | --- | --- | --- |
| `T73-antes-cartoes-1440-claro.png` | 272263 | 1440×1567 | `9be76c24bac9ada675fc19c7267fdec6fa12d9169110c1dcd0bc7dfa600fc6f1` |
| `T73-antes-cartoes-390-claro.png` | 177558 | 390×2471 | `f84700f264dc80c49eb8329e385a5d400f0e933d9ab22082252ad8487ceb4e1b` |
| `T73-cartoes-1440-claro.png` | 292719 | 1440×1765 | `0373fe11b110280b83c8a1193ed5a1081a4232358f991abef65e3fc513a6fad5` |
| `T73-cartoes-1440-escuro.png` | 295209 | 1440×1765 | `cc823259e8596f300ad16215702ae0a5cd3c398f2e9992787bf3e1e21b744392` |
| `T73-cartoes-390-claro.png` | 196508 | 390×2669 | `06482e24f044da3a6553ed2ebae571707ed5eb0964df9c7e00414d0051425d9e` |
| `T73-cartoes-390-escuro.png` | 200586 | 390×2669 | `b717871328c98b67bcc033ed0faf12399150562095ed102c135e7ce2eac092cf` |
| `T73-cartoes-1440x900-light.png` | 292719 | 1440×1765 | `0373fe11b110280b83c8a1193ed5a1081a4232358f991abef65e3fc513a6fad5` |
| `T73-cartoes-1440x900-dark.png` | 295209 | 1440×1765 | `cc823259e8596f300ad16215702ae0a5cd3c398f2e9992787bf3e1e21b744392` |
| `T73-cartoes-390x844-light.png` | 196508 | 390×2669 | `06482e24f044da3a6553ed2ebae571707ed5eb0964df9c7e00414d0051425d9e` |
| `T73-cartoes-390x844-dark.png` | 200586 | 390×2669 | `b717871328c98b67bcc033ed0faf12399150562095ed102c135e7ce2eac092cf` |

As capturas estão ordenadas por dono: as duas `antes-` e as quatro sem `x` no nome são do
Dev (`relatorios/T73.md`, linha 110 e linhas 248-251); as quatro com `…-1440x900-…` /
`…-390x844-…` são do QA (`relatorios/T73-QA.md`, linhas 22-26).

## O que esta tabela prova, e o que não prova

**Prova: os quatro pares têm o mesmo SHA-256.**

| Dev | QA | SHA-256 (16 primeiros) |
| --- | --- | --- |
| `T73-cartoes-1440-claro.png` | `…-1440x900-light.png` | `0373fe11b110280b` |
| `T73-cartoes-1440-escuro.png` | `…-1440x900-dark.png` | `cc823259e8596f30` |
| `T73-cartoes-390-claro.png` | `…-390x844-light.png` | `06482e24f044da3a` |
| `T73-cartoes-390-escuro.png` | `…-390x844-dark.png` | `b717871328c98b67` |

**Não prova, sozinha, que o QA voltou a disparar o browser.** Bytes iguais são o que se
obtém de duas corridas determinísticas na mesma máquina — e são exactamente o que se obtém
de um `Copy-Item`. A hash não distingue as duas hipóteses, por isso fui procurar o resto, e
o resto **desfaz a hipótese da cópia**:

| Sinal | Medido |
| --- | --- |
| Guião do claro, criado | `17:04:47` (`relatorios/.qa-t73/t73-playwright.mjs`) |
| Capturas do QA no claro | `17:05:05` e `17:05:08` — 18 s e 21 s **depois** de o guião existir |
| Guião do escuro, criado | `17:05:20` (`t73-playwright-dark.mjs`) |
| Capturas do QA no escuro | `17:05:29` e `17:05:33` — 9 s e 13 s depois de o guião existir |
| Nomes dos ficheiros | Vêm do guião: `` `T73-cartoes-${cfg.label.replace(':','-')}.png` `` (linha 66 / 74) |
| `t73-medicao-QA.json` | Escrito pela linha 83 do guião do claro, às `17:05:08` |

Uma cópia não pode nascer 9 segundos depois do script que lhe inventa o nome. Ecranada a
hipótese do `Copy-Item`, o que sobra é o que parecia: **duas corridas reais, na mesma
máquina e no mesmo browser, a produzir PNG byte a byte iguais.** Nota de leitura: isto só
vale dentro desta máquina. O mesmo ecrã noutro posto (tipos de letra diferentes, outro
GPU) dá hash diferente sem que haja diferença de comportamento — por isso as alíneas da T73
foram assinadas sobre **números do DOM**, não sobre imagens.

Três limitações a ler antes de usar esta tabela, todas medidas por mim hoje:

1. **Não há versão do browser registada.** Os dois guiões fazem `chromium.launch()` sem
   argumentos (`t73-playwright.mjs`:32, `t73-playwright-dark.mjs`:31) e nenhum log grava a
   versão. «Chromium 147» é o que se disse na conversa, não o que está em ficheiro. Sem
   versão fixada, a repetibilidade noutro dia não está garantida. E **o guião do Dev não está
   em disco**: dos cinco `.mjs`/`.mts` que há em `relatorios/.qa-t73/`, nenhum contém a string
   `claro`, pelo que nenhum escreve os nomes `T73-cartoes-1440-claro.png` que ele entregou às
   15:52. O `t73-verifica.mts` (criado às 15:36:14) é o que `T73.md` linha 331 manda correr,
   mas é o que produz `depois.json` com chaves `1440x900:light` — não as imagens. As capturas
   do Dev não têm script que as reproduza. É exactamente o buraco que a condição 2 da T74
   tapou: lá exijo o `t74-varredura.ps1` colado no relatório.
2. **O hash não estava registado em lado nenhum antes desta tabela.** Varri os 24 ficheiros
   de `relatorios/.qa-t73/`: zero ocorrências de uma hash de 64 dígitos. A comparação do QA
   existiu na conversa. Esta tabela fecha isso para o futuro; não reescreve o que foi assinado.
3. **Não abri as imagens.** O que garanto aqui são bytes, dimensões e hash, não conteúdo. O
   conteúdo é afirmado em `T73.md` linha 110 e linhas 248-251 e em `T73-QA.md` linhas 22-26.
   Pelas marcas de tempo: `antes-` às 15:38, Dev às 15:52, QA às 17:05.

## Defeito encontrado ao gerar esta tabela

**A linha 28 de `relatorios/T73-QA.md` aponta para uma prova que só cobre metade da tabela
que sustenta.** As linhas 15-18 afirmam `linhaParcelaN = 6` em **quatro** configurações e o
rodapé diz «Resultado JSON: `relatorios/.qa-t73/t73-medicao-QA.json`». Esse JSON tem **duas**
chaves: `1440x900:light` e `390x844:light`. As duas linhas `dark` não estão lá.

O que apurei, para não ficar na suspeita:

| Hipótese | Teste | Resultado |
| --- | --- | --- |
| Os números `dark` são inventados | Ler `t73-playwright-dark.mjs` | **Não.** O guião mede (`page.evaluate`, linhas 7-21) e escreve as contagens no stdout (linhas 61-64) |
| O guião do escuro grava ficheiro | Procurar `writeFile` nele | **Não grava JSON nenhum** — só a captura, linha 66. As contagens do `dark` viveram num terminal que ninguém gravou |
| Há prova em ficheiro para o `dark` | `depois.json` do Dev | Só o do Dev, com as 4 chaves (`linhaParcelaN: 6` nas quatro) — e é a medição de outro agente |

Ou seja: o número tem origem numa corrida real, e o que falta é **a procedência arquivada**. Emenda
pedida ao próprio QA na linha 28 (é a assinatura dele, não a minha). Nada no código da T73
depende disto: o critério 1 foi assinado sobre as contagens, e as contagens `light` estão no
JSON com os mesmos 6.

