

## Diagnóstico: Felipe Laurentino dos Santos

### Por que não vinculou

Existem **2 contatos diferentes** no banco:

| Contato | Email | Phone | Deal | Reunião R1 |
|---------|-------|-------|------|------------|
| `e2e1a7cd` | laurentinofelipe**7**@gmail.com | 8199300481**7** | `5c213d3c` — Contrato Pago | Sim (Julio, contract_paid) |
| `8ffe2b66` | laurentinofelipe@gmail.com | 8199300480**0** | `82c7c340` — Contrato Pago | Nenhuma |

Os emails são diferentes (`7` vs sem `7`) e os telefones também diferem no último dígito (`17` vs `00`). O sistema de merge não consegue detectar isso como duplicata porque:
- Email: não são iguais
- Phone suffix (9 dígitos): `993004817` vs `993004800` — diferentes

Este é um caso de **erro de digitação no cadastro**. A reunião R1 com pagamento está no deal antigo, mas o novo deal (criado em 23/03) não tem reunião vinculada.

### Bug crítico encontrado: Página de Duplicados quebrada

Todas as queries da página de Contatos Duplicados estão retornando **erro 400** porque o código referencia `crm_stages(order)` mas a coluna real se chama `stage_order`. Isso significa que a página de duplicados **não está funcionando**.

### Plano de correção

#### 1. Corrigir o nome da coluna em `useDuplicateContacts.ts`
Trocar `crm_stages(order)` por `crm_stages(stage_order)` e `d.crm_stages?.order` por `d.crm_stages?.stage_order` em todos os locais do arquivo (linhas 47, 57, 97, 107, etc.).

#### 2. Unificar manualmente o Felipe
Executar SQL para mover o `meeting_slot_attendees` e reunião do deal antigo para o novo, ou mergear os contatos manualmente.

### Detalhes técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useDuplicateContacts.ts` | Substituir `crm_stages(order)` → `crm_stages(stage_order)` e `crm_stages?.order` → `crm_stages?.stage_order` em ~6 ocorrências |

Correção SQL para o Felipe (migration):
```sql
-- Mover meeting_slot_attendees do deal antigo para o novo
UPDATE meeting_slot_attendees 
SET deal_id = '82c7c340-d806-4fb9-a826-df2205373294'
WHERE deal_id = '5c213d3c-46fa-455a-b065-63cc339256e2';

-- Mover meeting_slots
UPDATE meeting_slots 
SET deal_id = '82c7c340-d806-4fb9-a826-df2205373294'
WHERE deal_id = '5c213d3c-46fa-455a-b065-63cc339256e2';
```

