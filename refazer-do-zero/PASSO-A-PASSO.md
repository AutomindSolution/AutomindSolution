# Refazer do zero — passo a passo

Você não vai escrever código. Você vai preparar as contas, e o Claude Code escreve o código
usando o `prompt-claude-code.md` deste pacote. Siga na ordem. Onde tiver `⌨️`, é comando para
colar no Terminal. Onde tiver `🖱️`, é clique no navegador.

Tempo estimado: uma tarde para os passos 1–6, o resto é acompanhar o Claude Code.

---

## Passo 1 — Repositório novo, limpo

🖱️ Em github.com/AutomindSolution → **New repository** → nome `automind-web` → **Private** → Create.

Deixe a repo antiga (`Automind`) parada como está. Não apague nada por enquanto: ela é o seu
backup e a fonte dos textos do site. Quando o novo estiver no ar e estável por duas semanas,
você arquiva a antiga (Settings → Archive this repository).

⌨️ No seu computador:
```bash
cd ~/Documents            # ou onde você guarda projetos
npx create-next-app@latest automind-web --typescript --app --no-tailwind --eslint
cd automind-web
git remote add origin https://github.com/AutomindSolution/automind-web.git
git branch -M main
git push -u origin main
```

Se ele perguntar algo que não está na lista acima, aceite o padrão (Enter).

---

## Passo 2 — Supabase (banco + login)

🖱️ Em supabase.com → **New project** → nome `automind` → região **South America (São Paulo)** →
gere e **guarde a senha do banco** no seu cofre.

🖱️ Menu **SQL Editor** → **New query** → cole todo o conteúdo de `schema.sql` (deste pacote) →
**Run**. Deve aparecer "Success". Isso cria as 16 tabelas do site e do CRM já com as travas
de segurança.

🖱️ Menu **Project Settings → API**. Anote três valores (vai precisar no passo 5):
- `Project URL`
- `anon public`
- `service_role` ← **essa é secreta, nunca vai para o GitHub**

---

## Passo 3 — Login com Google

🖱️ Em console.cloud.google.com → crie um projeto `automind` (ou use o que já existe).

1. **APIs e serviços → Tela de consentimento OAuth** → tipo **Externo** → nome "Automind
   Admin" → e-mail de suporte `atendimento@automindsolution.com.br` → Salvar.
2. **APIs e serviços → Biblioteca** → busque **Google Calendar API** → **Ativar**.
   (É isso que faz a tarefa virar evento na agenda.)
3. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**.
   Em *URIs de redirecionamento autorizados*, cole a URL que o Supabase mostra em
   **Authentication → Providers → Google** (algo como
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
   Anote o **Client ID** e o **Client Secret**.
4. 🖱️ De volta ao Supabase → **Authentication → Providers → Google** → cole Client ID e Secret →
   em *Additional Scopes* escreva `https://www.googleapis.com/auth/calendar.events` → **Save**.

---

## Passo 4 — Instalar o Claude Code

⌨️ No Terminal:
```bash
npm install -g @anthropic-ai/claude-code
cd ~/Documents/automind-web
claude
```

Na primeira vez ele pede para você entrar com sua conta Anthropic. Depois disso, você conversa
com ele em português dentro dessa pasta, e ele escreve os arquivos.

---

## Passo 5 — Variáveis de ambiente

⌨️ Dentro de `automind-web`, crie o arquivo `.env.local` (peça ao Claude Code: *"cria o
.env.local com essas variáveis"* e cole os valores):

```
NEXT_PUBLIC_SUPABASE_URL=...................   (Project URL do passo 2)
NEXT_PUBLIC_SUPABASE_ANON_KEY=..............   (anon public)
SUPABASE_SERVICE_ROLE_KEY=..................   (service_role — secreta)
ADMIN_EMAILS=atendimento@automindsolution.com.br
```

⚠️ Confirme que a primeira linha do `.gitignore` inclui `.env*.local`. Se a chave `service_role`
vazar para o GitHub, qualquer pessoa lê e escreve no seu banco inteiro.

Quando o sócio precisar de acesso, é só acrescentar o e-mail dele separado por vírgula:
`ADMIN_EMAILS=atendimento@...,socio@...`

---

## Passo 6 — Mandar o Claude Code construir

⌨️ Dentro do `claude`, cole o conteúdo de `prompt-claude-code.md` (deste pacote) e mande.
Ele vai construir em etapas e parar para você olhar. Depois de cada etapa:

```bash
npm run dev      # abre http://localhost:3000 e http://localhost:3000/admin
```

Olhe, aponte o que está diferente do protótipo (`Admin.dc.html`, abra no navegador ao lado) e
peça o ajuste. Quando gostar:

```bash
git add -A && git commit -m "feat: etapa 1" && git push
```

---

## Passo 7 — Publicar na Vercel

🖱️ Em vercel.com → **Add New → Project** → importe `AutomindSolution/automind-web` → em
**Environment Variables** cole as mesmas quatro linhas do `.env.local` → **Deploy**.

🖱️ **Settings → Domains**: por enquanto use o domínio `.vercel.app` que ele te dá. Só aponte
`automindsolution.com.br` para o projeto novo quando o site novo estiver pronto — até lá o
site antigo continua no ar, sem ninguém perceber a troca.

🖱️ Depois do primeiro deploy, volte ao Google Cloud (passo 3) e acrescente a URL de produção
nas URIs de redirecionamento, senão o login só funciona no seu computador.

---

## Passo 8 — Ordem de construção (o que pedir, nesta ordem)

1. Site público: home, serviços, cases, sobre, contato, privacidade. Sem CRM ainda.
2. `/admin` com login Google e a casca do painel (menu lateral + 10 abas vazias).
3. Aba Clientes & Contratos — é a base de tudo: sem cliente cadastrado, nenhuma outra aba tem o
   que mostrar.
4. Aba Financeiro (ciclo do cartão + assinaturas + a receber/a pagar).
5. Aba Tarefas com Google Calendar.
6. Coleta de eventos no site público + banner de consentimento.
7. Abas Leads, Projetos, Analytics, Propostas, Sistemas, Config.

Depois de cada uma: use por dois ou três dias de verdade antes de pedir a próxima. Aba que você
não usa é aba que você desenhou errado — e é mais barato descobrir isso cedo.

---

## O que você NUNCA faz

- Não coloque chave, senha ou token dentro do código. Só em `.env.local` e na Vercel.
- Não guarde valor de credencial de cliente no banco — só o nome da variável e onde ela vive
  (a tabela `credenciais_ref` já é assim de propósito).
- Não dispare evento de rastreamento antes do aceite no banner.
- Não trabalhe direto na `main` depois que o site estiver no ar: peça ao Claude Code para
  criar uma branch (`git checkout -b feat/nome`) e só junte quando estiver funcionando.
