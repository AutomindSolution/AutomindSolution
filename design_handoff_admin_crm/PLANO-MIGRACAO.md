# Plano de migração — `/admin` CRM

Repo: `AutomindSolution/Automind` · branch `main` · Next.js 16 App Router, React 19, TypeScript,
Supabase (`@supabase/ssr`), CSS puro em `app/globals.css`, deploy na Vercel.

> Este plano foi escrito lendo o código real da repo em 17/08/2026. Nada aqui foi commitado —
> quem tem permissão de escrita é você.

---

## 0. Antes de tocar em qualquer arquivo

```bash
git fetch --all
git status                          # tem coisa não commitada aí?
git log --oneline origin/main -10   # o que já subiu
npx vercel ls automind-site         # o que a Vercel realmente publicou
```

Compare o último commit de `origin/main` com o commit do deploy de produção na Vercel.
Se houver commits sem deploy, **resolva isso antes**: ou é build quebrado (`npm run build`
localmente reproduz), ou é deploy pausado no painel. Subir o CRM em cima de uma `main`
que não builda transforma um problema em dois.

Depois, trabalhe fora da main:

```bash
git checkout -b feat/admin-crm
```

---

## 1. O que MANTER (não reescrever)

| Arquivo | Por quê |
| --- | --- |
| `app/lib/supabase/server.ts` (`requireAdmin`) | a autorização já é exatamente a que o protótipo desenha: sessão Google + allowlist por e-mail |
| `app/lib/supabase/client.ts` | cliente de browser |
| `app/auth/callback/route.ts` | troca do code OAuth |
| `app/admin/page.tsx` | o guard de 4 estados (setup / não logado / sem permissão / ok) está correto |
| `app/lib/admin-api.ts` | `adminGuard()`, filtros e `computeStats` — reaproveitar e estender |
| `app/lib/leads.ts` | tipos do domínio de leads |
| `app/api/lead/route.ts`, `app/api/whatsapp/route.ts` | entrada de leads e integração n8n |
| `app/api/admin/import|export/route.ts` | CSV já pronto |

**Restrição de acesso:** não crie código novo para isso. Na Vercel, ajuste a env
`ADMIN_EMAILS=atendimento@automindsolution.com.br` e, no Supabase, deixe o provider Google
com o domínio da empresa. Quando o sócio entrar, é só somar o e-mail na env.

## 2. O que APAGAR / SUBSTITUIR

| Arquivo | Ação |
| --- | --- |
| `app/admin/AdminDashboard.tsx` | vira apenas o **shell** (sidebar + topo + roteamento de abas). Todo o miolo atual (toolbar, filtros, import/export) desce para o módulo de Leads |
| `app/admin/LeadsTable.tsx`, `LeadDrawer.tsx`, `StatsPanel.tsx` | movem para `app/admin/modules/leads/` — mantêm a lógica, ganham o novo estilo |
| regras `adm-*` dentro de `app/globals.css` | recortar para `app/admin/admin.css` (importado só pelo admin). `globals.css` tem ~31 kB com site + admin misturados; essa separação é metade da "limpeza" pedida |
| `app/admin/LoginScreen.tsx` | reescrever com o layout de duas colunas do protótipo (a lógica `signInWithOAuth` continua igual) |

## 3. Estrutura nova de pastas

```
app/admin/
  page.tsx              # guard (mantido)
  layout.tsx            # novo: importa admin.css
  admin.css             # novo: tokens --adm-* + componentes do painel
  AdminShell.tsx        # sidebar + topo + <Tab/>
  LoginScreen.tsx       # reescrito
  AccessDenied.tsx      # mantido, reestilizado
  modules/
    overview/           # radar de vencimentos, hoje, alertas, sinais
    leads/              # kanban + detalhe + onboarding (reusa LeadsTable/Drawer/Stats)
    clientes/           # tabela, contratos, documentos
    projetos/           # sprints + checklist de deploy
    tarefas/            # grade da semana + Google Calendar
    financeiro/         # ciclo do cartão, assinaturas, insights, a receber/pagar
    analytics/          # funil, origens, seções, termos, spec de eventos
    propostas/          # lista + calculadora
    sistemas/           # uptime, logs, variáveis
    config/             # CMS leve + switches de coleta
app/api/admin/
  clientes|contratos|projetos|tarefas|assinaturas|lancamentos|propostas|sistemas|eventos/route.ts
  radar/route.ts        # a consulta que junta tudo para a Visão geral
app/lib/
  crm.ts                # tipos do domínio novo (espelha leads.ts)
  calendar.ts           # Google Calendar (server-only)
```

## 4. Banco (Supabase) — SQL inicial

Mesmo padrão da tabela `leads` que já existe. Rode no SQL editor:

```sql
-- Clientes e contratos
create table clientes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null, nicho text, plano text,
  mrr numeric(10,2) default 0, custo_mensal numeric(10,2) default 0,
  dia_pagamento int check (dia_pagamento between 1 and 31),
  inicio date, renovacao date, renovacao_automatica boolean default false,
  status text default 'ativo', notas text
);

create table contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text, valor numeric(10,2), inicio date, fim date,
  aviso_previo_dias int default 30, arquivo_url text, criado_em timestamptz default now()
);

-- Projetos e execução
create table projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  nome text not null, escopo text, status text default 'protótipo',
  horas_orcadas numeric(6,2), valor numeric(10,2), prazo date,
  criado_em timestamptz default now()
);

create table tarefas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  titulo text not null, descricao text, dono text,
  estimativa_h numeric(5,2), horas_gastas numeric(5,2) default 0,
  prazo timestamptz, feita boolean default false,
  gcal_event_id text,               -- id do evento no Google Calendar
  criado_em timestamptz default now()
);

-- Financeiro
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  nome text not null, valor_mensal numeric(10,2) not null,
  dia_cobranca int check (dia_cobranca between 1 and 31),
  cartao text, uso text default 'medio',           -- alto | medio | ocioso
  ultimo_uso date, ativa boolean default true,
  rateio jsonb default '[]'::jsonb                 -- [{cliente_id, percentual}]
);

create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receber','pagar')),
  cliente_id uuid references clientes(id) on delete set null,
  descricao text, categoria text, valor numeric(10,2) not null,
  vencimento date not null, pago_em date, documento_url text,
  criado_em timestamptz default now()
);

create table cartao_config (
  id int primary key default 1,
  dia_fechamento int not null, dia_vencimento int not null,
  teto_mensal numeric(10,2)
);

-- Comercial
create table propostas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid, cliente_id uuid references clientes(id) on delete set null,
  escopo text, modelo text, valor numeric(10,2), validade date,
  status text default 'rascunho', aberturas int default 0,
  criado_em timestamptz default now()
);

-- Infra
create table sistemas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  nome text not null, url text, tipo text,
  uptime_30d numeric(5,2), resposta_ms int, ultimo_deploy timestamptz,
  monitorar boolean default true
);

create table erros_log (
  id bigserial primary key,
  criado_em timestamptz default now(),
  nivel text, origem text, mensagem text, contagem int default 1
);

create table credenciais_ref (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade,
  chave text not null,          -- NOME da variável
  onde text not null,           -- cofre / provedor
  expira_em date
);                              -- NUNCA armazenar o valor

-- Telemetria do site público
create table eventos_site (
  id bigserial primary key,
  criado_em timestamptz default now(),
  sessao text not null,         -- id anônimo, cookie primeira parte
  evento text not null, props jsonb default '{}'::jsonb,
  consentimento boolean default false
);
create index on eventos_site (criado_em desc);
create index on eventos_site (evento, criado_em desc);
```

**RLS:** ligue em todas (`alter table X enable row level security;`) e **não crie policy para
`anon`** — todo acesso do painel passa pelo service role no servidor, exatamente como as rotas
de admin já fazem hoje. Exceção: `eventos_site` recebe insert do site público, então crie uma
policy só de `insert` para `anon` (sem `select`).

**Retenção:** agende no Supabase (pg_cron) a limpeza de `eventos_site` com mais de 12 meses —
é o que o painel promete na aba de configurações.

## 5. Google Calendar (obrigatório no briefing)

1. No Google Cloud, no mesmo projeto do OAuth que já existe, habilite a Calendar API e adicione
   o escopo `https://www.googleapis.com/auth/calendar.events`.
2. No Supabase Auth, provider Google: adicione o escopo e ative `access_type=offline` para
   receber refresh token (`provider_refresh_token` fica na sessão).
3. `app/lib/calendar.ts` (server-only): `criarEvento(tarefa)`, `atualizarEvento`, `apagarEvento`.
   Ao salvar tarefa com a caixa marcada, chame `criarEvento` e grave `gcal_event_id`.
   Ao marcar como feita ou mudar o prazo, sincronize pelo mesmo id.
4. Trate a falha: se o Calendar cair, a tarefa **salva mesmo assim** e o painel mostra
   "sem evento" (o protótipo já tem essa coluna) — nunca perca a tarefa por causa da agenda.

## 6. Coleta no front-end (alimenta a aba Analytics)

`app/lib/track.ts` já dispara para Vercel/GA4/Meta. Estenda com um quarto destino — a própria
base — via `POST /api/track` (rota nova, `runtime = "edge"`, sem bloquear a navegação, use
`navigator.sendBeacon`).

Eventos a instrumentar (ordem sugerida; os dois primeiros já existem parcialmente):

| Evento | Onde disparar em `app/page.tsx` | Payload |
| --- | --- | --- |
| `session_start` | primeiro render, uma vez por sessão | `utm_source`, `utm_medium`, `utm_campaign`, `referrer`, `device`, cidade por IP truncado (no servidor) |
| `whatsapp_click` | todo `href` do WhatsApp | `ref` curto na mensagem pré-preenchida (`?ref=ecom-21h`) |
| `cta_click` | botões primários | `cta_id`, `secao`, `scroll_pct` |
| `niche_card_click` | cards Ecommerce/Saúde/Serviços | `nicho`, `posicao` |
| `section_view` | `IntersectionObserver` já usado pela classe `.reveal` | `section_id`, `tempo_visivel` |
| `scroll_depth` | 25/50/75/100% | `pct`, `tempo_ate` |
| `search_term` | busca do site / chat | termo normalizado |
| `return_visit` | cookie primeira parte | `n_sessoes`, `dias_desde_primeira` |

Regras que o painel promete (implemente junto, não depois):
- nada sai antes do aceite no banner, exceto contagem agregada de sessão;
- telefone, nome e e-mail **nunca** em `localStorage` — o vínculo sessão↔contato acontece só no
  servidor, dentro de `/api/lead`, guardando `sessao` na linha do lead;
- IP truncado antes de virar cidade; nenhum pixel de terceiro carrega antes do consentimento
  (`app/Pixels.tsx` precisa passar a respeitar o banner).

## 7. Ordem de commits sugerida

1. `chore(admin): extrai estilos do admin de globals.css para app/admin/admin.css`
2. `feat(admin): shell com sidebar, topo e abas` (só Visão geral + Leads, resto placeholder)
3. `refactor(admin): move painel de leads para modules/leads` (sem mudar comportamento)
4. `feat(db): tabelas do CRM + RLS`
5. `feat(admin): clientes, contratos e radar de vencimentos`
6. `feat(admin): financeiro com ciclo do cartão e assinaturas`
7. `feat(admin): tarefas com Google Calendar`
8. `feat(site): eventos de coleta + /api/track + gate de consentimento`
9. `feat(admin): analytics, propostas, projetos, sistemas, config`
10. `docs: atualiza CLAUDE.md e README com a nova estrutura`

Faça 1–3 primeiro e faça deploy: a app fica **igual** para o usuário e a base do CRM entra sem
risco. Cada módulo seguinte é uma PR pequena, com a aba já visível e em estado vazio.

## 8. Atualize o `CLAUDE.md` da repo

O arquivo atual diz "Rotas: `/` e `/privacidade`" e "sem state management" — já está
desatualizado (existe `/admin`, `/en`, `/api/*`, Supabase). Corrija junto com o commit 1;
é o arquivo que orienta qualquer sessão futura de Claude Code nesse repositório.
