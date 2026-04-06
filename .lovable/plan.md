
# Remover SDR Responsavel e restringir busca por owner

## Problema
1. O campo "SDR Responsavel" e desnecessario para SDRs — o usuario logado deve ser automaticamente o responsavel
2. A busca de leads retorna qualquer lead da BU, permitindo que um SDR agende reuniao com lead de outro SDR (risco de "roubo de lead")

## Alteracoes

### 1. `src/components/crm/QuickScheduleModal.tsx`

**Remover campo SDR Responsavel para SDRs:**
- Adicionar prop `ownerEmail?: string` para receber o email do SDR logado
- Se o usuario NAO for coordenador/admin/manager, ocultar o bloco "SDR Responsavel" (linhas 661-680)
- Passar `user.email` automaticamente como `sdrEmail` no submit quando o campo estiver oculto
- Remover estado `selectedSdr` da logica quando nao visivel

**Restringir busca por owner:**
- Adicionar prop `ownerFilter?: string` (email do owner)
- Passar para `useSearchDealsForSchedule` como novo parametro

### 2. `src/hooks/useAgendaData.ts` — `useSearchDealsForSchedule`

Adicionar parametro `ownerEmail?: string`:
- Quando fornecido, adicionar `.eq('owner_id', ownerEmail)` nas queries de `crm_deals` (tanto busca por nome quanto busca por contato)
- Quando nao fornecido (coordenadores), manter comportamento atual sem filtro

### 3. `src/components/crm/SdrScheduleDialog.tsx`

- Passar `ownerEmail={user.email}` para `QuickScheduleModal` quando chamado do contexto SDR

### 4. Callers existentes (Agenda.tsx, QualificationAndScheduleModal.tsx)

- NAO alterar — coordenadores continuam vendo todos os leads e o campo SDR

## Resultado
- SDR logado ve apenas seus proprios leads na busca
- Campo "SDR Responsavel" some para SDRs (atribuicao automatica)
- Coordenadores/admin/manager mantem acesso completo

## Arquivos alterados
1. `src/hooks/useAgendaData.ts`
2. `src/components/crm/QuickScheduleModal.tsx`
3. `src/components/crm/SdrScheduleDialog.tsx`
