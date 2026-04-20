

## Liberar permissões avançadas individuais para SDRs (caso Caroline Corrêa)

### Resumo

Hoje, no drawer da agenda (`AgendaMeetingDrawer.tsx` e `R2MeetingDetailDrawer.tsx`), todas as ações "de gestor" estão escondidas via `isSdr = role === 'sdr'`. Isso bloqueia o SDR de:
- Marcar reunião como **Realizada** ou **Voltar para Agendada** (remanejar sem precisar aplicar No-Show)
- **Vincular Contrato Pago** (R1)
- **Reagendar** participante (R2)
- **Cancelar / Restaurar reunião** (R2)

Vamos seguir o mesmo padrão já usado no `can_book_r2`: criar **flags individuais por usuário** na tabela `profiles`, configuráveis na aba "Geral" do drawer de Gerenciamento de Usuários (`/usuarios`). Quando ligadas, o SDR ganha as ações específicas, mesmo mantendo o `role = sdr`.

### Novas flags (em `profiles`)

| Coluna | Default | O que libera quando `true` |
|---|---|---|
| `can_manage_agenda` | `false` | Voltar para Agendada / Realizada / Reagendar (R1+R2), Mover lead sem No-Show |
| `can_handle_no_show` | `false` | Já é livre hoje — vira flag explícita por consistência (futuro: bloquear caso `false`) |
| `can_link_contract` | `false` | Botão "Vincular Contrato" (R1), marcar Contrato Pago manualmente |
| `can_cancel_meeting` | `false` | Cancelar reunião / Desfazer cancelamento (R2), Excluir reunião |

> Nada disso muda o `role`. A Caroline continua `sdr`. O sistema apenas concede capacidades extras pontuais a ela.

### Mudanças no banco

Migration única:
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_manage_agenda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_handle_no_show boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_link_contract boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_cancel_meeting boolean NOT NULL DEFAULT false;
```

### Mudanças no frontend

**1. Hook novo `src/hooks/useMyAgendaCapabilities.ts`**
Lê o profile do usuário logado e retorna:
```ts
{ canManageAgenda, canHandleNoShow, canLinkContract, canCancelMeeting, isAdmin }
```
Admin/manager/coordenador → todas `true` automaticamente.

**2. `src/components/crm/AgendaMeetingDrawer.tsx`**
Substituir as condições `!isSdr` pelas capabilities específicas:
- "Voltar para Agendada" / "Realizada" / "Mover" → `canManageAgenda || !isSdr`
- "Vincular Contrato" → `canLinkContract || !isSdr`
- Botão de excluir reunião → adicionar `can_cancel_meeting` ao `DELETE_ALLOWED_ROLES` check

**3. `src/components/crm/R2MeetingDetailDrawer.tsx`**
- Botão "Reagendar" → `canManageAgenda || !isSdr`
- "Cancelar Reunião" / "Desfazer Cancelamento" → `canCancelMeeting || !isSdr`
- Botão de remover participante (`handleRemoveAttendee`) → `canManageAgenda || !isSdr`

**4. `src/components/user-management/UserDetailsDrawer.tsx` — aba "Geral"**
Adicionar uma nova seção **"Permissões avançadas da Agenda"** (apenas para usuários com role `sdr`, escondida para admins/managers/coordenadores que já têm tudo):

```
┌─ Permissões avançadas da Agenda ──────────────┐
│  Gerenciar agenda (remanejar/realizada)  [⚪] │
│  Tratar No-Show                          [⚫] │
│  Vincular contratos pagos                [⚪] │
│  Cancelar / excluir reuniões             [⚪] │
└────────────────────────────────────────────────┘
```

Cada switch faz o mesmo pattern do `handleToggleCanBookR2` existente — `UPDATE profiles SET can_xxx = checked WHERE id = userId`, com toast e invalidate.

**5. `src/hooks/useUsers.ts`** — incluir as 4 novas colunas no `useUserDetails`.

**6. `src/types/user-management.ts`** — adicionar os 4 campos opcionais em `UserDetails`.

### Para a Caroline especificamente

Após o deploy, basta abrir `/usuarios` → clicar em **Gerenciar** na Caroline → na aba **Geral**, ligar:
- ✅ Gerenciar agenda
- ✅ Vincular contratos pagos
- ✅ Cancelar / excluir reuniões

Imediatamente ela terá os mesmos botões que coordenadora/manager têm, sem mudar o role dela (continua aparecendo como SDR nas métricas, dashboards, distribuição de leads, etc.).

### Validação

1. Logar como Caroline antes do toggle → drawer da agenda mostra apenas No-Show e Mover (estado atual)
2. Admin liga as 3 flags em `/usuarios` → Caroline
3. Caroline recarrega → vê "Voltar para Agendada", "Realizada", "Vincular Contrato", "Cancelar Reunião"
4. Verificar que outros SDRs (Geison, Felipe etc.) **NÃO** veem esses botões
5. Verificar que admin/manager continuam vendo tudo normalmente
6. Verificar que `useR2Bookers` (que filtra `can_book_r2 = true`) não é afetado

### Escopo

- 1 migration (ADD COLUMN x4 em `profiles`)
- 1 hook novo (`useMyAgendaCapabilities`)
- 3 arquivos editados (`AgendaMeetingDrawer`, `R2MeetingDetailDrawer`, `UserDetailsDrawer`)
- 2 arquivos de tipos atualizados (`useUsers.ts`, `user-management.ts`)
- Zero alteração em RLS, edge functions, métricas ou role priority
- Reversível (basta desligar o switch)

