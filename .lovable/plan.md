

## Corrigir Funil por Canal — colunas inexistentes nas queries

### Diagnóstico

A tabela ficou com Entradas / R1 / R2 / Contrato Pago **zeradas** porque duas queries do `useChannelFunnelReport.ts` referenciam colunas que **não existem no banco**, então o Supabase retorna erro/array vazio silenciosamente. Aprovados, Reprovados, Próxima Semana e Venda Final aparecem porque vêm de outras fontes (RPC `get_carrinho_r2_attendees` e `useAcquisitionReport.classified`).

**Erro 1 — Query de deals (`crm_deals`):**
```ts
.select('id, tags, origin_name, lead_channel, data_source, created_at')
```
- `origin_name` **não existe** — a tabela tem `origin_id` (FK para `crm_origins.name`).
- `lead_channel` **não existe** como coluna — está dentro do JSONB `custom_fields->>'lead_channel'`.

**Erro 2 — Query de attendees (`meeting_slot_attendees`):**
```ts
.select('id, deal_id, attendee_status, meeting_slots!inner(meeting_type, scheduled_at, status)')
```
- `attendee_status` **não existe** nessa tabela — a coluna é `status`. (Confusão com o RPC `get_carrinho_r2_attendees` que retorna `attendee_status` como alias.)

Confirmado pelo schema:
- `crm_deals` tem: `id, origin_id, tags, custom_fields, data_source, created_at` (sem `origin_name`/`lead_channel`).
- `meeting_slot_attendees` tem `status`, não `attendee_status`.

E confirmei no banco que existem **2972 deals** e **1219 attendees R1/R2** em abril/2026 — os dados existem, é a query que não consegue lê-los.

### Correção

**Arquivo único:** `src/hooks/useChannelFunnelReport.ts`

1. **Query de deals:** trocar select para `id, tags, origin_id, custom_fields, data_source, created_at` e fazer JOIN com `crm_origins` para puxar o `origin_name`:
   ```ts
   .select('id, tags, custom_fields, data_source, created_at, crm_origins(name)')
   ```
   Mapear no resultado: `origin_name = row.crm_origins?.name ?? null`, `lead_channel = row.custom_fields?.lead_channel ?? null`.

2. **Query de attendees:** trocar `attendee_status` por `status`:
   ```ts
   .select('id, deal_id, status, meeting_slots!inner(meeting_type, scheduled_at, status)')
   ```
   E ajustar a interface `AttendeeFunnelRow` (renomear `attendee_status` → `status`) e a leitura na deduplicação (linha 235): `const status = (a.status || a.meeting_slots?.status || '').toLowerCase();`.

3. **(Opcional, mas recomendado) Filtrar deals por BU:** adicionar filtro `.in('origin_id', originIds)` quando `bu` está definido, usando o mesmo helper que outros relatórios usam (`useBuOriginIds(bu)`). Sem isso, a tabela mostra deals de todas as BUs misturados (incluindo Consórcio/Crédito), o que infla "Entradas" e quebra a leitura. Vou usar o mesmo padrão já presente em `useAcquisitionReport`.

### Resultado esperado após o fix (preset Mês, BU Incorporador)

- **Entradas** passa a mostrar a contagem real de deals criados no mês por canal (centenas/milhares).
- **R1 Agendada/Realizada e Contrato Pago** passam a refletir os attendees reais (1219 attendees no mês).
- **R2 Agendada/Realizada** idem.
- Aprovados/Reprovados/Próx. Semana/Venda Final/Faturamento **continuam corretos** (já estavam funcionando).
- A conversão "Aprovado → Venda Final" deixa de mostrar 735.8% (986/134) porque Venda Final passa a estar no mesmo eixo de comparação consistente — embora valores >100% ainda sejam possíveis em filtros largos por causa de OUTSIDE/A010 sem deal correspondente.

### Validações pós-fix

1. Total de **Entradas** > 0 e próximo do número de deals criados no período (≈2972 em abril).
2. Total de **R1 Agendada** entre 600 e 1100 (deduplicação por deal de 1219 attendees R1+R2).
3. Total de **Faturamento** continua batendo com o card "Faturamento Bruto/Líquido" no topo.
4. Nenhuma linha do console com erro tipo "column ... does not exist".

### Reversibilidade

Mudança isolada num único hook (~15 linhas). Zero impacto em outros relatórios.

### Fora do escopo

- Não vou alterar o RPC `get_carrinho_r2_attendees` nem o `useAcquisitionReport`.
- Não vou implementar filtro por Closer/Search no funil (esses filtros do painel já não eram aplicados ao funil — fica para próxima iteração se você pedir).
- Não vou tocar nas outras tabelas do painel (Faturamento por Closer, SDR, etc.).

