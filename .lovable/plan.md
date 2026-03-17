

## Por que Luis (Gestor/Manager) nao consegue excluir reunioes

### Causa raiz

As politicas RLS (Row-Level Security) de DELETE nas tabelas `meeting_slots` e `meeting_slot_attendees` permitem apenas `admin`:

- `meeting_slots`: `"Admins can delete meeting slots"` → `has_role(auth.uid(), 'admin')`
- `meeting_slot_attendees`: `"Admins can delete attendees"` → `has_role(auth.uid(), 'admin')`

O frontend permite a acao (role `manager` esta em `DELETE_ALLOWED_ROLES`), mas o Supabase rejeita silenciosamente no banco.

### Correcao

**Migracao SQL** -- Atualizar as RLS policies de DELETE para incluir `manager` e `coordenador`:

```sql
-- meeting_slots: permitir manager e coordenador deletar
DROP POLICY IF EXISTS "Admins can delete meeting slots" ON meeting_slots;
CREATE POLICY "Authorized roles can delete meeting slots" ON meeting_slots
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role)
  );

-- meeting_slot_attendees: permitir manager e coordenador deletar
DROP POLICY IF EXISTS "Admins can delete attendees" ON meeting_slot_attendees;
CREATE POLICY "Authorized roles can delete attendees" ON meeting_slot_attendees
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role)
  );
```

Tambem incluir `sdr` se desejado (ja esta no `DELETE_ALLOWED_ROLES` do frontend). Nenhuma alteracao de codigo frontend necessaria -- o botao ja aparece para managers, so falta a permissao no banco.

