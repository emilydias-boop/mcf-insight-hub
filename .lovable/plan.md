

## Plano: Corrigir erro "column msa.slot_id does not exist"

### Causa raiz

O trigger `notify_suspicious_status_change` na tabela `audit_logs` faz um JOIN incorreto:

```sql
JOIN meeting_slots ms ON ms.id = msa.slot_id  -- ERRADO
```

A coluna correta é `meeting_slot_id`, não `slot_id`. Toda vez que o audit log registra uma mudança de status em `meeting_slot_attendees`, esse trigger dispara e falha, causando o erro "Erro ao atualizar status".

### Correção — Migration SQL

```sql
CREATE OR REPLACE FUNCTION public.notify_suspicious_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
-- (mesma função, trocando apenas msa.slot_id → msa.meeting_slot_id)
  ...
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id   -- FIX
  LEFT JOIN closers c ON c.id = ms.closer_id
  ...
$function$;
```

### Resultado

- Atualização de status volta a funcionar (R1 e R2)
- Alertas de mudança suspeita passam a funcionar corretamente também

