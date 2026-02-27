

## Plano: Redesenhar cards de Contatos com hierarquia visual e filtros avançados

### 1. Novo hook `useContactsEnriched` em `src/hooks/useContactsEnriched.ts`
- Query que busca contatos com deals enriquecidos:
  - `crm_contacts` → `crm_deals(*, crm_stages(stage_name, color), crm_origins(name))`
  - Inclui `owner_id`, `original_sdr_email`, `r1_closer_email`, `stage_moved_at`, `last_worked_at`
- Calcular no frontend para cada contato:
  - **Dias sem movimentação**: `differenceInDays(now, deal.last_worked_at || deal.stage_moved_at)`
  - **Status térmico**: Quente (≤3 dias), Morno (4-7), Frio (8-14), Perdido (>14)
  - **isDuplicate**: flag baseado em contagem de contatos com mesmo email
- Buscar última atividade via `deal_activities` (última por `created_at` para cada deal)
- Resolver nomes de SDR/Closer via `profiles` pelo email

### 2. Novo componente `ContactCard` em `src/components/crm/ContactCard.tsx`
- Layout redesenhado com hierarquia:
  - **Topo**: Nome do contato (grande) + badge de status térmico (Quente/Morno/Frio com cores)
  - **Destaque principal**: Badge da etapa do funil — grande, com cor do stage, posição dominante
  - **Pipeline**: Nome da pipeline/origem em texto menor
  - **Dados operacionais** (grid 2 colunas, texto xs):
    - SDR responsável
    - Closer responsável
    - Última ação (tipo + data relativa: "Ligação há 2 dias")
    - Dias sem movimentação (com ícone de alerta se >7 dias)
  - **Indicador visual de prioridade**: Borda lateral colorida (verde=quente, amarelo=morno, laranja=frio, vermelho=perdido)
  - **Selo "Duplicado"**: Badge vermelha se contato tem duplicatas por email
  - Contatos parados >7 dias: opacidade reduzida ou borda vermelha pulsante
- Email e telefone em texto discreto (muted)

### 3. Barra de filtros em `src/components/crm/ContactFilters.tsx`
- Filtros com `Select` em linha horizontal (flex-wrap):
  - **Pipeline**: Lista de `crm_origins` (reutilizar `useCRMOrigins`)
  - **Etapa do funil**: Stages filtradas pela pipeline selecionada
  - **SDR**: Lista de profiles com role SDR
  - **Closer**: Lista de profiles com role Closer
  - **Status**: Quente / Morno / Frio / Perdido
  - **Data de criação**: Select com presets (7/30/90 dias)
- Botão "Limpar filtros"
- Contador de resultados filtrados

### 4. Refatorar `src/pages/crm/Contatos.tsx`
- Substituir `useCRMContactsWithDeals` pelo novo `useContactsEnriched`
- Adicionar `<ContactFilters>` entre busca e grid
- Substituir cards inline pelo novo `<ContactCard>`
- Aplicar filtros no `filteredContacts` (pipeline, stage, sdr, closer, status, data)
- Manter `ContactDetailsDrawer` e `ContactFormDialog`

### Detalhes técnicos
- Status térmico calculado via `date-fns.differenceInDays`
- Detecção de duplicados: agrupar contatos por email no resultado da query, marcar os que aparecem >1 vez
- Última ação: buscar `deal_activities` com limit 1 por deal, ordenado por `created_at desc`
- Nomes de SDR/Closer: resolver `original_sdr_email` e `r1_closer_email` contra tabela `profiles`

