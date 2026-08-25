# Prompt para o Claude Code

Cole tudo abaixo da linha dentro do `claude`, na pasta `automind-web`.
Antes, copie para dentro da pasta: `Admin.dc.html`, `support.js`, `README.md` e `schema.sql`
(numa subpasta `design/`), para que ele possa abrir o protótipo.

---

Você vai construir do zero o site e o painel interno da Automind (agência de CRM, automação e
sites, Rio de Janeiro). Fale comigo em português. Eu não sou desenvolvedor experiente: explique
cada etapa em uma frase antes de executar, e pare para eu ver o resultado.

**Contexto do projeto**
- Next.js 16 (App Router), TypeScript, React 19, CSS puro com variáveis (sem Tailwind, sem
  biblioteca de componentes, sem gerenciador de estado).
- Supabase para banco e autenticação; o esquema já está criado — leia `design/schema.sql` para
  conhecer as tabelas. Não crie tabela nova sem me perguntar.
- Deploy na Vercel. Variáveis já em `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`.

**Design de referência**
`design/Admin.dc.html` é o protótipo do painel `/admin`, em alta fidelidade. Abra no navegador e
recrie fielmente em React: estrutura, cores, tipografia, espaçamento, estados vazios e textos.
É referência de design, não código para copiar. `design/README.md` traz os tokens exatos
(cores, tipos, réguas de 2px, raio 0) e a descrição de cada uma das 10 abas.

**Regras não negociáveis**
1. `/admin` exige login Google e só libera e-mails listados em `ADMIN_EMAILS`. Sem sessão →
   tela de login; e-mail fora da lista → tela de acesso negado, sem criar sessão.
2. Toda leitura e escrita do painel acontece no servidor (route handlers com a service role).
   A chave `service_role` nunca aparece em componente de cliente.
3. `/admin` com `robots: { index: false, follow: false }`. Nada de link para o painel no site.
4. Nenhuma senha, token ou chave de cliente é gravada no banco — só o nome da variável e onde
   ela vive (`credenciais_ref`).
5. Nenhum evento de rastreamento dispara antes do aceite no banner de consentimento; telefone,
   nome e e-mail nunca vão para `localStorage`.
6. Estilos do painel ficam em `app/admin/admin.css`, separados do CSS do site público.
7. Todo módulo tem estado vazio, estado de carregando e estado de erro. O protótipo mostra os
   estados vazios prontos — copie os textos.

**Construa nesta ordem, parando ao fim de cada etapa para eu revisar:**

**Etapa 1 — fundação.** Estrutura do projeto, `app/lib/supabase/{client,server}.ts`,
`requireAdmin()` lendo `ADMIN_EMAILS`, rota `/auth/callback`, e `/admin` com as três telas de
porta (login, acesso negado, faltando configuração) já no visual do protótipo.

**Etapa 2 — casca do painel.** `AdminShell` com a barra lateral de 236px, o topo com busca e
botão "+ Novo registro", e as 10 abas navegando por estado local (uma URL só). Abas ainda
vazias, cada uma com seu estado vazio do protótipo.

**Etapa 3 — Clientes & Contratos.** CRUD completo: listar, criar, editar, arquivar. Calcule
margem (`(mrr - custo_mensal) / mrr`) e destaque abaixo de 55%. Formulário simples, teclado
primeiro. É a base das outras abas.

**Etapa 4 — Financeiro.** Assinaturas, lançamentos a receber/a pagar, `cartao_config`. Implemente
os cálculos do protótipo: quanto do ciclo do cartão já está comprometido, a melhor janela para
assinar uma ferramenta nova (entre o fechamento e o vencimento), assinatura ociosa (sem uso há
mais de 30 dias) e custo real por cliente pelo rateio.

**Etapa 5 — Radar de vencimentos** na aba Visão geral: uma consulta única que junta contratos a
renovar, lançamentos a vencer, fechamento do cartão e domínios, ordenados por data, com os dias
restantes. É a peça mais importante do painel.

**Etapa 6 — Tarefas + Google Calendar.** CRUD de tarefas; ao salvar com a opção marcada, criar
evento no Google Calendar e guardar o `gcal_event_id`. Se o Calendar falhar, a tarefa salva
mesmo assim e aparece como "sem evento". Nunca perca a tarefa por causa da agenda.

**Etapa 7 — site público** (home, serviços, cases, sobre, contato, privacidade) com banner de
consentimento e a coleta de eventos descrita na aba Analytics do protótipo:
`session_start`, `whatsapp_click`, `cta_click`, `niche_card_click`, `section_view`,
`scroll_depth`, `search_term`, `return_visit` — gravados em `eventos_site` via `POST /api/track`
com `navigator.sendBeacon`.

**Etapa 8 — abas restantes:** Leads (kanban de 4 etapas + detalhe com a trilha da sessão),
Projetos & Sprints (com checklist de deploy), Analytics, Propostas (com a calculadora de preço),
Sistemas & Deploys, Config do site.

Ao terminar cada etapa: rode `npm run build`, corrija o que quebrar, e me diga em duas linhas o
que mudou e o que eu devo testar. Escreva também um `CLAUDE.md` na raiz descrevendo a estrutura
real do projeto, e mantenha esse arquivo atualizado a cada etapa.
