
# Corrigir Notas Nao Aparecendo entre R1 e R2

## Problema Identificado

O lead "Sergio Henrique da Silva" tem **dois deals diferentes** no CRM:
- Deal R1: `6cac5fd2` (nome: "Sergio Henrique da Silva")
- Deal R2: `2473f26f` (nome: "Sergio Henrique da Silva - Construir Para Alugar")

Ambos compartilham o mesmo `contact_id`, mas o hook `useLeadNotes` busca notas apenas pelo `deal_id` do attendee atual. Quando o R2 consulta, ele usa o deal R2 e nao encontra os attendees do deal R1 (que contem a nota de agendamento).

## Solucao

Alterar `useLeadNotes` para tambem buscar attendees de **todos os deals do mesmo contato**, nao apenas do deal atual.

### Arquivo: `src/hooks/useLeadNotes.ts`

1. Receber um parametro opcional `contactId`
2. Quando `contactId` estiver disponivel, buscar todos os `deal_id`s que pertencem a esse contato na tabela `crm_deals`
3. Buscar todos os `attendee_id`s de todos esses deals (nao apenas o deal atual)
4. Usar essa lista expandida para buscar notas de agendamento, closer notes, attendee notes, etc.
5. Tambem buscar deal_activities de todos os deals relacionados ao contato

### Arquivo: `src/components/crm/r2-drawer/R2NotesTab.tsx`

Passar o `contact_id` do attendee para o hook:

```
useLeadNotes(attendee?.deal_id, attendee?.id, attendee?.deal?.contact_id)
```

O `contact_id` ja esta disponivel no objeto `attendee.deal.contact` que e carregado via join.

### Logica expandida no hook

```text
Se contactId disponivel:
  1. Buscar todos os deal_ids com esse contact_id
  2. Buscar todos os attendee_ids desses deals
  3. Usar essa lista para buscar notas de TODAS as fontes

Se nao (fallback atual):
  1. Buscar attendee_ids apenas do deal_id fornecido
  2. Comportamento identico ao atual
```

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/hooks/useLeadNotes.ts` | Adicionar parametro `contactId` e expandir busca cross-deal |
| `src/components/crm/r2-drawer/R2NotesTab.tsx` | Passar `contactId` ao hook |

## Resultado

- Notas de agendamento do R1 aparecerao no R2 (e vice-versa)
- Notas manuais, de ligacao e qualificacao de qualquer deal do mesmo contato serao visiveis
- Sem impacto no comportamento atual quando `contactId` nao for fornecido
