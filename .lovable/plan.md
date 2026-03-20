
## Plano: corrigir o novo erro ao atualizar status da reunião

### Diagnóstico

Verifiquei o fluxo real da tela e o problema agora é outro.

- A tela da agenda R1 usa `useUpdateAttendeeAndSlotStatus()` em `src/hooks/useAgendaData.ts`.
- Essa mutation atualiza `meeting_slot_attendees.status`.
- Esse update dispara o trigger de auditoria `log_r2_attendee_changes`, que insere em `audit_logs`.
- Depois disso, o trigger `trg_notify_suspicious_status_change` em `audit_logs` executa `notify_suspicious_status_change()`.

A função em produção já está com o `JOIN` corrigido para:

```sql
JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
```

Mas os logs do banco mostram o erro atual:

```sql
column msa.name does not exist
```

Ou seja, ainda existe outro trecho quebrado nesta função:

```sql
COALESCE(msa.attendee_name, msa.name, 'Lead desconhecido')
```

A coluna `msa.name` não existe na tabela `meeting_slot_attendees`. Por isso a atualização continua falhando quando a alteração de status entra no cenário de “mudança suspeita”.

### Correção proposta

Criar uma nova migration SQL para ajustar a função `public.notify_suspicious_status_change()` removendo a referência inválida a `msa.name`.

Troca principal:

```sql
COALESCE(msa.attendee_name, 'Lead desconhecido')
```

em vez de:

```sql
COALESCE(msa.attendee_name, msa.name, 'Lead desconhecido')
```

### Escopo da implementação

| Item | Ação |
|---|---|
| Banco | Atualizar `notify_suspicious_status_change()` |
| Banco | Preservar toda a lógica de alerta existente |
| Banco | Corrigir apenas a referência inválida `msa.name` |
| Validação | Confirmar que reversões de status não quebram mais o update |

### Resultado esperado

- O botão de alterar status volta a funcionar.
- O sistema continua gerando alertas de auditoria para mudanças suspeitas.
- O erro deixa de aparecer no toast da agenda.

### Detalhe técnico

Hoje o erro só acontece em alterações que passam pela lógica de reversão suspeita, porque é nesse ponto que a função tenta carregar os dados do attendee para montar a descrição do alerta.

Fluxo simplificado:

```text
AgendaMeetingDrawer
  -> useUpdateAttendeeAndSlotStatus()
    -> UPDATE meeting_slot_attendees
      -> trigger log_r2_attendee_changes
        -> INSERT audit_logs
          -> trigger notify_suspicious_status_change
            -> quebra em msa.name
```

### Observação importante

Pelo código atual, o nome correto do lead nessa tabela já é `attendee_name`, então remover `msa.name` é seguro e alinhado com o schema real do banco.
