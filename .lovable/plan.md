

# Corrigir visibilidade de leads no agendamento para SDRs

## Problema
Na página **Agenda R1** (`/crm/agenda`), o `QuickScheduleModal` é renderizado **sem** a prop `ownerEmail`. Isso significa que quando um SDR busca um lead para agendar, ele vê **todos os leads** da BU, não apenas os seus. O mesmo ocorre no `R2QuickScheduleModal` em **Agenda R2**.

A proteção já existe no hook `useSearchDealsForSchedule` — ele aceita `ownerEmail` e filtra por `owner_id`. Porém, as páginas de Agenda não passam esse parâmetro para SDRs.

## Solução

### 1. Agenda R1 — `src/pages/crm/Agenda.tsx`
- Extrair `user` do `useAuth()` (já tem `role`)
- Calcular `sdrOwnerEmail`: se o role for `sdr`, usar `user.email`; senão, `undefined`
- Passar `ownerEmail={sdrOwnerEmail}` no `<QuickScheduleModal>`

### 2. Agenda R2 — `src/components/crm/R2QuickScheduleModal.tsx`
- Importar `useAuth` e obter `role` + `user`
- Se role for `sdr`, passar `ownerEmail` para `useSearchDealsForSchedule`
- Atualmente passa apenas `buOriginIds` sem filtro de owner

### Resultado
SDRs verão apenas seus próprios leads ao buscar no modal de agendamento. Coordenadores, admins e managers continuam vendo todos.

| Arquivo | Alteracao |
|---|---|
| `src/pages/crm/Agenda.tsx` | Passar `ownerEmail` para `QuickScheduleModal` quando role = sdr |
| `src/components/crm/R2QuickScheduleModal.tsx` | Filtrar busca por `ownerEmail` quando role = sdr |

