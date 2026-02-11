
# Adicionar colunas extras e filtros na aba Realizadas (Pos-Reuniao)

## Resumo
Enriquecer a tabela de "Reunioes Realizadas" com mais informacoes do lead (regiao, renda, closer, stage, data/hora da reuniao) e adicionar filtros por data, pipeline, closer, e busca por nome/telefone.

## Dados disponiveis no banco

| Informacao | Fonte |
|---|---|
| Nome do lead | `crm_contacts.name` (ja existe) |
| Telefone | `crm_contacts.phone` (ja existe) |
| Pipeline + Stage | `crm_origins.name` + `crm_stages.stage_name` (ja existe parcialmente) |
| Data da reuniao | `meeting_slots.scheduled_at` via `meeting_slot_attendees.deal_id` |
| Regiao (estado) | `crm_deals.custom_fields->>'state'` ou `->>'endereco'` |
| Renda do lead | `crm_deals.custom_fields->>'renda_media'` ou `->>'renda_mensal'` |
| Closer que atendeu | `crm_deals.owner_id` (email) -> join `profiles.email` -> `profiles.full_name` |

## O que muda

### 1. Hook `useConsorcioPostMeeting.ts` - Enriquecer a query `useRealizadas`

- Adicionar `custom_fields` na select do `crm_deals`
- Fazer uma segunda query para buscar dados de `meeting_slot_attendees` + `meeting_slots` (scheduled_at) para os deal_ids retornados
- Fazer lookup do closer via `profiles` usando o `owner_id` (email)
- Expandir a interface `CompletedMeeting` com:
  - `meeting_date: string` (data/hora real da reuniao)
  - `region: string` (estado do lead)
  - `renda: string` (renda media ou mensal)
  - `closer_name: string` (nome do closer - ja existe no tipo mas estava vazio)

### 2. Pagina `PosReuniao.tsx` - Novas colunas e filtros

**Novas colunas na tabela:**
- Pipeline com Stage (ex: "Viver de Aluguel > R1 Realizada")
- Data/Hora da Reuniao (scheduled_at formatado)
- Regiao (estado)
- Renda
- Closer

**Barra de filtros acima da tabela:**
- Input de busca por nome ou telefone
- Select de pipeline (Todas / Viver de Aluguel / Efeito Alavanca)
- Select de closer (lista unica dos closers presentes)
- DatePicker de data da reuniao (periodo)

Filtros sao aplicados client-side sobre os dados ja carregados.

## Secao tecnica

### Arquivo: `src/hooks/useConsorcioPostMeeting.ts`

1. Na funcao `useRealizadas`, apos buscar os deals, fazer queries adicionais:
   - `meeting_slot_attendees` com join em `meeting_slots` para obter `scheduled_at` por `deal_id`
   - `profiles` filtrado por emails unicos dos `owner_id` para obter nomes dos closers
2. Extrair `custom_fields->>'state'` e `custom_fields->>'renda_media'` (com fallback para `renda_mensal`) dos dados ja retornados
3. Atualizar interface `CompletedMeeting` com os novos campos

### Arquivo: `src/pages/crm/PosReuniao.tsx`

1. Adicionar estados de filtro no `RealizadasTab`:
   - `searchTerm` (string) para nome/telefone
   - `pipelineFilter` (string) para pipeline
   - `closerFilter` (string) para closer
   - `dateRange` (start/end) para data da reuniao

2. Renderizar barra de filtros acima da tabela usando:
   - `Input` com icone de busca para nome/telefone
   - `Select` do shadcn para pipeline e closer
   - `Popover` + `Calendar` para filtro de data

3. Aplicar filtros com `useMemo` sobre `realizadas`:
   - Filtro de texto: match em `contact_name`, `deal_name`, `contact_phone`
   - Filtro de pipeline: match em `origin_name`
   - Filtro de closer: match em `closer_name`
   - Filtro de data: comparar `meeting_date` com range selecionado

4. Atualizar colunas da tabela para incluir: Contato, Telefone, Pipeline/Stage, Data Reuniao, Regiao, Renda, Closer, Acoes

Nenhuma mudanca de banco de dados necessaria. 2 arquivos modificados.
