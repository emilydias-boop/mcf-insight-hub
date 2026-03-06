

## Plano: Novo Relatório "Investigação" nos Relatórios BU Incorporador

### Objetivo
Criar uma aba "Investigação" na Central de Relatórios que permite consultar rapidamente o dia detalhado de um **Closer/SDR** ou buscar informações de um **Lead** específico, mostrando reuniões, status, CPs, no-shows — tudo em uma única tela.

### Alterações

**1. `src/components/relatorios/ReportTypeSelector.tsx` — Novo tipo `investigation`**
- Adicionar `'investigation'` ao tipo `ReportType`
- Adicionar card com ícone `Search`, título "Investigação", descrição "Consulta detalhada por closer/SDR ou lead"

**2. `src/components/relatorios/InvestigationReportPanel.tsx` — Novo painel (componente principal)**

Interface com dois modos de busca via tabs:
- **Por Closer/SDR**: Select de closer (usa `useGestorClosers`), date picker de dia único → mostra todas as reuniões do dia daquele closer com seus attendees, status, CPs, no-shows
- **Por Lead**: Input de texto (nome/email/telefone) → busca em `crm_deals` + `meeting_slot_attendees` → mostra histórico completo do lead (reuniões, status, closer, SDR, transações)

Seções de resultado:
- **KPI cards resumo**: Total de leads no dia, realizadas, no-shows, CPs
- **Tabela detalhada**: Cada attendee com nome, telefone, email, horário, status, closer, SDR de origem, observações
- Exportação para Excel (mesmo padrão dos outros painéis)

**3. `src/hooks/useInvestigationReport.ts` — Hook de dados**

Dois query modes:
- `byCloser(closerId, date)`: Busca `meeting_slots` do closer na data → `meeting_slot_attendees` com joins para `crm_deals` (contato, stage, owner) → computa métricas agregadas
- `byLead(searchTerm)`: Busca em `crm_deals` por nome/email/telefone do contato → `meeting_slot_attendees` → `meeting_slots` + `closers` → monta timeline de reuniões do lead

Filtra `is_partner = false` por padrão.

**4. `src/components/relatorios/BUReportCenter.tsx` — Registrar painel**
- Importar `InvestigationReportPanel`
- Adicionar case `selectedReport === 'investigation'`

**5. `src/pages/bu-incorporador/Relatorios.tsx` — Incluir na lista**
- Adicionar `'investigation'` ao array `availableReports`

### Resultado
O usuário pode selecionar "Investigação", escolher um closer e uma data para ver o dia detalhado (como foi feito manualmente para a Thayna), ou buscar um lead específico para ver todo seu histórico de reuniões e status.

