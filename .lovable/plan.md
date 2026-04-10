

# Fix: Atualizar leads encaixados que ficaram com status errado

## Problema
Os leads encaixados antes da correção anterior (João Marcos zenni, Guilherme José Palhari, Marratma Gandhi, Márcio Barros) têm `carrinho_week_start = 2026-04-09` mas `r2_status_id` ainda é "Próxima Semana". Precisam ser "Aprovado" para aparecerem na aba correta.

## Correção

**Migration SQL** — atualizar os 4 registros existentes:

```sql
UPDATE meeting_slot_attendees
SET r2_status_id = '24d9a326-378b-4191-a4b3-d0ec8b9d23eb'
WHERE carrinho_week_start IS NOT NULL
  AND r2_status_id = '1b805ad7-5cab-4797-bc2d-2afd60a95870';
```

Isso corrige retroativamente todos os leads que foram encaixados antes do fix, mudando de "Próxima Semana" para "Aprovado". A partir de agora, novos encaixes já fazem essa atualização automaticamente (fix anterior no `useEncaixarNoCarrinho.ts`).

