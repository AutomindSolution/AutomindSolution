repo: AutomindSolution/Automind
branch: main
path: app/

## Last sync
date: 2026-08-17T18:44:00Z

### Updated in this project
- Protótipo do novo /admin (CRM completo, 10 abas) desenhado em `Admin.dc.html`
- Login Google restrito a atendimento@automindsolution.com.br
- Pacote de migração em `design_handoff_admin_crm/` (leitura da repo real, sem escrita)

## Screen map
| Tela / módulo | Arquivos da repo |
| --- | --- |
| Login /admin | app/admin/page.tsx · app/admin/LoginScreen.tsx · app/admin/AccessDenied.tsx · app/lib/supabase/server.ts · app/auth/callback/route.ts |
| Leads (existente) | app/admin/AdminDashboard.tsx · LeadsTable.tsx · LeadDrawer.tsx · StatsPanel.tsx · app/lib/leads.ts · app/lib/admin-api.ts · app/api/admin/* |
| Coleta no site público | app/page.tsx · app/LeadModal.tsx · app/Pixels.tsx · app/lib/track.ts · app/api/lead/route.ts |
| Estilos | app/globals.css |
