

## Alinhar abas do Carrinho R2 com a lógica de safra

### Problema
Os KPIs do topo ja usam logica de safra (contratos → contacts → R2 pos-contrato), mas as abas "Todas R2s", "Fora do Carrinho", "Aprovados" e "Metricas" buscam R2 por janela de data (`boundaries.r2Meetings`), gerando divergencia entre topo e abas.

### Fase 1 — Alinhar dados (esta implementacao)

Migrar os 3 hooks de dados das abas para a mesma logica de safra dos KPIs.

#### 1. `src/hooks/useR2CarrinhoData.ts`
Refatorar para seguir o caminho da safra:
- Buscar contratos pagos (Thu-Wed) via `hubla_transactions` (mesma query dos KPIs)
- Resolver emails → `crm_contacts` → `contact_ids`
- Buscar `meeting_slot_attendees` desses contacts com `meeting_type='r2'`, sem filtro de data
- Filtrar apenas R2 com `scheduled_at > sale_date` (primeira R2 valida por contrato)
- Aplicar filtros de status existentes (`agendadas`, `aprovados`, etc.) sobre esses attendees
- Manter a interface `R2CarrinhoAttendee` inalterada para nao quebrar componentes

#### 2. `src/hooks/useR2ForaDoCarrinhoData.ts`
Mesma migracao:
- Buscar contratos da safra → contacts → R2 attendees com status "fora do carrinho" e `scheduled_at > sale_date`
- Manter interface `R2ForaDoCarrinhoAttendee` inalterada

#### 3. `src/hooks/useR2MetricsData.ts`
Este e o mais desalinhado — busca R2 por `weekStart/weekEnd` cru (linhas 76-77) e vendas pela mesma janela (linhas 328-329):
- Buscar contratos da safra (`boundaries.contratos`) como base
- Resolver contacts → R2 attendees pos-contrato
- Vendas pela janela `boundaries.vendasParceria`
- Deduplicacao por deal permanece, mas aplicada sobre R2 da safra
- Manter interface `R2MetricsData` inalterada

#### 4. `src/pages/crm/R2Carrinho.tsx`
- Mudar `defaultValue="metricas"` para `defaultValue="agendadas"`
- Atualizar subtitulo para mostrar a safra: "Safra: Contratos de DD/MM a DD/MM"
- Passar `weekStart`/`weekEnd` e `carrinhoConfig` para `useR2MetricsData` (atualmente recebe apenas weekStart/weekEnd sem boundaries)

### Resultado
Topo e todas as abas partem da mesma base de contratos (Thu-Wed), eliminando divergencias. A estrutura visual e componentes das abas nao mudam — apenas a fonte de dados e unificada.

### Arquivos alterados
1. `src/hooks/useR2CarrinhoData.ts`
2. `src/hooks/useR2ForaDoCarrinhoData.ts`
3. `src/hooks/useR2MetricsData.ts`
4. `src/pages/crm/R2Carrinho.tsx`

