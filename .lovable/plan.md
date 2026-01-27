
# Plano: Corrigir Erro ao Salvar Nota na R2

## Problema Identificado

O erro "Erro ao adicionar nota" ocorre porque o codigo tenta inserir uma nota com `note_type = 'r2'`, mas a tabela `attendee_notes` possui uma constraint que so permite os valores:

```
['initial', 'reschedule', 'general']
```

### Codigo Atual (R2NotesTab.tsx, linha 54)
```typescript
addNote.mutate(
  { attendeeId: attendee.id, note: newNoteText.trim(), noteType: 'r2' }, // ❌ 'r2' não permitido
  ...
);
```

### Constraint no Banco
```sql
CHECK (note_type = ANY (ARRAY['initial', 'reschedule', 'general']))
```

## Solucao Proposta

Atualizar a constraint do banco para incluir o tipo `'r2'`:

```sql
-- Remover constraint antiga
ALTER TABLE attendee_notes 
DROP CONSTRAINT attendee_notes_note_type_check;

-- Adicionar nova constraint com 'r2' incluido
ALTER TABLE attendee_notes 
ADD CONSTRAINT attendee_notes_note_type_check 
CHECK (note_type = ANY (ARRAY['initial', 'reschedule', 'general', 'r2']));
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Erro "Erro ao adicionar nota" | Nota salva com sucesso |
| Constraint bloqueia `'r2'` | Constraint permite `'r2'` |
| Aba Notas nao funciona | Aba Notas totalmente funcional |

## Arquivos a Modificar

Nenhum arquivo de codigo sera alterado - apenas uma migracao SQL para ajustar a constraint do banco.
