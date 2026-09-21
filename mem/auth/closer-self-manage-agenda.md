---
name: Closer edita a própria agenda
description: Closer com profiles.can_manage_agenda abre o modal "Configurar Closers" e edita só o próprio cadastro; RLS por dono.
type: feature
---

- Botão "Configurar" (Agenda R1) e "Closers" (Agenda R2) aparecem para liderança (admin/manager/coordenador), para não-closers e para closer com `profiles.can_manage_agenda = true`.
- "Métricas" (R1) e "Status/Tags"/"Marcações" (R2) seguem restritos a não-closer — `can_manage_agenda` não os libera.
- A restrição "só o próprio cadastro" vale APENAS para closer puro: papel `closer` sem `sdr`, `admin`, `manager` nem `coordenador` (`isCloserPuro`, derivado de `isCloserOnly`/`isR2Closer`). Nesse caso a lista de abas usa `useMyCloser`/`useMyR2Closer` e, sem vínculo, o modal não abre e mostra toast.
- SDR com `profiles.can_manage_agenda = true` (e qualquer papel misto, ex.: closer+sdr) configura a agenda de TODOS os closers: lista completa (`closers` em R1, `allClosers` em R2) e modal abre mesmo sem cadastro em `closers`.
- No banco, políticas aditivas permitem ao dono escrever em `closer_availability` e `closer_blocked_dates` e atualizar a própria linha de `closers`, sempre exigindo `can_self_manage_agenda()` + `is_my_closer()` (funções SECURITY DEFINER).
- Trigger `trg_guard_closer_self_update` bloqueia, para não-liderança, mudança em `bu`, `meeting_type`, `is_active`, `email`, `employee_id` e `priority`.
- `closer_meeting_links` segue gravável por qualquer autenticado (endurecimento postergado de propósito); engrenagens `onEditHours` seguem sem gate.
