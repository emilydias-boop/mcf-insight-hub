
# Reverter Status de Fechamento - Antony Elias e Cleiton Lima

## Situacao Atual

| SDR | Status | Precisa Reverter |
|-----|--------|------------------|
| Antony Elias | APPROVED | Sim |
| Cleiton Lima | APPROVED | Sim |

## Solucao

Executar UPDATE direto no banco para reverter ambos os status para DRAFT.

Acesse o **Supabase SQL Editor** e execute:

```sql
-- Reverter Antony Elias para DRAFT
UPDATE sdr_month_payout 
SET status = 'DRAFT', updated_at = NOW()
WHERE id = 'cc26135e-b77f-4789-912a-10892bad370c';

-- Reverter Cleiton Lima para DRAFT
UPDATE sdr_month_payout 
SET status = 'DRAFT', updated_at = NOW()
WHERE id = 'd0cff632-7f99-4e5b-a3e1-f7b867e1ead2';

-- Registrar no audit log
INSERT INTO sdr_payout_audit_log (payout_id, campo, valor_anterior, valor_novo, motivo)
VALUES 
  ('cc26135e-b77f-4789-912a-10892bad370c', 'status', 'APPROVED', 'DRAFT', 'Reversao manual - fechamento reaberto para correcao'),
  ('d0cff632-7f99-4e5b-a3e1-f7b867e1ead2', 'status', 'APPROVED', 'DRAFT', 'Reversao manual - fechamento reaberto para correcao');
```

## Resultado Esperado

| SDR | Status Antes | Status Depois |
|-----|-------------|---------------|
| Antony Elias | APPROVED | DRAFT |
| Cleiton Lima | APPROVED | DRAFT |

## Impacto

- Ambos nao verao mais o fechamento na pagina "Meu Fechamento" (status DRAFT e oculto)
- Gestores poderao editar/recalcular os valores novamente
- O historico ficara registrado no audit log

## Como Executar

1. Acesse o Supabase Dashboard do projeto
2. Va em SQL Editor
3. Cole o SQL acima
4. Clique em Run
5. Atualize a pagina de fechamento para ver as mudancas

## Arquivos

Nenhuma alteracao de codigo necessaria - apenas atualizacao de dados no banco.
