

# Corrigir status da Juliane

## Problema
A Juliane (telefone 91988656185) foi marcada manualmente como "Contrato Pago" por engano. O registro precisa ser revertido.

## Dados identificados

- **Attendee ID**: `075c97ae-49b8-42b7-991a-fff96bdbf4e1`
- **Nome**: Juliane
- **Status atual**: `contract_paid`
- **contract_paid_at**: `2026-02-09 12:54:00.525+00`

## Correcao

Executar um UPDATE no banco para reverter o status para `completed` e limpar o `contract_paid_at`:

```text
UPDATE meeting_slot_attendees 
SET status = 'completed', 
    contract_paid_at = NULL, 
    updated_at = NOW() 
WHERE id = '075c97ae-49b8-42b7-991a-fff96bdbf4e1';
```

## Secao Tecnica

Sera utilizada a ferramenta de insert/update do Supabase (nao migracao) para executar o UPDATE diretamente na tabela `meeting_slot_attendees`. Nenhuma alteracao de codigo e necessaria.

