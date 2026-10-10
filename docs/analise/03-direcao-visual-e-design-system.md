# R3 — Direção visual 2026 e design system

> `docs/analise/03-direcao-visual-e-design-system.md` · autor: **designer-ux** (`task-3`) · 2026-10-10 · fuso de referência **Europe/Lisbon**
> Estado: proposta para decisão do Lead + cliente. Convenções: **[FACTO]** verificado (ficheiro lido, medição local ou fonte citada) · **[INFERÊNCIA]** leitura de produto/design a partir de material público · **DECISÃO PROPOSTA** a fechar com o cliente · **[verificado npm]** versão consultada no registo npm em 2026-10-10.

## 0. Restrições herdadas e ponto de partida
| # | Decisão do Lead | Impacto |
|---|---|---|
| D1 | **pt-PT + EUR** principais; BRL/pt-BR só como nota | §9.2–9.3 são o caminho principal; §9.4 é compatibilidade marcada, não cenário |
| D2 | **Utilizador único, login simples** (sem famílias/workspaces) | Sem *switcher* de espaço, sem papéis/permissões, menu de avatar reduzido a perfil/preferências/exportar/sair |
| D3 | **Web responsiva + PWA instalável** | Obrigatório funcionar de **360 px** a **1440 px+**; bottom nav mobile, sidebar desktop, manifest e offline shell (§10.3) |
| D4 | **Dark mode incluído** | Tema desenhado **a partir do dark**, não como inversão (§4.3) |

Base concreta lida em `apps/web`: `globals.css` com Tailwind v4, `@theme inline`, tokens em **oklch**, `@custom-variant dark (&:is(.dark *))`, raios derivados de `--radius` e `--chart-1..5` **a cinzentos** (`oklch(0.87 0 0)`…`oklch(0.269 0 0)`) — logo **sem semântica**. `components.json`: `style: "radix-nova"`, `baseColor: "neutral"`, `iconLibrary: "lucide"`. Já instalados: `button, card, input, label, textarea, select, checkbox, dropdown-menu, separator, badge, skeleton, tabs, tooltip, avatar, dialog`. Dependências: `next 16.4.0`, `react 19.3.0`, `tailwindcss 4.3.3`, `shadcn ^4.21.4`, `radix-ui ^1.7.0`, `lucide-react ^1.53.0`, `next-themes ^0.4.6`, `tw-animate-css ^1.4.0` **[FACTO — package.json]**.
**Diagnóstico:** a base técnica está pronta e moderna; falta **identidade** e **linguagem semântica de dinheiro**. É isso que esta proposta entrega.

## 1. Direção visual recomendada (3 frases + princípios)
1. **"Confiança portuguesa, não banco genérico."** Sair do azul institucional e assumir um **verde-água profundo (verdigris, hue 190)** como marca — europeu, calmo, associado a rigor — sobre **fundo papel quente** `oklch(0.99 0.004 95)` em vez de branco puro, reduzindo fadiga em sessões longas de consulta.
2. **"O número é o herói, o cromo é silencioso."** Densidade calibrada, cartões com contorno de 1 px e sombra mínima, `tabular-nums` em todos os valores, e **cor reservada exclusivamente a significado financeiro** (receita, despesa, alerta, meta).
3. **"Dark-first, mobile-first, teclado-first."** O escuro é desenhado primeiro (fundo `oklch(0.19 0.015 250)`, elevação por luminosidade, contornos em vez de sombras), o layout nasce a 360 px e cresce a 1440 px+, e toda a ação frequente tem atalho.
Nome de trabalho do sistema: **"Maré"** (não aparece ao utilizador; serve para nomear tokens na documentação).

| Princípio | Regra |
|---|---|
| P1 Número primeiro | Se o ecrã não responde a "quanto tenho / gastei / falta" em <2 s, está errado |
| P2 Cor é significado | Só verde, vermelho, âmbar, violeta e azul têm semântica fixa; uso decorativo proibido em superfícies de dados |
| P3 Nunca só cor | Todo o estado tem **sinal (+/−)**, **ícone** e **etiqueta textual** (WCAG 1.4.1) |
| P4 Editar sem medo | Destrutivo ou é reversível (*undo*) ou exige confirmação nominal; nunca se perdem dados |
| P5 Zero estados mortos | Cada lista/gráfico tem vazio com ação, *skeleton* com a forma final e erro com repetição |
| P6 360 px é primeira classe | O wireframe mobile é desenhado primeiro; nada de "espremer" desktop |
| P7 Local por omissão | pt-PT, EUR, Europe/Lisbon, semana a começar à segunda — assume-se, não se pergunta |

## 2. Benchmark visual (8 referências)
> Observações de **design/produto** a partir de material público ([INFERÊNCIA]); não houve auditoria de tokens de terceiros.

| # | Referência | Copiar | Não copiar | URL |
|---|---|---|---|---|
| B1 | Monarch Money | Dashboard modular com *hero* de património; resumo mensal entrou/saiu/sobrou com delta vs mês anterior; período persistente no cabeçalho | Excesso de cartões a competir pelo topo; onboarding longo | [monarchmoney.com](https://www.monarchmoney.com/) |
| B2 | Copilot Money | Polimento: ícones de comerciante, transições 120–180 ms, seleção inequívoca, raios generosos | Animações decorativas; categorização opaca ao utilizador | [copilot.money](https://copilot.money/) |
| B3 | YNAB | Semântica de envelope com **cores de estado** (verde/âmbar/vermelho), "para atribuir" sempre visível, ensina o modelo | Jargão próprio e curva de aprendizagem; empty states moralistas | [ynab.com](https://www.ynab.com/) |
| B4 | Actual Budget | Melhor referência para a **tabela**: grelha densa, edição inline, atalhos, filtros em chips | UI datada nalguns ecrãs; tipografia pequena e plana | [actualbudget.org](https://actualbudget.org/) |
| B5 | Firefly III | Motor de regras legível (condição → ação); relatórios configuráveis | Configuração em excesso à frente do utilizador comum | [firefly-iii.org](https://www.firefly-iii.org/) |
| B6 | Linear | Densidade com respiração, **command palette** (⌘K) como porta principal, sidebar compacta, dark de primeira classe | Estética "developer tool"; atalhos sem descobribilidade | [linear.app](https://linear.app/) |
| B7 | Wise / Revolut | Hierarquia de montantes (número grande, moeda pequena), feedback de cálculo imediato, teclado numérico | *Marketing chrome* dentro da app; gamificação com notificações | [wise.com](https://wise.com/) · [revolut.com](https://www.revolut.com/) |
| B8 | Nubank | Tratamento de **cartões e faturas** (fechada vs aberta, limite, parcelamentos) — linguagem que o cliente já conhece | Gradientes saturados e ilustrações grandes num produto de dados | [nubank.com.br](https://nubank.com.br/) |

Apoio: [Vercel Geist](https://vercel.com/geist/introduction) (tokens neutros), [Mobbin](https://mobbin.com/) (padrões reais), [shadcn/ui Charts](https://ui.shadcn.com/docs/components/radix/chart), [oklch.com](https://oklch.com/).
**Síntese:** o que distingue as boas apps não é a paleta, é a **disciplina semântica**; o ecrã mais importante é a **tabela**; e todas falham no mesmo sítio (onboarding longo + categorização opaca), que é onde ganhamos (§7.7–7.8).

## 3. Tendências 2025/2026 aplicáveis (e recusas)
| Tendência | Aplicamos? | Como |
|---|---|---|
| Bento grid modular | Parcial | Só no Painel, máx. 6 cartões acima da dobra, grelha de 12 col.; em ecrãs de dados usam-se listas/tabelas. O *anti-bento* tem razão quando a grelha esconde a hierarquia ([superfiles.in](https://www.superfiles.in/anti-bento-grid-8-scenarios.php)) |
| Dark mode first | Sim | Desenhado primeiro; não é inversão (§4.3) |
| Profundidade subtil em vez de glassmorphism | Sim, com limites | *Blur* só em cabeçalho *sticky*, dialogs/sheets e tab bar mobile — **nunca** em cartões de dados |
| Tipografia funcional, números tabulares | Sim | Inter var + `tabular-nums`; escala 12→48 px com *tracking* negativo nos grandes |
| Densidade calibrada | Sim | Duas densidades: confortável (44 px de linha) e compacta (32–36 px, comutável em Transações) |
| Micro-interações funcionais | Sim | 100–220 ms com propósito; desligadas em `prefers-reduced-motion` (§4.8) |
| WCAG 2.2 AA como requisito | Sim | Texto ≥4,5:1, não-texto ≥3:1, alvos ≥24 px (2.5.8), foco visível. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) |
| Empty states e skeletons | Sim | 4 estados obrigatórios por ecrã (§7.6) |
| Mobile-first + PWA | Sim (D3) | manifest, ícones maskable, `standalone`, `100dvh`, safe areas, offline shell ([web.dev/learn/pwa](https://web.dev/learn/pwa/)) |
| Chat/IA no produto | Não | Sugestão de categoria explícita e corrigível, nunca decisão invisível nem chat |
| Gradientes grandes e ilustrações saturadas | Não | Comprometem contraste e envelhecem depressa |

## 4. Design system
### 4.1 Método de cor
Tudo em **oklch** como o ficheiro atual (percetualmente uniforme, estados derivam por variação previsível de `L`/`C`) — [MDN `oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch), [Tailwind theme variables](https://tailwindcss.com/docs/theme). **Contraste medido, não estimado:** todos os valores foram convertidos oklch→sRGB e o rácio WCAG calculado localmente (2026-10-10); alvos **texto ≥4,5:1**, **gráficos/ícones/contornos ≥3:1**. Oklch exige Chrome 111+/Safari 15.4+/Firefox 113+ — os mesmos browsers que o Tailwind v4 já exige, logo sem custo adicional para o alvo PWA.

### 4.2 Tema claro ("papel")
| Token | oklch | Hex | Contraste | Uso |
|---|---|---|---|---|
| `--background` | `0.99 0.004 95` | `#fcfcf9` | — | Fundo da app (papel quente) |
| `--foreground` | `0.22 0.015 250` | `#151b21` | 16,81:1 | Texto principal |
| `--card` / `--popover` | `1 0 0` | `#ffffff` | — | Superfícies elevadas |
| `--primary` | `0.47 0.09 190` | `#006a66` | 6,25:1 | Marca, botão primário, links, série de destaque |
| `--primary-foreground` | `0.99 0.01 190` | `#f6fcfb` | 6,43:1 sobre primary | Texto em botão primário |
| `--secondary` / `--muted` | `0.96 0.008 200` / `0.965 0.006 200` | — | — | Botões secundários, fundos neutros |
| `--muted-foreground` | `0.50 0.02 250` | `#5b646f` | 5,82:1 | Texto secundário, legendas |
| `--accent` | `0.94 0.03 75` | — | — | Hover (âmbar muito claro) |
| `--border` = `--input` | `0.90 0.01 220` | `#d7e0e3` | 1,31:1 | Contornos (não é texto) |
| `--ring` | `0.47 0.09 190` | `#006a66` | 6,25:1 | Foco (= primary, por coerência) |
| `--sidebar` | `0.975 0.006 200` | — | — | Navegação |

**Texto em âmbar:** `--warning` no claro tem só **3,11:1** → válido para gráficos/ícones, **não para texto**; para texto usa-se `--warning-foreground: oklch(0.55 0.13 70)` (`#a16100`, **4,84:1**). Idem `--accent` decorativo → texto `oklch(0.50 0.11 60)` (**6,03:1**).

### 4.3 Tema escuro ("maré") — desenhado primeiro
| Token | oklch | Contraste |
|---|---|---|
| `--background` | `0.19 0.015 250` (`#0f141a`) | — |
| `--foreground` | `0.97 0.005 250` (`#f3f5f8`) | 16,93:1 |
| `--card` | `0.235 0.016 250` | fg sobre card 15,28:1 |
| `--popover` | `0.26 0.016 250` | superfície flutuante acima do card |
| `--primary` = `--ring` | `0.72 0.11 185` (`#3dbbae`) | 7,82:1 |
| `--secondary` | `0.28 0.018 250` | — |
| `--muted-foreground` | `0.70 0.02 250` (`#95a0ab`) | 6,92:1 |
| `--border` | `0.32 0.015 250` (`#2d343a`) | 1,46:1 |

Regras: (1) **sem sombras** — elevação por 3 níveis de superfície (L .19 → .235 → .26) + contorno; (2) **contornos em vez de manchas** (nunca `oklch(1 0 0 / 10%)` em áreas grandes, como o ficheiro atual faz em `--border`); (3) séries de gráfico com L ≥ 0,72 para ≥3:1 sobre escuro; (4) `--primary` só como acento, nunca fundo de cartões inteiros.

### 4.4 Tipografia
| Aspeto | Especificação |
|---|---|
| Famílias | `--font-sans`: **Inter Variable** via `next/font` (self-hosted, `swap`, subsets `latin`+`latin-ext`); alternativa **Geist Sans**. `--font-mono` só para IDs/valores técnicos, nunca montantes |
| Números | `font-variant-numeric: tabular-nums` **obrigatório** em tabelas, KPIs, gráficos e listas de valores |
| Escala | 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 38 / 48 px; `line-height` 1.15 (títulos), 1.35 (corpo), 1.5 (texto longo); `letter-spacing` −0.02em a partir de 24 px |
| Pesos | 400 corpo · 500 etiquetas/UI · 600 títulos e números · 700 raro (só *hero* de saldo) |
| Regra do montante | Hero: 38–48 px/600 + símbolo a 60% em `--muted-foreground`. Cartão: 20–24 px/600. Tabela: 14 px/500 tabular |
| Maiúsculas | Só em etiquetas de secção (12 px, `tracking .06em`, `--muted-foreground`); nunca em valores nem botões |
| Correção necessária | `--font-heading: var(--font-sans)` com `--font-sans: var(--font-sans)` está **auto-referente** — corrigir no Apêndice A (uma só família + pesos resolve) |

### 4.5 Cores semânticas financeiras (núcleo do sistema)
| Semântica | Claro | Contraste | Escuro | Contraste |
|---|---|---|---|---|
| **Receita / entrada** `--income` | `0.52 0.11 155` `#267b4c` | 5,07:1 | `0.78 0.13 155` `#6cd092` | 9,71:1 |
| **Despesa / saída** `--expense` | `0.55 0.20 25` `#cc272e` | 5,23:1 | `0.72 0.15 25` `#f47b74` | 6,97:1 |
| **Alerta** `--warning` | `0.66 0.15 70` `#cb7f00` | 3,11:1 (não-texto) | `0.82 0.13 80` `#f0ba59` | 10,45:1 |
| **Alerta (texto)** `--warning-foreground` | `0.55 0.13 70` `#a16100` | 4,84:1 | = `--warning` | — |
| **Meta/investimento** `--goal` | `0.50 0.16 285` `#5d4fb9` | 6,19:1 | `0.76 0.12 285` `#a9a6fa` | 8,36:1 |
| **Informativo/previsão** `--info` | `0.52 0.13 245` `#036eae` | 5,31:1 | `0.76 0.10 245` `#79b8ed` | 8,68:1 |
| **Transferência** `--neutral-amount` | `0.55 0.02 250` `#69737d` | 4,71:1 | `0.70 0.02 250` | 6,92:1 |
| **Erro de sistema** `--destructive` | `0.55 0.20 25` | 5,23:1 | `0.70 0.19 22` | — |

Regras não negociáveis: (1) **saldo positivo ≠ receita** — saldo positivo usa `--foreground` (ou `--income` se comunica variação); negativo usa `--expense` **+ sinal `−` + ícone**; (2) **orçamento tem 3 estados** — seguro (<70%, neutro), atenção (70–99%, `--warning`), excedido (≥100%, `--expense`), sempre com texto ("82% de 600 €") e ícone; (3) **transferência nunca é receita nem despesa** (cor neutra e fora dos totais de fluxo); (4) **previsto vs realizado** = mesma cor, com o previsto a 45% + linha tracejada; (5) nunca verde/vermelho adjacentes como único diferenciador.

### 4.6 Paleta de gráficos (segura para daltonismo)
Critérios: ≥3:1 sobre o fundo em ambos os temas (1.4.11); as 4 primeiras séries distintas em deuteranopia/protanopia (azul, âmbar, violeta, verde-azulado), evitando pares vermelho/verde adjacentes; **nunca só cor** — legenda com símbolo, etiquetas diretas e opção "tabela de dados" em cada gráfico.
| # | Claro | Hex | Contraste | Escuro | Hex | Contraste |
|---|---|---|---|---|---|---|
| `--chart-1` | `0.55 0.13 250` | `#2a75ba` | 4,71:1 | `0.76 0.10 250` | `#7fb6ee` | 8,65:1 |
| `--chart-2` | `0.62 0.14 70` | `#bb7400` | 3,64:1 | `0.80 0.12 75` | `#ebb25f` | 9,73:1 |
| `--chart-3` | `0.52 0.16 290` | `#6a53bd` | 5,70:1 | `0.74 0.12 290` | `#aa9df1` | 7,75:1 |
| `--chart-4` | `0.55 0.12 155` | `#258651` | 4,45:1 | `0.78 0.11 155` | `#7bcc98` | 9,64:1 |
| `--chart-5` | `0.58 0.17 25` | `#cb4644` | 4,53:1 | `0.74 0.13 25` | `#f28881` | 7,58:1 |
| `--chart-6` | `0.58 0.11 200` | `#008d94` | 3,89:1 | `0.78 0.09 200` | `#6ac9ce` | 9,55:1 |
| `--chart-7` | `0.55 0.15 330` | `#a04c9a` | 5,11:1 | `0.76 0.11 330` | `#d997d2` | 8,19:1 |
| `--chart-8` | `0.58 0.12 105` | `#857d0b` | 4,11:1 | `0.80 0.11 110` | `#c2c46e` | 10,04:1 |

**Mapeamento fixo de séries** (o utilizador aprende as cores uma vez): receita → `--income`; despesa → `--expense`; saldo acumulado → `--chart-1`; poupança/meta → `--goal`; categorias genéricas → `--chart-1..8` por ordem; previsão → série base a 45% tracejada (não gasta cor nova).
**Acessibilidade:** wrapper com `role="img"` e `aria-label` que resume o resultado ("despesas de outubro de 2026: 1 842,30 €, mais 12% que setembro"), tooltip navegável por teclado (←/→), tabela alternativa em `<details>`, animações desligadas com `prefers-reduced-motion`.

### 4.7 Espaçamento, grelha e raios
Base **4 px** (grelha 8 px). Escala: 4/8 (dentro de componentes), 12/16 (linhas e *chips*), 20/24 (padding de cartão: 24 desktop, 16 mobile), 32/40 (entre secções), 64 (topo de página desktop).
| Largura | Comportamento |
|---|---|
| **360–479 px** | 4 col., gutter 16, margem 16. Sem tabelas: **listas de cartões**; bottom nav (5 destinos); dialogs → bottom sheets |
| 480–767 px | 4 col., margem 20; gráficos 100% com 200–240 px de altura |
| 768–1023 px | 8 col., margem 24; sidebar colapsada em ícones (64 px) ou topbar; tabela com colunas essenciais |
| 1024–1439 px | 12 col., sidebar 240 px, conteúdo máx. 1100 px; tabela completa com edição inline |
| ≥1440 px | 12 col., sidebar 260 px, conteúdo máx. **1280 px** centrado; terceira coluna de contexto; densidade confortável |

Raios: manter o esquema multiplicativo atual e mudar a base → `--radius: 0.75rem` (12 px); `sm` ≈7 px (chips/badges), `md` ≈10 px (botões/campos), `lg` = 12 px (cartões), `xl` ≈17 px (cartões *hero*, sheets).

### 4.8 Sombras, elevação e movimento
| Nível | Especificação | Uso |
|---|---|---|
| `e0` | contorno 1 px `--border`, sem sombra | Cartões de dados (padrão) |
| `e1` | `0 1px 2px oklch(0.22 0.02 250 / 6%)` | Cartões interativos, hover |
| `e2` | `0 4px 12px oklch(0.22 0.02 250 / 8%)` | Dropdowns, popovers |
| `e3` | `0 12px 32px oklch(0.22 0.02 250 / 14%)` + overlay `oklch(0.19 0.02 250 / 45%)` | Dialogs e sheets |

Movimento: `fast` 100 ms (`ease-out`) em hover/focus · `base` 150 ms `cubic-bezier(0.2,0,0,1)` em dropdowns/tabs/chips · `slow` 220 ms na mesma curva em sheets/dialogs/transição de gráfico · opcional `number` 400 ms na contagem de valores. `prefers-reduced-motion` → 0,01 ms e animações de gráfico desligadas (o estado muda, só não anima).

## 5. Bibliotecas: gráficos e tabelas
Requisitos reais: SSR/streaming sem erro de hidratação, área/linha/barra/donut, tooltips com os nossos tokens, 5–15 mil pontos por gráfico (não *big data*), acessibilidade, bundle contido e integração com Tailwind 4 + Radix.
| Biblioteca | Versão | React 19 / Next 16 | Prós | Contras | Veredicto |
|---|---|---|---|---|---|
| **Recharts** | **3.10.1** **[verificado npm]** (`peer react ^16.8‖17‖18‖19`) | ✅ declarado; a 3.x corrigiu os problemas de React 19/Next reportados nas 3.0.x ([#6578](https://github.com/recharts/recharts/issues/6578), [#6316](https://github.com/recharts/recharts/issues/6316)) | Integração **de primeiro nível com shadcn/ui** (`chart`, `ChartContainer`, `ChartTooltip`, `ChartLegend`) que lê `--chart-N` automaticamente; SVG (bom para a11y e CSS vars); tooltips/legendas prontos | SVG perde para canvas acima de ~50 mil pontos; API de tooltip verbosa | **ESCOLHIDA** |
| visx | série 3.x/4.x modular | ✅ | Primitivos D3 com controlo total, bundle mínimo | Legendas, tooltips, responsividade, vazios e skeleton são trabalho nosso — semanas de UI | Rejeitada (custo) |
| ECharts + `echarts-for-react` | `echarts 6.x`; wrapper `3.0.6` **[verificado npm]** | ⚠️ wrapper declara `react ≥16` e sem releases recentes; SSR exige `dynamic(ssr:false)` | Canvas rápido, tipos de gráfico completos, animações | Bundle grande, wrapper pouco mantido, theming fora do Tailwind (duplicar tokens), a11y fraca | Rejeitada |
| Nivo | `@nivo/core 0.99.0` **[verificado npm]** | ✅ declarado | Bonito por omissão, muitos tipos, temas por objeto | Um pacote por gráfico, puxa d3/lodash/react-spring, 0.x sem garantias semver, temas em JS e não CSS vars | Rejeitada |
| Chart.js + react-chartjs-2 | `chart.js 4.5.1` **[verificado npm]** | ✅ | Canvas rápido, muito conhecido, plugins maduros | Canvas pior para a11y/CSS vars; tooltips/legendas HTML a construir; estética distante do shadcn | Rejeitada |
| Tremor | [tremor.so](https://www.tremor.so/) | ✅ nas versões recentes | Cartões KPI e gráficos prontos, muito adequados a finanças | Sobrepõe-se ao shadcn (dois sistemas de cartões); parte do valor em blocks pagos | Só como inspiração |
| `@tanstack/react-charts` | `1.1.0` **[verificado npm]** (`peer react ^18‖19`) | ✅ | Novo, tree-shakable, alinhado com o stack TanStack | 1.x muito jovem, sem integração shadcn | A vigiar, não agora |

**[FACTO]** O shadcn/ui publica o componente [`chart`](https://ui.shadcn.com/docs/components/radix/chart) para o estilo `radix` (o nosso), construído sobre Recharts e exposto por `--chart-1..N` — exactamente o mecanismo já usado em `globals.css`.
**DECISÃO PROPOSTA D5 — gráficos: `recharts@^3.10` [verificado npm], consumido via `chart` do shadcn** (o componente é copiado para `src/components/ui/chart.tsx`). Consequências: todos os gráficos são *client components*; isolar cada gráfico num ficheiro e envolvê-lo em `<Suspense>` com *skeleton*; formatar datas no servidor para `{label, value}` simples (evita divergência de locale/hidratação); **não** adicionar uma segunda biblioteca de gráficos.

| Opção de tabela | Versão | Prós | Contras | Veredicto |
|---|---|---|---|---|
| **TanStack Table** (`@tanstack/react-table`) | **9.2.8** **[verificado npm]** (`peer react >=18`, ESM, com entrada `./legacy` para compat. v8) | *Headless*: controlamos markup (shadcn `table` + Tailwind); sorting/filtering/grouping/pinning/seleção/virtualização; o mesmo motor serve tabela desktop e lista mobile ([docs](https://tanstack.com/table/latest)) | Não traz UI/estilo (mas já temos `table` e o block `data-table`); v9 é recente | **ESCOLHIDA** |
| AG Grid Community | 3x | Funcionalidades empresariais completas | Peso, tema próprio a combater com Tailwind, licenciamento de features | Rejeitada |
| shadcn `data-table` (exemplo) | — | Demonstra TanStack + shadcn | É exemplo, não biblioteca | Forma de adoção |

**DECISÃO PROPOSTA D6 — tabelas: `@tanstack/react-table@^9.2` [verificado npm]** + `table` do shadcn, com `@tanstack/react-virtual@^3` quando o mês tiver >300 linhas. Guia de migração v9 ([docs](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)); plano B `^8.21` sem alterar o design.
**Outras dependências de UI** (versões alvo): `date-fns ^4` (locale pt) · `react-day-picker ^9` · `sonner ^2` (**substitui o `toast`**, depreciado — [issue #7120](https://github.com/shadcn-ui/ui/issues/7120)) · `vaul ^1` · `cmdk ^1` · `react-hook-form ^7` + `zod` (**mesma versão do `packages/shared`**, ver doc 02) + `@hookform/resolvers ^5` · opcional `number-flow` 0.x (**confirmar versão na instalação**). Mantêm-se `radix-ui ^1.7`, `lucide-react ^1.53`, `next-themes ^0.4.6`, `tw-animate-css ^1.4`.

## 6. Inventário de componentes
**A instalar (shadcn/ui), além dos 15 existentes:** `table` + block `data-table` e `chart` (estruturantes) · `sidebar`, `sheet`, `drawer`, `breadcrumb`, `pagination`, `scroll-area`, `collapsible` (navegação e estrutura) · `sonner`, `alert`, `alert-dialog`, `tooltip`, `popover`, `hover-card`, `command`, `combobox`, `dropdown-menu` (feedback e seleção) · `calendar`, `date-picker`, `field`, `input-group`, `switch`, `slider`, `checkbox`, `progress`, `tabs`, `badge`, `item`, `kbd`, `empty`, `separator`, `skeleton`, `avatar`, `card`, `button`, `input`, `label`, `textarea`, `select`, `dialog`.
| Ecrã | shadcn usado | Construir à medida |
|---|---|---|
| Painel | `card`, `chart`, `tabs`, `badge`, `skeleton`, `tooltip`, `alert`, `empty` | `BalanceHero`, `KpiCard` (rótulo/valor/delta/ícone/tom), `NetWorthChart`, `CashflowBars`, `CategoryDonut`, `ChartCard` (moldura com título, seletor de série, "tabela de dados", vazio, skeleton) |
| Transações | `table`+`data-table`, `pagination`, `popover`, `combobox`, `calendar`, `checkbox`, `dropdown-menu`, `badge`, `kbd`, `drawer`/`sheet` | `TransactionTable` (TanStack), `TransactionRow`, `FilterChips`, `PeriodFilter`, `QuickEntrySheet`, `MoneyInput`, `Amount`, `UndoToast`, `ImportDropzone` (OFX/CSV) |
| Orçamento | `progress`, `popover`, `slider`, `input-group`, `collapsible`, `alert` | `BudgetProgressRow` (3 estados + projeção + ajustar), soma mensal, projeção de fim de mês |
| Objetivos | `progress`, `drawer`, `slider`, `badge` | `GoalCard` (anel/barra, contribuição, data prevista recalculada ao vivo), progresso agregado |
| Contas | `card`, `item`, `badge`, `dropdown-menu` | `AccountCard` (tipo, saldo, última conciliação, tom) |
| Recorrentes | `item`, `badge`, `alert`, `tabs` | `RecurringList` (pago/previsto/atrasado, "marcar como pago") |
| Global | `command`, `kbd`, `empty`, `sonner`, `breadcrumb`, `switch` | `CommandPalette` (⌘K), `CategoryPicker` (árvore + criação inline), `EmptyState`, `Amount` (montante com sinal/tom/aria-label falado), `MoneyInput` |

`MoneyInput` (o componente mais crítico): `inputMode="decimal"`, aceita `12,5`, `12.5` e `1 234,56`, mostra sempre o formato pt-PT ao sair do campo, suporta cálculo inline (`+ − × ÷`, parênteses) **sem `eval`**, `Enter` guarda, `Esc` cancela, e um erro de expressão nunca apaga o valor anterior.

## 7. Padrões de interação obrigatórios
### 7.1 Lançamento rápido (fluxo mais usado)
Abre com **`N`** (ou `+` na bottom bar) em qualquer ecrã: *dialog* centrado em desktop, *bottom sheet* em mobile. Ordem de foco **Valor → Descrição → Categoria → Conta → Data** (data = hoje). Valor com **cálculo inline** (`24,90 + 3,50` → `28,40 €`) e resultado em tempo real. `⌘/Ctrl+Enter` guarda; `⌘/Ctrl+Shift+Enter` **guarda e cria outro** (mantém tipo, conta e data); `Esc` fecha com aviso se houve edição. Após guardar: toast de 1 linha com ação **"Desfazer"** (5 s) e atualização otimista do saldo/painel. Tipo (Despesa/Receita/Transferência) em *segmented control* acessível — a cor muda como reforço, o rótulo é sempre legível.
### 7.2 Teclado
`⌘K` command palette · `N` novo lançamento · `G`+`D`/`T`/`O`/`M`/`C` Painel/Transações/Orçamento/Metas/Contas · `/` pesquisa · `J`/`K` linha seguinte/anterior · `Enter`/`E` abrir ou editar inline · `X` selecionar (`Shift` = intervalo) · `⌫` eliminar (com undo) · `Alt+←/→` período anterior/seguinte · `?` painel de atalhos (componente `kbd`). Regras: atalhos de uma letra ignorados com foco em campo de texto; todos têm equivalente por botão/menu; `?` é a fonte de verdade e está ligado no menu do avatar.
### 7.3 Filtros, período e drill-down
Período **sempre visível** no cabeçalho, nunca escondido. Estado de filtros **no URL** (`?period=2026-10&cat=supermercado&account=ctt`) para voltar atrás e partilhar funcionarem; presets são atalhos para o mesmo estado. Chips removíveis + "limpar tudo" + contagem ("142 lançamentos"); remover um filtro nunca faz *reset* aos outros. **Drill-down:** clicar numa fatia/barra navega para a lista filtrada com `breadcrumb` (`Painel / Despesas / Supermercado`) e período preservado. Zero resultados → vazio contextual com "limpar filtros".
### 7.4 Edição inline
Duplo clique (ou `E`) transforma a célula em campo; `Tab` avança, `Enter` confirma, `Esc` cancela. Validação local imediata (valor > 0, data válida, categoria existente) com erro de 1 linha **sem** fechar o editor. Escrita **otimista** com rollback e toast de erro. Editar afeta orçamento/metas sem recarregar o ecrã. Ações em lote (categoria, conta, data) com pré-visualização "N lançamentos serão alterados".
### 7.5 Confirmações, toasts e erros
**Preferir desfazer a confirmar:** eliminar é reversível (*soft delete*) + toast "Desfazer" 5 s com temporizador visível. `alert-dialog` só para o **irreversível** (apagar conta com lançamentos, apagar todas as categorias, repor dados). Confirmação **nominal** (escrever o nome) só em "apagar conta com N lançamentos". Botão destrutivo sempre em `--destructive` com rótulo explícito ("Apagar 12 lançamentos") e nunca como ação por omissão do `Enter`. Toasts: `sonner`, 1 por ação, máx. 3 em pilha, `role="status"`, canto inferior-direito (desktop) / centro (mobile); erro sempre com "Tentar de novo". Erros de formulário junto ao campo + resumo no topo com foco no primeiro erro, **sem perder os dados escritos**.
### 7.6 Estados
| Estado | Regra |
|---|---|
| Vazio (1.ª utilização) | Ícone discreto, título afirmativo ("Ainda não há lançamentos"), 1 linha, **uma** ação primária; opcional "carregar exemplo" / "importar ficheiro" |
| Vazio (por filtro) | Mensagem contextual com o filtro ativo + "limpar filtros" |
| Carregando | *Skeleton* com a **forma do conteúdo final** (mesmo nº de linhas/cartões), nunca spinner centrado; em streaming SSR, `<Suspense>` por cartão |
| Erro | `alert` inline com causa simples + "Tentar de novo"; se for parcial, o resto do ecrã continua funcional |
| Offline | Banner fino persistente + dados em cache com marca temporal; lançamento continua possível e fica em fila (§10.3) |
### 7.7 Onboarding (3 passos, sem bloqueios)
(1) Boas-vindas com `Português (Portugal) · EUR € · Europe/Lisbon` **já preenchido** e link "alterar"; (2) primeira conta com saldo inicial via `MoneyInput`; (3) primeiro lançamento real, mostrando o atalho `N`. Progresso discreto (3 pontos), "saltar" em todos os passos e *checklist* opcional no Painel (definir orçamento, criar meta, importar extrato) que desaparece ao concluir ou dispensar. Nenhum pedido de notificações/instalação no onboarding; a sugestão de instalar PWA surge após a **segunda** sessão.
### 7.8 Categorização assistida (transparente)
Sugestões aparecem como *chip* com etiqueta "sugerido" e um clique para corrigir; a correção gera uma regra visível em "Regras" (condição → ação, inspirado em [Firefly III](https://www.firefly-iii.org/)). Nunca categorizar em silêncio nem criar regras invisíveis.

## 8. Wireframes dos 4 ecrãs-chave
`▢` cartão · `◉` indicador · `⌄` dropdown · `[ ]` botão · `＋` novo lançamento.
### 8.1 Painel
```text
DESKTOP ≥1024 · 12 col · sidebar 240 · conteúdo máx 1280
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ MARÉ         │ Outubro 2026 ‹ ›  [Este mês ⌄]           ⌘K  🔍  ↻  ◉ avatar ⌄                │
│ ◉ Painel     ├──────────────────────────────────────────────────────────────────────────────┤
│   Transações │ ▢ PATRIMÓNIO 12 480,32 €        ▢ ENTRADAS      ▢ SAÍDAS                      │
│   Orçamento  │   ▲ +340,10 € vs setembro         +2 150,00 €    −1 842,30 €                  │
│   Objetivos  │   ╭─╮ sparkline 30 d              ▲ +3,2%        ▼ −12,0%                    │
│   Contas     │   ╰─╯                                                                            │
│   Relatórios │ ▢ SOBRA ESTE MÊS 307,70 €       ▢ ORÇAMENTO 78%  ▢ METAS ◉ Férias 62%        │
│   Recorrentes│   4 300 orçado · 3 992 gasto     ▓▓▓▓▓▓▓░░░       ▓▓▓▓▓▓░░░░ 4 200/6 800      │
│              │   ⚠ 3 categorias em risco        3 em risco →     previsão jul 2027           │
│ ─────────────│ ▢ FLUXO MENSAL 6 MESES ▂▅▃▆▄█   ▢ DESPESAS POR CATEGORIA ◕ donut + legenda   │
│ ＋ Novo   N  │   [Realizado | Previsto]  ⓘ tab  casa 32% · comida 21% → clique = detalhe   │
│              │ ▢ PRÓXIMOS 7 DIAS  ◉ renda 850 € (dia 1) · ◉ Netflix 12,99 € (dia 5)         │
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
MOBILE 360 · bottom nav, sem sidebar
┌──────────────────────────────┐
│ Outubro 2026 ⌄        🔍  ◉ │
│ ▢ PATRIMÓNIO                 │
│   12 480,32 €                │
│   ▲ +340,10 €  ╭─╮           │
│ ▢ ENTRADAS    +2 150,00 € ▲  │
│ ▢ SAÍDAS      −1 842,30 € ▼  │
│ ▢ SOBRA 307,70 € ⚠ 3 risco   │
│   ▓▓▓▓▓▓▓▓░░ 78% orçamento   │
│ ▢ FLUXO 6 MESES ▂▅▃▆▄█       │
│   [Realizado|Previsto]       │
│ ▢ CATEGORIAS ◕ + legenda     │
│ ▢ PRÓXIMOS 7 DIAS renda 850 €│
├──────────────────────────────┤
│ ⌂    ≡     ＋     ◔     ⚙    │  ⌂ início · ≡ transações · ＋ novo (sheet)
└──────────────────────────────┘  ◔ orçamento · ⚙ mais
```
### 8.2 Transações
```text
DESKTOP ≥1024
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ MARÉ         │ Transações [Outubro 2026 ⌄][Todas as contas ⌄][Todas as categorias ⌄]        │
│ ◉ Painel     │ [Tipo ⌄][Estado ⌄] ▸ pesquisa              [Densidade ⌥][Colunas ⌥]           │
│   Transações ├──────────────────────────────────────────────────────────────────────────────┤
│   Orçamento  │ 142 lançamentos · saldo do período −1 842,30 €   chips: [supermercado ×]     │
│              │                                                        [cartão CTT ×][+ filtro]│
│ ─────────────│ ☐ │ DATA   │ DESCRIÇÃO        │ CATEGORIA      │ CONTA      │ MONTANTE        │
│ ＋ Novo   N  │ ☐ │ 10 out │ Continente       │ Supermercado   │ Cartão CTT │ −64,20 €        │
│              │ ☐ │ 10 out │ Ordenado         │ Salário        │ Conta 1234 │ +1 850,00 €     │
│ Exportar     │ ☐ │ 09 out │ Netflix (rec.)   │ Streaming      │ Cartão CTT │ −12,99 €        │
│              │   │ ── hoje ──────────────────────────────────────────────────────────────  │
│              │ ☐ │ 07 out │ Transferência    │ ⇄ Transferência│ Poupança   │ −200,00 € ⇄      │
│              ├──────────────────────────────────────────────────────────────────────────────┤
│              │ 3 selecionados [Alterar categoria][Mover conta][Apagar]  ‹ 1 2 3 … ›         │
│              │ Total selecionado −95,64 € · duplo clique = editar inline (Tab/Esc/Enter)   │
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
MOBILE 360 (sem tabela: lista agrupada por dia, deslizar linha = editar/apagar com undo)
┌──────────────────────────────┐
│ Transações            🔍  ⌥  │
│ [Out 2026 ⌄][Tipo ⌄]         │
│ ▢ supermercado × cartão ×    │
│ 142 · −1 842,30 €            │
│ ── HOJE ──────────────────   │
│ 🛒 Continente                │
│    Supermercado · CTT        │
│                    −64,20 €  │
│ 💼 Ordenado                  │
│    Salário · Conta 1234      │
│                 +1 850,00 €  │
│ ── ONTEM ─────────────────   │
│ ▶ Netflix (recorrente)       │
│    Streaming · CTT           │
│                    −12,99 €  │
├──────────────────────────────┤
│ ⌂    ≡     ＋     ◔     ⚙    │
└──────────────────────────────┘
```
### 8.3 Orçamento
```text
DESKTOP ≥1024
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ MARÉ         │ Orçamento  [Outubro 2026 ⌄]  [Realizado | Previsto]            ＋ orçamento   │
│ ◉ Painel     ├──────────────────────────────────────────────────────────────────────────────┤
│   Transações │ ▢ TOTAL 4 300,00 €                     ▢ ESTADO POR CATEGORIA (empilhada)   │
│   Orçamento  │   gasto 3 992,30 € (93%)                  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ █ excedido        │
│              │   projeção fim do mês 4 480 €             0%    50%   100%   ‹ projeção       │
│ ─────────────│   ⚠ excedente previsto 180 €                                                   │
│ ＋ Novo   N  ├──────────────────────────────────────────────────────────────────────────────┤
│              │ CATEGORIA      ORÇADO   GASTO   RESTANTE  PROGRESSO          AÇÃO            │
│              │ 🏠 Casa        1 200 €  1 200 €     0 €   ▓▓▓▓▓▓▓▓▓▓ 100% ⚠   [editar]        │
│              │ 🛒 Supermercado  600 €    494 €   106 €   ▓▓▓▓▓▓▓▓░░  82%     [editar]        │
│              │ 🍽 Restauração   250 €    238 €    12 €   ▓▓▓▓▓▓▓▓▓░  95%     [editar]        │
│              │ 🚗 Transporte    300 €    180 €   120 €   ▓▓▓▓▓░░░░░  60%     [editar]        │
│              │ ✎ edição inline do valor orçado · ⇄ reordenar · projeção = gasto÷dias×dias do mês│
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
MOBILE 360
┌──────────────────────────────┐
│ Orçamento            ⌄  ＋   │
│ [Outubro 2026 ⌄][Real|Prev]  │
│ ▢ TOTAL 4 300 €              │
│   gasto 3 992,30 € · 93%     │
│   ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░          │
│   ⚠ projeção 4 480 €         │
│     excedente 180 €          │
│ 🏠 Casa 1 200 €              │
│   ▓▓▓▓▓▓▓▓▓▓ 100% ⚠ excedido │
│   0 € restantes   [editar]   │
│ 🛒 Supermercado 600 €        │
│   ▓▓▓▓▓▓▓▓░░ 82% ⚠ atenção   │
│   106 € restantes [editar]   │
├──────────────────────────────┤
│ ⌂    ≡     ＋     ◔     ⚙    │
└──────────────────────────────┘
```
### 8.4 Objetivos
```text
DESKTOP ≥1024
┌──────────────┬──────────────────────────────────────────────────────────────────────────────┐
│ MARÉ         │ Objetivos                     [Ativos | Concluídos]      ＋ novo objetivo      │
│ ◉ Painel     ├──────────────────────────────────────────────────────────────────────────────┤
│   Transações │ ▢ ◕ FÉRIAS 2027        ▢ ◕ FUNDO EMERGÊNCIA   ▢ ◕ ENTRADA CASA              │
│   Orçamento  │   4 200 € / 6 800 €      2 100 € / 6 000 €     9 400 € / 30 000 €           │
│   Objetivos  │   ▓▓▓▓▓▓░░░░░░ 62%       ▓▓▓░░░░░░░░░ 35%      ▓▓▓░░░░░░░░░ 31%            │
│              │   250 €/mês · jul 2027   300 €/mês · abr 2028  400 €/mês · 2031             │
│ ─────────────│   [contribuir][editar]   [contribuir][editar]  [contribuir][editar]         │
│ ＋ Novo   N  │ ▢ PROGRESSO AGREGADO  ╱╱ previsão · ● realizado · ─ ─ meta anual            │
│              │ ⓘ 3 metas ativas exigem 950 €/mês = 22% da sobra média de 4 300 €           │
└──────────────┴──────────────────────────────────────────────────────────────────────────────┘
"contribuir" = drawer lateral com MoneyInput, data, conta de origem e pré-visualização
do novo progresso e da nova data prevista, recalculada em tempo real.
MOBILE 360
┌──────────────────────────────┐
│ Objetivos            ＋      │
│ [Ativos | Concluídos]        │
│ ▢ ◕ FÉRIAS 2027              │
│   4 200 € de 6 800 €         │
│   ▓▓▓▓▓▓░░░░░░ 62%           │
│   250 €/mês · previsão jul 27│
│   [contribuir]   [editar]    │
│ ▢ ◕ FUNDO EMERGÊNCIA         │
│   2 100 € de 6 000 €         │
│   ▓▓▓░░░░░░░░░ 35%           │
│   [contribuir]   [editar]    │
│ ▢ AGREGADO ╱╱ exigido 950 €/mês│
├──────────────────────────────┤
│ ⌂    ≡     ＋     ◔     ⚙    │
└──────────────────────────────┘
"contribuir" abre bottom sheet com teclado numérico imediato.
```

## 9. Formatação, moeda e localização
### 9.1 Princípio
A localização é **decisão de produto centralizada**, não por componente: tudo vive no `packages/shared` (que já tem utilitários de moeda e data, ver doc 02) e nenhum componente chama `Intl` nem `toLocaleString()` sem `locale` e `timeZone` explícitos. **[DECISÃO PROPOSTA D7]**
### 9.2 Medições reais (Node 24.21.0 / ICU completo, 2026-10-10)
| Caso | pt-PT + EUR (**principal**) | pt-BR + BRL (compatibilidade) |
|---|---|---|
| Montante 1234.56 | `1234,56 €` — **sem separador de milhares em 4 dígitos** (ICU/pt-PT só agrupa a partir de 5) | `R$ 1.234,56` — agrupa desde 4 dígitos, símbolo à esquerda |
| 12345.67 / 1234567.89 | `12 345,67 €` / `1 234 567,89 €` | `R$ 12.345,67` / `R$ 1.234.567,89` |
| Zero | `0,00 €` — separador antes do símbolo é **U+00A0** (código `a0`), não espaço normal | `R$ 0,00` (U+00A0 entre símbolo e número) |
| Sem decimais | `1 235 €` (`maximumFractionDigits: 0`) para eixos e cartões | `R$ 1 235` equivalente |
| Número puro | `1234,56` → `12 345,67` | `1.234,56` → `12.345,67` |
| Data curta | `10/10/26` — **ano com 2 dígitos por omissão** | `10/10/2026` — ano com 4 dígitos |
| Data longa / mês-ano | `10 de outubro de 2026` / `outubro de 2026` | iguais a pt-PT |
| Semana | `Intl.Locale('pt-PT').weekInfo.firstDay` = **7 (domingo)** | idem 7 |

**D8 — datas:** usar **sempre** o padrão explícito `dd/MM/yyyy` (nunca `dateStyle:'short'`), para evitar `10/10/26` em contexto financeiro; em detalhe, `10 de outubro de 2026`. Datas relativas ("Hoje", "Ontem", "Há 3 dias") só até 7 dias e sempre com `title`/`aria-label` com a data absoluta.
**D9 — agrupamento:** forçar `useGrouping: 'always'` na UI, para `1 234,56 €` em vez de `1234,56 €`: a omissão do ICU é tecnicamente correta mas inconsistente em colunas de valores. Garantir largura mínima de coluna (o separador é U+00A0 e não quebra).
**D10 — negativos:** `−1 842,30 €` com o sinal antes do número (comportamento ICU), **sem** parênteses contabilísticos; em KPIs, separar o sinal num *badge* de tendência (`−12,0%`) mantendo o valor absoluto e a direção descrita em texto.
**D11 — semana:** primeiro dia **segunda-feira** por decisão de produto (a convenção portuguesa), **não** confiar em `weekInfo` (devolve domingo) — configurável.
**D12 — arquitetura:** `LOCALE` e `CURRENCY` são um **par de configuração lido de um único sítio** (`packages/shared` + `lib/env`), nunca literais espalhados; toda a UI usa `formatMoney()`/`formatDate()`. Mudar pt-PT/EUR → pt-BR/BRL passa a ser configuração, não refactor.
### 9.3 Datas, fuso e armazenamento
Fuso de renderização **`Europe/Lisbon`**, passado explicitamente em todas as formatações; armazenamento em UTC (`timestamptz`). O "dia contabilístico" fecha às 00:00 de Europe/Lisbon e o DST é tratado pelo `Intl` (nunca offsets fixos) — com testes obrigatórios em **março e outubro**. Montantes **em cêntimos inteiros** (`bigint`), nunca em vírgula flutuante; a formatação é a última etapa, na fronteira de apresentação (alinhar com os utilitários de `money` do `packages/shared`).
### 9.4 Microcopy e tom (pt-PT)
Tratamento por **"tu"** (proposta) ou "você" — a fechar com o cliente. Glossário fixo: **lançamento**, **conta**, **categoria**, **subcategoria**, **orçamento**, **meta/objetivo**, **recorrente**, **saldo**, **entradas/saídas** (evitar "crédito/débito"). Traduzir anglicismos: *dashboard* → **Painel**, *insights* → **Análise**, *budget* → **Orçamento**; "Instalar aplicação" (PWA) só em preferências. Erros claros e acionáveis: "Não foi possível guardar o lançamento. Verifica a ligação e tenta de novo. [Tentar de novo]". Números: KPI com 0 casas (`12 480 €`), lançamentos e tabelas com 2 casas — nunca misturar as duas convenções no mesmo cartão sem nota.

## 10. Acessibilidade, desempenho e PWA
### 10.1 WCAG 2.2 AA (requisito de aceitação)
| Critério | Regra |
|---|---|
| 1.4.3 texto | ≥4,5:1; todos os tokens de texto da §4.2–4.5 cumprem — `--warning`/`--accent` **não** podem ser texto no claro |
| 1.4.11 não-texto | ≥3:1 em contornos de campo, ícones, limites de gráfico e foco |
| 1.4.1 cor | Todo o estado tem rótulo textual + ícone (P3) |
| 2.5.8 alvos | ≥24×24 px garantidos; 44×44 px em mobile, 32×32 px em desktop denso |
| 2.4.7 / 2.4.11 foco | Anel `--ring` de 2 px com offset 2 px; foco nunca oculto por cabeçalho *sticky* (`scroll-margin-top`) |
| 2.1.1 teclado | 100% das ações de §7.2 por teclado, incluindo tooltips de gráfico e *drag* (com alternativa "mover para cima/baixo") |
| 4.1.3 estados | Toasts `role="status"`, erros `role="alert"` |
| 2.2.1 temporização | *Undo* de 5 s extensível (hover/botão "manter") |
| 1.3.1 estrutura | Um `h1` por ecrã; `table` com `<caption>` e `th[scope]`; gráficos com `role="img"` + tabela alternativa |
| 3.3 formulários | Erro junto ao campo, `autocomplete` e `inputMode` corretos, nada que exija memória |

Testes mínimos por entrega: navegação completa por teclado; leitor de ecrã em Painel + Transações; contraste automatizado sobre os tokens; zoom 200%; 360 px sem *scroll* horizontal.
### 10.2 Orçamentos de desempenho
LCP mobile 4G < 2,0 s (RSC + streaming, *hero* de saldo no servidor, sem gráficos a bloquear acima da dobra) · INP < 200 ms (edição otimista, virtualização, nenhum cálculo pesado em render) · CLS < 0,05 (*skeletons* com dimensões fixas, gráficos com `aspect-ratio` reservado) · JS inicial do Painel < 180 kB gzip (Recharts só carregado ao entrar, num limite *client* próprio) · paginação de 50 e agregações no servidor (nunca somar milhares de linhas no cliente).
### 10.3 PWA e dispositivos
Manifest: `name "Maré — Finanças pessoais"`, `lang "pt-PT"`, `start_url "/painel"`, `display standalone`, ícones 192/512 + maskable, `theme_color` = `--background` do tema ativo (`#fcfcf9` claro / `#0f141a` escuro), `background_color` idem, orientação livre. Dark mode: `next-themes` com `attribute="class"` e `defaultTheme="system"` (já configurado), script de tema antes da pintura (**sem flash**) e `color-scheme` por tema para scrollbars e controlos nativos. Mobile: `viewport-fit=cover`, `env(safe-area-inset-bottom)` na bottom bar, **`100dvh`** (nunca `100vh`), `inputMode="decimal"` nos valores, sem `position: fixed` em rodapés de formulário. Offline: *shell* em Cache Storage + página "sem ligação" com o último estado conhecido; lançamentos criados offline ficam em fila local, sincronizam ao voltar a rede e mostram "N por sincronizar", com conflitos resolvidos explicitamente (último a escrever ganha, com aviso). Notificações só após a segunda sessão, para recorrentes/limites de orçamento.

## 11. Riscos e decisões pendentes
| # | Risco / dúvida | Impacto | Mitigação |
|---|---|---|---|
| R1 | `--font-heading` e `--font-sans` **auto-referentes** em `globals.css` | Tipografia de títulos indefinida | Corrigir ao aplicar o Apêndice A |
| R2 | `lucide-react ^1.53.0` (major recente) | Nomes de ícones podem ter mudado; falha de build | Validar nomes usados e fixar versão exata |
| R3 | TanStack Table **v9** recente | Atrito de API na implementação | Spike de 1 dia; plano B `^8.21` (a v9 expõe `./legacy`) |
| R4 | Recharts teve *issues* de React 19 em 3.0.x | Erro de runtime em SSR | Fixar `^3.10`; gráficos sempre *client* com `dynamic(ssr:false)` |
| R5 | Sem migrações nem testes no monorepo (doc 02) | Regressões visuais silenciosas | `@axe-core/playwright` + *snapshot* visual dos 4 ecrãs antes de fechar o design |
| R6 | Decisão **"tu" vs "você"** e cor de marca (verdigris vs azul bancário) | Aceitação do cliente e microcopy de toda a app | Fechar antes dos textos finais; apresentar variante `Azul` trocando **um** token (`--primary: oklch(0.47 0.13 250)`) |
| R7 | Densidade comutável complica QA | Duas variantes de tabela | Limitar a densidade a Transações e Contas no MVP |
| R8 | `number-flow` (opcional) sem versão estável confirmada | Dependência instável | Só adicionar se a animação de valores for considerada essencial |

## 12. Apêndice A — tokens prontos a colar em `apps/web/src/app/globals.css`
Substitui `:root` e `.dark` e acrescenta tokens ao `@theme inline`; mantém **todos** os nomes shadcn (os 15 componentes instalados continuam a funcionar). Valores confirmados por medição de contraste em 2026-10-10.
```css
@theme inline {
  --font-sans: var(--font-inter);      /* corrige a auto-referência (R1) */
  --font-display: var(--font-inter);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  /* semântica financeira */
  --color-income: var(--income);
  --color-expense: var(--expense);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-goal: var(--goal);
  --color-info: var(--info);
  --color-neutral-amount: var(--neutral-amount);
  --color-surface-raised: var(--surface-raised);
  --color-surface-overlay: var(--surface-overlay);
  /* movimento */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 100ms;
  --duration-base: 150ms;
  --duration-slow: 220ms;
}
:root {
  --background: oklch(0.99 0.004 95);
  --foreground: oklch(0.22 0.015 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.015 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.015 250);
  --surface-raised: oklch(0.975 0.006 200);
  --surface-overlay: oklch(0.19 0.02 250 / 45%);
  --primary: oklch(0.47 0.09 190);
  --primary-foreground: oklch(0.99 0.01 190);
  --secondary: oklch(0.96 0.008 200);
  --secondary-foreground: oklch(0.22 0.015 250);
  --muted: oklch(0.965 0.006 200);
  --muted-foreground: oklch(0.50 0.02 250);
  --accent: oklch(0.94 0.03 75);
  --accent-foreground: oklch(0.30 0.05 70);
  --destructive: oklch(0.55 0.20 25);
  --income: oklch(0.52 0.11 155);
  --income-foreground: oklch(0.99 0.01 155);
  --expense: oklch(0.55 0.20 25);
  --expense-foreground: oklch(0.99 0.01 25);
  --warning: oklch(0.66 0.15 70);
  --warning-foreground: oklch(0.55 0.13 70);   /* 4,84:1 — seguro para texto */
  --goal: oklch(0.50 0.16 285);
  --info: oklch(0.52 0.13 245);
  --neutral-amount: oklch(0.55 0.02 250);
  --border: oklch(0.90 0.01 220);
  --input: oklch(0.90 0.01 220);
  --ring: oklch(0.47 0.09 190);
  --radius: 0.75rem;
  /* séries de gráfico seguras para daltonismo (≥3,6:1 sobre o fundo) */
  --chart-1: oklch(0.55 0.13 250);
  --chart-2: oklch(0.62 0.14 70);
  --chart-3: oklch(0.52 0.16 290);
  --chart-4: oklch(0.55 0.12 155);
  --chart-5: oklch(0.58 0.17 25);
  --chart-6: oklch(0.58 0.11 200);
  --chart-7: oklch(0.55 0.15 330);
  --chart-8: oklch(0.58 0.12 105);
  --chart-grid: oklch(0.90 0.01 220);
  --chart-axis: oklch(0.50 0.02 250);
  --chart-income: var(--income);        /* mapeamento fixo do domínio */
  --chart-expense: var(--expense);
  --chart-balance: var(--chart-1);
  --chart-savings: var(--goal);
  --chart-forecast: oklch(0.52 0.13 245 / 45%);
  --shadow-e1: 0 1px 2px oklch(0.22 0.02 250 / 6%);
  --shadow-e2: 0 4px 12px oklch(0.22 0.02 250 / 8%);
  --shadow-e3: 0 12px 32px oklch(0.22 0.02 250 / 14%);
  --sidebar: oklch(0.975 0.006 200);
  --sidebar-foreground: oklch(0.22 0.015 250);
  --sidebar-primary: oklch(0.47 0.09 190);
  --sidebar-primary-foreground: oklch(0.99 0.01 190);
  --sidebar-accent: oklch(0.955 0.012 195);
  --sidebar-accent-foreground: oklch(0.30 0.04 195);
  --sidebar-border: oklch(0.90 0.01 220);
  --sidebar-ring: oklch(0.47 0.09 190);
}
.dark {
  --background: oklch(0.19 0.015 250);
  --foreground: oklch(0.97 0.005 250);
  --card: oklch(0.235 0.016 250);
  --card-foreground: oklch(0.97 0.005 250);
  --popover: oklch(0.26 0.016 250);
  --popover-foreground: oklch(0.97 0.005 250);
  --surface-raised: oklch(0.26 0.016 250);
  --surface-overlay: oklch(0.10 0.02 250 / 65%);
  --primary: oklch(0.72 0.11 185);
  --primary-foreground: oklch(0.17 0.02 200);
  --secondary: oklch(0.28 0.018 250);
  --secondary-foreground: oklch(0.97 0.005 250);
  --muted: oklch(0.27 0.018 250);
  --muted-foreground: oklch(0.70 0.02 250);
  --accent: oklch(0.30 0.03 75);
  --accent-foreground: oklch(0.90 0.05 80);
  --destructive: oklch(0.70 0.19 22);
  --income: oklch(0.78 0.13 155);
  --income-foreground: oklch(0.18 0.03 155);
  --expense: oklch(0.72 0.15 25);
  --expense-foreground: oklch(0.19 0.03 25);
  --warning: oklch(0.82 0.13 80);
  --warning-foreground: oklch(0.82 0.13 80);   /* 10,45:1 sobre o fundo escuro */
  --goal: oklch(0.76 0.12 285);
  --info: oklch(0.76 0.10 245);
  --neutral-amount: oklch(0.70 0.02 250);
  --border: oklch(0.32 0.015 250);
  --input: oklch(0.34 0.015 250);
  --ring: oklch(0.72 0.11 185);
  --chart-1: oklch(0.76 0.10 250);
  --chart-2: oklch(0.80 0.12 75);
  --chart-3: oklch(0.74 0.12 290);
  --chart-4: oklch(0.78 0.11 155);
  --chart-5: oklch(0.74 0.13 25);
  --chart-6: oklch(0.78 0.09 200);
  --chart-7: oklch(0.76 0.11 330);
  --chart-8: oklch(0.80 0.11 110);
  --chart-grid: oklch(0.32 0.015 250);
  --chart-axis: oklch(0.70 0.02 250);
  --chart-forecast: oklch(0.76 0.10 245 / 45%);
  --shadow-e1: none;
  --shadow-e2: 0 4px 12px oklch(0.05 0 0 / 40%);
  --shadow-e3: 0 12px 32px oklch(0.05 0 0 / 55%);
  --sidebar: oklch(0.22 0.016 250);
  --sidebar-foreground: oklch(0.97 0.005 250);
  --sidebar-primary: oklch(0.72 0.11 185);
  --sidebar-primary-foreground: oklch(0.17 0.02 200);
  --sidebar-accent: oklch(0.28 0.018 250);
  --sidebar-accent-foreground: oklch(0.97 0.005 250);
  --sidebar-border: oklch(0.32 0.015 250);
  --sidebar-ring: oklch(0.72 0.11 185);
}
@layer base {
  html { @apply font-sans; color-scheme: light; }
  html.dark { color-scheme: dark; }
  body { @apply bg-background text-foreground antialiased; }
  [data-numeric], .font-numeric { font-variant-numeric: tabular-nums; }
  :focus-visible { @apply outline-ring outline-2 outline-offset-2; }
  [id] { scroll-margin-top: 5rem; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```
**Ordem de aplicação sugerida:** (1) colar o bloco e validar visualmente os 15 componentes existentes; (2) instalar os componentes shadcn do §6; (3) construir os 4 ecrãs por esta ordem — **Transações → Painel → Orçamento → Objetivos** (a tabela define tokens e padrões que os restantes reaproveitam).

## 13. Referências
**Normas e fundamentos:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [SC 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) · [SC 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast) · [MDN `oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/oklch) · [Tailwind — theme variables](https://tailwindcss.com/docs/theme) · [web.dev — Learn PWA](https://web.dev/learn/pwa/).
**Bibliotecas:** [shadcn/ui Chart](https://ui.shadcn.com/docs/components/radix/chart) · [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) · [shadcn `toast` depreciado (#7120)](https://github.com/shadcn-ui/ui/issues/7120) · [Recharts](https://recharts.org/) ([#6578](https://github.com/recharts/recharts/issues/6578), [#6316](https://github.com/recharts/recharts/issues/6316)) · [TanStack Table](https://tanstack.com/table/latest) · [anúncio da v9](https://tanstack.com/blog/announcing-tanstack-table-v9) · [guia de migração v9](https://tanstack.com/table/latest/docs/framework/react/guide/migrating) · [Apache ECharts](https://echarts.apache.org/) · [Nivo](https://nivo.rocks/) · [Chart.js](https://www.chartjs.org/) · [visx](https://airbnb.io/visx) · [Tremor](https://www.tremor.so/).
**Produto e tendências:** [Monarch](https://www.monarchmoney.com/) · [Copilot](https://copilot.money/) · [YNAB](https://www.ynab.com/) · [Actual Budget](https://actualbudget.org/) · [Firefly III](https://www.firefly-iii.org/) · [Linear](https://linear.app/) · [Wise](https://wise.com/) · [Revolut](https://www.revolut.com/) · [Nubank](https://nubank.com.br/) · [Vercel Geist](https://vercel.com/geist/introduction) · [Mobbin](https://mobbin.com/) · [oklch.com](https://oklch.com/) · [Anti-Bento](https://www.superfiles.in/anti-bento-grid-8-scenarios.php) · [Design trends 2026](https://www.goodbarber.com/blog/design-trends-2026-ai-leaves-the-chat-the-design-system-makes-the-rule-a1608/) · [Material 3 Expressive](https://blog.google/products-and-platforms/platforms/android/material-3-expressive-android-wearos-launch/).
**Medições locais (2026-10-10, Node 24.21.0, ICU completo):** rácios de contraste por conversão oklch→sRGB→luminância relativa WCAG (§4.2–4.6); saídas de `Intl.NumberFormat`, `Intl.DateTimeFormat` e `Intl.Locale.weekInfo` para pt-PT e pt-BR (§9.2); versões npm: `recharts@3.10.1`, `@tanstack/react-table@9.2.8`, `@tanstack/react-charts@1.1.0`, `echarts-for-react@3.0.6`, `@nivo/core@0.99.0`, `chart.js@4.5.1`.
**Aceitação da `task-3`:** 8 pontos cobertos (§2, §3, §4+Apêndice A, §5, §6, §7, §8, §9); sem código-fonte (só tokens CSS, permitidos); URLs citados como links; versões major indicadas; único ficheiro escrito.
