
# Reverter Status de Fechamento - Carol Correa

## Situacao Atual

| SDR | Status | Precisa Reverter |
|-----|--------|------------------|
| Carol Correa | APPROVED | Sim |
| Jessica Martins | DRAFT | Nao (ja revertido) |

## Solucao Proposta

Executar UPDATE direto no banco para reverter o status de Carol Correa para DRAFT.

```sql
-- Reverter Carol Correa para DRAFT
UPDATE sdr_month_payout 
SET status = 'DRAFT', updated_at = NOW()
WHERE id = 'be4e1204-ce83-43e7-a381-9230313c087d';

-- Registrar no audit log
INSERT INTO sdr_payout_audit_log (payout_id, campo, valor_anterior, valor_novo, motivo)
VALUES (
  'be4e1204-ce83-43e7-a381-9230313c087d',
  'status',
  'APPROVED',
  'DRAFT',
  'Reversao manual - fechamento reaberto para correcao'
);
```

## Resultado Esperado

Apos a execucao:

| SDR | Status Antes | Status Depois |
|-----|-------------|---------------|
| Carol Correa | APPROVED | DRAFT |
| Jessica Martins | DRAFT | DRAFT (sem alteracao) |

## Impacto

- Carol Correa nao vera mais o fechamento na pagina "Meu Fechamento" (status DRAFT e oculto)
- Gestores poderao editar/recalcular os valores novamente
- O historico ficara registrado no audit log

## Arquivos

Nenhuma alteracao de codigo necessaria - apenas atualizacao de dados no banco.
