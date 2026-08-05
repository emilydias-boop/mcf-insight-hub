# Diagnóstico: "não consigo adicionar nota" — Jessica Martins (closer)

Deal investigado: "Benigno Rocha dos Santos Junior - A010" (`cf4b922a-...`), stage "Reunião 02 Realizada", BU Incorporador.

## Resumo do que foi confirmado

**Não existe nenhuma regra que bloqueie nota por causa de stage de R2.** Nenhum componente ou hook de nota consulta stage, `r2_closer_email`, `owner_id` ou role antes de gravar. As policies de RLS confirmadas no banco também não têm essa restrição.

O que existe de verdade, e é a explicação mais provável do relato dela, é uma **regra de permissão por role nos stages de R2 combinada com o fato de a Jessica ter DUAS roles (`closer` + `sdr`)**. Nos stages `r2_agendada` / `r2_realizada` / `r1_realizada`, a role `sdr` tem `can_edit = false`, `can_move_from = false`; a role `closer` tem tudo `true`. O hook que resolve isso (`useStagePermissions`) carrega as linhas das duas roles e usa a **primeira** que casar, sem priorizar `closer` — então, dependendo da ordem retornada pelo banco, ela pode cair na linha de `sdr` e ficar sem permissão de editar/mover o negócio nesses stages. É isso que produz a sensação de "o sistema entende que ele está na R2 e não me deixa".

## Mapeamento técnico

### Onde se adiciona nota (dois caminhos independentes)

1. **Aba "Notas" do negócio** (Kanban → drawer do negócio)
   - UI: `src/components/crm/DealNotesTab.tsx` (textarea + botão "Adicionar Nota"), renderizada em `DealDetailsDrawer.tsx:262` sem nenhuma condição de stage/role.
   - Hook: `useAddDealNote` (`src/hooks/useNextAction.ts:101`) → grava em `deal_activities` com `activity_type: 'note'`.
   - Erros: sucesso "Nota adicionada"; falha `Erro ao adicionar nota: <mensagem do Supabase>`.

2. **Aba "Notas" do drawer da Agenda R2** (e o equivalente na Agenda R1)
   - UI: `src/components/crm/r2-drawer/R2NotesTab.tsx` (dentro de `R2MeetingDetailDrawer.tsx:604/614`); na Agenda R1 é `AttendeeNotesSection.tsx` (`AgendaMeetingDrawer.tsx:929`, `canAddNotes={true}`).
   - Hook: `useAddAttendeeNote` (`src/hooks/useAttendeeNotes.ts:102`) → grava em `attendee_notes` com `note_type: 'r2'` (ou `general` na R1), sempre com `created_by = auth.uid()`.
   - Erros: "Digite uma nota" (texto vazio), "Erro ao adicionar nota" (genérico, sem detalhe do banco), "Nota adicionada!".
   - Observação: o formulário só aparece se existir `attendee.id`. Para esse lead existe attendee de R2 (slot 05/08 17:30, closer Jessica Martins, status `completed`), então o formulário deveria aparecer na Agenda R2.

### RLS (verificado no banco, não só nas migrations)
- `attendee_notes`: INSERT `with_check (auth.uid() = created_by)`; SELECT `true`; UPDATE/DELETE só do autor.
- `deal_activities`: INSERT `auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid())`; SELECT `true`.
- Nenhuma policy olha stage, dono do deal ou closer da R2. Um closer que não é dono do negócio consegue inserir nota nos dois caminhos.

### Onde o R2 realmente muda comportamento (mas não é nota)
- `src/hooks/useStagePermissions.ts:15-27` — `CLOSER_ONLY_STAGE_PATTERNS` inclui "reunião 02 realizada": esconde colunas do Kanban para SDR.
- `useStagePermissions.ts:154-168` — `findPermission` faz `permissions.find(...)` sobre as linhas de **todas** as roles do usuário, sem desempate por prioridade. Com `closer` + `sdr`, o resultado é indeterminado.
- `stage_permissions` no banco: `sdr` em `r2_realizada` = `can_view true / can_edit false / can_move_from false / can_move_to false`; `closer` = tudo `true`.
- `enforce_meeting_status_lock` (trigger) só bloqueia **mudança de status** de reunião em mês fechado, com a mensagem "Mês YYYY-MM está fechado…" — não afeta notas.
- `trg_auto_move_em_contato_from_activity` só move o deal se ele estiver em stage de topo de funil; em stage de R2 não faz nada.

## Próximo passo que eu preciso de você

Para fechar a causa raiz com certeza, preciso saber **de qual tela** a Jessica tentou e **qual texto exato** apareceu:

- Kanban → abrir o negócio → aba "Notas" (mensagem esperada em falha: "Erro ao adicionar nota: …")
- Agenda R2 → abrir a reunião → aba "Notas" → "Adicionar Nota" (mensagem esperada: "Erro ao adicionar nota")
- ou nenhuma mensagem: o botão/textarea simplesmente não aparece (aí o problema é a reunião não estar visível/o negócio não estar visível no Kanban, não o insert).

Com isso eu confirmo se o caso é (a) o bug de dupla role em `useStagePermissions`, (b) visibilidade da reunião concluída na Agenda R2, ou (c) erro real de insert.
