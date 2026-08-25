-- Automind — banco do site + CRM /admin (Supabase / Postgres)
-- Cole tudo isto no SQL Editor do Supabase e clique em RUN. Roda de uma vez só.

-- ─────────────────────────── SITE PÚBLICO ───────────────────────────
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text, telefone text, email text,
  segmento text, origem text, url text, referrer text,
  sessao text,
  status text not null default 'novo',   -- novo | contatado | proposta | fechado | perdido
  etapa text not null default 'mensagem', -- mensagem | analise | proposta | contrato
  valor_estimado numeric(10,2),
  notas text
);

create table if not exists eventos_site (
  id bigserial primary key,
  criado_em timestamptz not null default now(),
  sessao text not null,
  evento text not null,
  props jsonb not null default '{}'::jsonb,
  consentimento boolean not null default false
);
create index if not exists eventos_site_data on eventos_site (criado_em desc);
create index if not exists eventos_site_tipo on eventos_site (evento, criado_em desc);

-- ─────────────────────────── CLIENTES ───────────────────────────
create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null, nicho text, plano text,
  mrr numeric(10,2) default 0,
  custo_mensal numeric(10,2) default 0,
  dia_pagamento int check (dia_pagamento between 1 and 31),
  inicio date, renovacao date,
  renovacao_automatica boolean default false,
  aviso_previo_dias int default 30,
  status text default 'ativo', notas text
);

create table if not exists contratos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text, valor numeric(10,2), inicio date, fim date,
  arquivo_url text, criado_em timestamptz default now()
);

create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete cascade,
  tipo text,               -- contrato | nf | escopo | termo
  nome text, arquivo_url text, valor numeric(10,2), vencimento date,
  criado_em timestamptz default now()
);

-- ─────────────────────────── ENTREGA ───────────────────────────
create table if not exists projetos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  nome text not null, escopo text,
  status text default 'prototipo',   -- prototipo | producao | ajustes | entregue
  horas_orcadas numeric(6,2), valor numeric(10,2), prazo date,
  criado_em timestamptz default now()
);

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  titulo text not null, descricao text, dono text,
  estimativa_h numeric(5,2), horas_gastas numeric(5,2) default 0,
  prazo timestamptz, feita boolean default false,
  gcal_event_id text,
  criado_em timestamptz default now()
);

create table if not exists checklist_deploy (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade,
  item text not null, feito boolean default false, ordem int default 0
);

-- ─────────────────────────── DINHEIRO ───────────────────────────
create table if not exists assinaturas (
  id uuid primary key default gen_random_uuid(),
  nome text not null, valor_mensal numeric(10,2) not null,
  dia_cobranca int check (dia_cobranca between 1 and 31),
  cartao text, uso text default 'medio',    -- alto | medio | ocioso
  ultimo_uso date, ativa boolean default true,
  rateio jsonb default '[]'::jsonb          -- [{"cliente_id":"...","percentual":25}]
);

create table if not exists lancamentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('receber','pagar')),
  cliente_id uuid references clientes(id) on delete set null,
  descricao text, categoria text,
  valor numeric(10,2) not null,
  vencimento date not null, pago_em date,
  documento_url text, criado_em timestamptz default now()
);

create table if not exists cartao_config (
  id int primary key default 1,
  dia_fechamento int not null,
  dia_vencimento int not null,
  teto_mensal numeric(10,2)
);

create table if not exists propostas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  escopo text, modelo text, valor numeric(10,2), validade date,
  status text default 'rascunho',   -- rascunho | enviada | analise | aceita | perdida
  aberturas int default 0,
  criado_em timestamptz default now()
);

-- ─────────────────────────── INFRA ───────────────────────────
create table if not exists sistemas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  nome text not null, url text, tipo text,
  uptime_30d numeric(5,2), resposta_ms int,
  ultimo_deploy timestamptz, monitorar boolean default true
);

create table if not exists erros_log (
  id bigserial primary key,
  criado_em timestamptz default now(),
  nivel text, origem text, mensagem text, contagem int default 1
);

-- Só a REFERÊNCIA da credencial. Nunca o valor.
create table if not exists credenciais_ref (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references projetos(id) on delete cascade,
  chave text not null, onde text not null, expira_em date
);

create table if not exists config_site (
  chave text primary key,
  valor text,
  atualizado_em timestamptz default now()
);

-- ─────────────────────────── SEGURANÇA ───────────────────────────
-- Tudo trancado: o painel lê e escreve pelo servidor (service role),
-- que ignora RLS. O site público só pode INSERIR lead e evento.
alter table leads            enable row level security;
alter table eventos_site     enable row level security;
alter table clientes         enable row level security;
alter table contratos        enable row level security;
alter table documentos       enable row level security;
alter table projetos         enable row level security;
alter table tarefas          enable row level security;
alter table checklist_deploy enable row level security;
alter table assinaturas      enable row level security;
alter table lancamentos      enable row level security;
alter table cartao_config    enable row level security;
alter table propostas        enable row level security;
alter table sistemas         enable row level security;
alter table erros_log        enable row level security;
alter table credenciais_ref  enable row level security;
alter table config_site      enable row level security;

drop policy if exists "site insere lead" on leads;
create policy "site insere lead" on leads for insert to anon with check (true);

drop policy if exists "site insere evento" on eventos_site;
create policy "site insere evento" on eventos_site for insert to anon with check (true);

-- Apaga evento bruto com mais de 12 meses (o que o painel promete na aba Config).
-- Agende em Database → Cron (extensão pg_cron), 1x por dia:
--   delete from eventos_site where criado_em < now() - interval '12 months';
