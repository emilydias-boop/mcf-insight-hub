

## Relatório "Não Comprou" — Leads que saíram do carrinho R2 sem comprar

### Resumo
Quando o usuário marca "Não Comprou" em um lead aprovado no Carrinho R2, esse lead já é marcado com `carrinho_status = 'nao_comprou'` na tabela `meeting_slot_attendees`. Vou criar um novo tipo de relatório na Central de Relatórios da BU Incorporador que lista esses leads com histórico completo, filtros e exportação.

### Mudanças

**1. Novo tipo de relatório: `ReportTypeSelector.tsx`**
- Adicionar `'nao_comprou'` ao tipo `ReportType`
- Novo card: título "Não Comprou", descrição "Leads aprovados que não compraram", ícone `UserX`

**2. Novo hook: `src/hooks/useNaoComprouReport.ts`**
- Buscar `meeting_slot_attendees` com `carrinho_status = 'nao_comprou'` e `meeting_type = 'r2'`
- Joins: `meeting_slots` (data R2, closer), `crm_deals` (deal info, contact_id), `crm_contacts` (nome, email, telefone)
- Buscar R1 info: closer R1, data R1 (dos campos já existentes `r1_date`, `r1_closer_name` ou via attendee R1)
- Buscar histórico de ligações (`calls` por deal_id): total de ligações, primeira ligação, última ligação
- Buscar notas do closer (`closer_notes`, `attendee_notes`)
- Filtros: período (por `carrinho_updated_at`), closer R2, closer R1
- Retornar interface `NaoComprouLead` com: nome, telefone, email, closer R1, data R1, closer R2, data R2, total ligações, última ligação, notas do closer, motivo/observações

**3. Novo componente: `src/components/relatorios/NaoComprouReportPanel.tsx`**
- Filtros: período (DatePicker range baseado em `carrinho_updated_at`), closer R2, closer R1
- Tabela com colunas: Nome, Telefone, Email, Closer R1, Data R1, Closer R2, Data R2, Ligações, Última Ligação, Notas
- Botão "Exportar CSV/Excel" para disparo futuro
- Botão "Copiar Relatório" (clipboard)
- Linha expansível ou drawer para ver histórico completo do lead (timeline resumida)

**4. Integrar no `BUReportCenter.tsx`**
- Adicionar renderização condicional para `selectedReport === 'nao_comprou'`
- Importar `NaoComprouReportPanel`

**5. Atualizar `bu-incorporador/Relatorios.tsx`**
- Adicionar `'nao_comprou'` ao array `availableReports`

**6. Opcional: na `R2AprovadosList.tsx`**
- Ao clicar "Não Comprou", após atualizar o status, exibir toast com link para o relatório ("Ver em Relatórios → Não Comprou")

### Arquivos a editar/criar
- `src/components/relatorios/ReportTypeSelector.tsx` — adicionar tipo
- `src/hooks/useNaoComprouReport.ts` — novo hook de dados
- `src/components/relatorios/NaoComprouReportPanel.tsx` — novo painel
- `src/components/relatorios/BUReportCenter.tsx` — integrar painel
- `src/pages/bu-incorporador/Relatorios.tsx` — adicionar ao availableReports

