# Handoff: novo /admin — CRM interno da Automind

## Overview
Substituir o `/admin` atual (painel de leads) por um CRM interno completo com 10 módulos:
visão geral, leads/pipeline, clientes & contratos, projetos & sprints, tarefas integradas ao
Google Calendar, financeiro (com ciclo do cartão), analytics do site, propostas, sistemas/deploys
e configurações do site. Usuários: os dois sócios.

## About the Design Files
Os arquivos deste pacote são **referências de design em HTML** — um protótipo que mostra
aparência e comportamento pretendidos, **não** código de produção para copiar.
A tarefa é **recriar esse design dentro da app real** (`AutomindSolution/Automind`,
Next.js 16 App Router + React 19 + TypeScript + Supabase, CSS puro em `app/globals.css`),
usando os padrões que já existem lá — não colar o HTML.

`Admin.dc.html` abre em qualquer navegador (precisa do `support.js` ao lado).
No painel de tweaks há dois interruptores: **Dados de exemplo** (liga o preenchimento fictício,
útil para ver cada estado cheio) e **Iniciar logado** (pula a tela de login).

## Fidelity
**Alta fidelidade.** Cores, tipografia, espaçamento, hierarquia e estados vazios são finais.
O que é fictício são apenas os dados (o protótipo entregue está zerado de propósito).

## Design Tokens
Cores (o admin é uma camada visual própria, ver "Decisão de estilo" abaixo):

| Token | Valor | Uso |
| --- | --- | --- |
| `--adm-bg` | `#FAFAF7` | fundo da página |
| `--adm-surface` | `#FFFFFF` | cartões, linhas de tabela, campos |
| `--adm-surface-2` | `#F2F1EC` | colunas secundárias, blocos de apoio |
| `--adm-ink` | `#141414` | texto principal, sidebar, réguas de 2px |
| `--adm-ink-2` | `#5A5A54` | texto de apoio |
| `--adm-muted` | `#8A8A82` | rótulos, metadados |
| `--adm-line` | `#E4E1D8` | divisórias de 1px |
| `--adm-line-dashed` | `#C9C6BC` | borda tracejada dos estados vazios e dropzones |
| `--adm-accent` | `#D6402C` | ação primária, urgência, destaque |
| `--adm-accent-press` | `#B23520` | estado pressionado/hover do primário |
| sidebar ativo | `#232320` | item de menu selecionado |
| sidebar texto | `#B8B8B0` (inativo) / `#FAFAF7` (ativo) | menu |
| sidebar divisória | `#2C2C2A` | topo/rodapé da sidebar |

Tipografia: `Space Grotesk` (títulos, números, rótulos em caixa alta) sobre `Inter` (corpo).
Escala usada: 29/26/23/19/17/16/15/14.5/13.5/12.5/11.5/10.5px · line-height base 1.55 ·
letter-spacing −.03em nos números grandes, −.02em nos títulos, +.10 a +.16em nos rótulos em caixa alta.

Geometria: **raio 0 em tudo**. Régua forte 2px `#141414` entre seções; 1px `#E4E1D8` entre células.
Sem sombras. Sem gradientes. Tudo alinhado à esquerda, inclusive rótulo de botão.

Estados: hover de botão primário → `#B23520`; hover de botão outline → inverte para fundo
`#141414` e texto `#FAFAF7`; foco de teclado → `outline: 2px solid #D6402C; outline-offset: 2px`.

### Decisão de estilo (precisa de uma escolha antes de codar)
O site público usa navy + mint (`--navy-900`, `--mint`) com Bricolage Grotesque/Manrope.
O protótipo do admin usa a paleta acima. Recomendação: **manter o admin como camada visual
separada**, já que ele é interno e o CSS atual já isola tudo sob o prefixo `adm-`. Concretamente:
criar `app/admin/admin.css` importado só pelo layout do admin, com os tokens `--adm-*` acima, e
remover as regras `adm-*` de `app/globals.css` (hoje ~31 kB com tudo misturado). Se preferirem um
visual único, troque os tokens `--adm-*` pelos do site e mantenha a estrutura — a estrutura é o valor.

## Screens / Views

### 0. Login (`/admin` sem sessão)
- **Propósito:** entrar com a conta Google autorizada.
- **Layout:** duas colunas (`grid-template-columns: minmax(0,1fr) minmax(0,1.05fr)`, 100vh).
  Esquerda `#141414`: marca no topo, manchete "Área restrita da operação." (Space Grotesk 500,
  clamp(30px,3.4vw,42px), −.03em), parágrafo `#C8C8C0`, e no rodapé quatro linhas de segurança
  com seta `→` em `#D6402C`, separadas por borda superior `#2C2C2A`.
  Direita `#FAFAF7`, conteúdo com `max-width: 420px` centralizado verticalmente.
- **Fases (state machine):** `inicio` → botão "Entrar com Google" (borda 2px `#141414`, fundo branco,
  logo G colorida 20px, rótulo à esquerda) · `contas` → seletor de contas · `entrando` → barra de
  progresso 6px com verificação de domínio · `negado` → bloco com borda esquerda vermelha,
  "Acesso negado", sem criar sessão.
- **Regra:** hoje apenas `atendimento@automindsolution.com.br`. Qualquer outra conta cai em `negado`.
- **No código real isso já existe:** `LoginScreen.tsx` + `AccessDenied.tsx` + `requireAdmin()`
  com a env `ADMIN_EMAILS`. O trabalho é só reestilizar e trocar o texto, não reescrever a auth.

### 1. Shell do painel (todas as abas)
- **Sidebar** fixa, 236px, `#141414`, `position: sticky; top: 0; height: 100vh`:
  marca + "Painel interno · /admin"; lista de 10 itens (`padding: 10px 20px`, borda esquerda 3px
  transparente que vira `#D6402C` no item ativo, fundo `#232320`); badge numérico opcional à direita;
  rodapé com avatar 28px `#D6402C` com iniciais, nome, e-mail, botão "Sair da conta" e a linha
  "Sessão expira em 7h42 · 2FA ativo · toda ação fica no log de auditoria".
- **Topo** sticky, borda inferior 2px: kicker vermelho em caixa alta + título da aba (26px),
  campo de busca com ícone e atalho `⌘K`, botão primário "+ Novo registro".
- **Conteúdo:** seções empilhadas separadas por régua de 2px; grids de células iguais com
  divisórias de 1px. Larguras internas nunca fixas — use `minmax(0,1fr)` (um bug de overflow
  já foi corrigido assim no protótipo).

### 2. Visão geral
Faixa de 5 KPIs (MRR, a receber em 30 dias, custo fixo, leads abertos, horas na semana) ·
**Radar de vencimentos** (a peça mais importante do painel: contrato que renova, cobrança a
receber, custo a pagar, fechamento do cartão e domínio a expirar numa única lista ordenada por
data, com etiqueta de tipo e "em N dias" em vermelho quando urgente) · coluna "Hoje" com agenda
e tarefas · "Alertas do sistema" · faixa "Sinais do site · últimas 24h" com o nome do evento
que alimenta cada número.

### 3. Leads / Pipeline
Barra de filtros + ciclo médio e taxa de conversão · kanban de 4 colunas
(**Mensagem no WhatsApp → Análise → Proposta → Contrato**) com valor somado por coluna e
"aging" em vermelho acima de 7 dias · painel de detalhe do lead selecionado com a **trilha do
que o site já contou sobre ele** (páginas, tempo, termo buscado, nicho clicado) e uma leitura
automática · esteira de onboarding pós-contrato em 4 passos
(grupo no WhatsApp → formulário de escopo → protótipo → entrega e treinamento).

### 4. Clientes & Contratos
Tabela: cliente/nicho/desde · plano · MRR · custo/mês · **margem** (vermelha abaixo de 55%) ·
dia de pagamento · renovação · saúde. Abaixo: "Contratos que exigem decisão" e área de
documentos com dropzone (PDF/imagem → extrai fornecedor, valor, vencimento e categoria para
confirmação humana).

### 5. Projetos & Sprints
Uma linha por projeto em 3 colunas: identidade + barra de entrega + horas gastas vs. orçadas
(vermelho quando estoura) + valor/hora real; backlog do sprint com dono; **checklist de deploy**
com data do último deploy.

### 6. Tarefas & Google Calendar
Grade da semana 5×5 (blocos: preto = foco, vermelho = cliente, cinza = manutenção) ·
formulário "Nova tarefa" (o que, cliente, estimativa, data, hora) com a caixa
**"Criar evento no Google Calendar"** marcada por padrão · lista de tarefas abertas com
checkbox, prazo em vermelho quando é hoje e coluna "no calendar / sem evento".

### 7. Financeiro
5 KPIs (receita, custos, pró-labore, resultado, reserva) · **Ciclo do cartão**: barra de quanto
do ciclo já está comprometido + bloco preto "Melhor janela para assinar" · lista de assinaturas
(valor, dia da cobrança, rateio, uso — "Ocioso"/"Cancelar" em vermelho) · 4 cartões de insight
(timing, ocioso, rateio, concentração) · "A receber" e "A pagar" lado a lado · dropzone
"Lançar por documento".

### 8. Analytics do site
Funil de 5 etapas com o nome do evento em cada uma · origem dos leads (UTM) · interesse por
nicho · atenção por seção · termos digitados · dispositivo/região/horário com barras de pico ·
e a seção **"Eventos que alimentam este painel"**: a especificação dos 8 eventos a implementar
no site público, com gatilho e payload, mais 4 cartões de boas práticas (consentimento antes de
tudo, nada de dado pessoal no navegador, retenção de 12 meses, primeira parte sem terceiros).

### 9. Propostas & Orçamentos
Lista com escopo, modelo de cobrança, valor, validade, status e quantas vezes o link foi aberto ·
calculadora de preço (horas × valor/hora + APIs + hospedagem + reserva de retrabalho → preço
sugerido com margem) · taxa de aceite por faixa de preço.

### 10. Sistemas & Deploys
Cartões por site/automação com uptime 30d, tempo de resposta e último deploy · log de erros dos
bots (nível, mensagem, origem, contagem) · **variáveis e credenciais por projeto**: só o nome da
variável, onde ela vive e quando expira — **nunca o valor**.

### 11. Configurações do site (CMS leve)
Campos editáveis (WhatsApp, título do hero, horário de atendimento, e-mail, mensagem
pré-preenchida) · switches de coleta com a **base legal** ao lado de cada um
(consentimento / legítimo interesse / execução de contrato) · bloco "Regras fixas do painel".

## Interactions & Behavior
- Navegação por abas é estado local; nada de rota nova por aba (mantém uma URL só, `/admin`).
- Cartão de lead clicado → carrega o painel de detalhe abaixo do kanban.
- Checkbox de tarefa/checklist/onboarding alterna estado e risca o texto.
- Switches de coleta alternam o trilho para `#D6402C` com o botão à direita.
- **Estados vazios são obrigatórios** em todo módulo: bloco tracejado `#C9C6BC` com título em
  Space Grotesk 14px/600 e uma frase explicando o que cadastrar e por que aquele dado importa.
  O protótipo entregue está inteiro nesse estado — use-o como referência literal.
- Faltam no protótipo e devem existir na app real: loading (skeleton nas linhas), erro de fetch
  (a app já usa `<p className="adm-error">`), paginação (já existe em `LeadsTable`), e confirmação
  antes de excluir.

## State Management
Nada de biblioteca — `useState`/`useEffect` como já é feito em `AdminDashboard.tsx`.
Estado por aba, carregado sob demanda (`fetch` no primeiro acesso à aba, com cache simples).
Estados globais do shell: aba ativa, usuário logado, contadores dos badges.

## Files
- `Admin.dc.html` — protótipo completo (login + 10 abas). Precisa do `support.js` ao lado.
- `support.js` — runtime do protótipo (não vai para a app real).
- `PLANO-MIGRACAO.md` — o que apagar, o que manter, o que criar na repo real, com SQL,
  rotas de API, eventos do front-end e ordem de commits.

## Assets
Nenhum. Ícones são SVG inline (Lucide/estilo Lucide, stroke 2). A logo do Google no botão de
login é o G oficial de quatro cores, 20px.
