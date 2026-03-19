

## Plano: Mostrar quem fez cada ação na Timeline do Lead

### Problema

Atualmente, muitos eventos na timeline mostram `author: null` porque o hook não resolve os `user_id` das tabelas para nomes legíveis. As fontes de dados têm `user_id` (deal_activities, calls) e `created_by` (attendee_notes) mas nunca são resolvidos para nomes via `profiles`.

### Correção

**Arquivo: `src/hooks/useLeadFullTimeline.ts`**

Após buscar todos os dados, coletar todos os `user_id`/`created_by` únicos e fazer uma query em `profiles` para resolver nomes:

1. Coletar UUIDs de autores de:
   - `deal_activities.user_id`
   - `calls.user_id`
   - `attendee_notes.created_by`
2. Query única: `profiles` → `id, full_name, email`
3. Criar `profileMap: Record<string, string>` (id → full_name ou email)
4. Usar o mapa ao construir cada evento:
   - `stage_change`: `profileMap[act.user_id]` como fallback quando metadata não tem autor
   - `call`: `profileMap[call.user_id]`
   - `note` (deal_activities): `profileMap[act.user_id]`
   - `attendee_notes`: `profileMap[note.created_by]`
   - `task`, `qualification`, etc: `profileMap[act.user_id]`

A prioridade será: metadata (ex: `meta.author`) → `profileMap[user_id]` → null

Nenhuma alteração no componente UI — o campo `author` já é renderizado pelo `LeadFullTimeline.tsx`.

