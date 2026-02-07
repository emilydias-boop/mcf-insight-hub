

# Adicionar R$ 1.000 de iFood Ultrameta para BU Incorporador

## Situacao Atual

| Colaborador | iFood Mensal | iFood Ultrameta | Total iFood | Status |
|-------------|--------------|-----------------|-------------|--------|
| Angelina Maia | R$ 630 | R$ 0 | R$ 630 | DRAFT |
| Antony Elias | R$ 600 | R$ 840 | R$ 1.440 | DRAFT |
| Carol Correa | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Carol Souza | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Claudia Carielo | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Cristiane Gomes | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Jessica Bellini | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Jessica Martins | R$ 600 | R$ 0 | R$ 600 | APPROVED |
| Julia Caroline | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Juliana Rodrigues | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Julio | R$ 600 | R$ 50 | R$ 650 | DRAFT |
| Leticia Nunes | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Thayna | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Thobson Motta | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Vinicius Rangel | R$ 600 | R$ 0 | R$ 600 | DRAFT |
| Yanca Oliveira | R$ 600 | R$ 0 | R$ 600 | DRAFT |

**Total atual de iFood Ultrameta no squad:** R$ 890

## Solucao

Executar um UPDATE direto na tabela `sdr_month_payout` para:

1. Definir `ifood_ultrameta = 1000` para todos os 16 usuarios
2. Recalcular `total_ifood = ifood_mensal + 1000`

## Comando SQL a Executar

```text
UPDATE sdr_month_payout smp
SET 
  ifood_ultrameta = 1000,
  total_ifood = ifood_mensal + 1000,
  updated_at = NOW()
WHERE ano_mes = '2026-01'
  AND sdr_id IN (
    SELECT s.id 
    FROM sdr s
    LEFT JOIN employees e ON e.sdr_id = s.id
    WHERE s.squad = 'incorporador' 
       OR e.departamento ILIKE '%incorporador%'
  );
```

## Resultado Esperado Apos a Alteracao

| Colaborador | iFood Mensal | iFood Ultrameta | Total iFood |
|-------------|--------------|-----------------|-------------|
| Angelina Maia | R$ 630 | R$ 1.000 | R$ 1.630 |
| Antony Elias | R$ 600 | R$ 1.000 | R$ 1.600 |
| Carol Correa | R$ 600 | R$ 1.000 | R$ 1.600 |
| Carol Souza | R$ 600 | R$ 1.000 | R$ 1.600 |
| Claudia Carielo | R$ 600 | R$ 1.000 | R$ 1.600 |
| Cristiane Gomes | R$ 600 | R$ 1.000 | R$ 1.600 |
| Jessica Bellini | R$ 600 | R$ 1.000 | R$ 1.600 |
| Jessica Martins | R$ 600 | R$ 1.000 | R$ 1.600 |
| Julia Caroline | R$ 600 | R$ 1.000 | R$ 1.600 |
| Juliana Rodrigues | R$ 600 | R$ 1.000 | R$ 1.600 |
| Julio | R$ 600 | R$ 1.000 | R$ 1.600 |
| Leticia Nunes | R$ 600 | R$ 1.000 | R$ 1.600 |
| Thayna | R$ 600 | R$ 1.000 | R$ 1.600 |
| Thobson Motta | R$ 600 | R$ 1.000 | R$ 1.600 |
| Vinicius Rangel | R$ 600 | R$ 1.000 | R$ 1.600 |
| Yanca Oliveira | R$ 600 | R$ 1.000 | R$ 1.600 |

**Novo total de iFood Ultrameta no squad:** R$ 16.000 (16 pessoas x R$ 1.000)

## Observacoes

- Esta alteracao afeta **16 colaboradores** do Incorporador
- A Jessica Martins tem status APPROVED - a alteracao tambem a afetara
- Nenhuma alteracao de codigo e necessaria - apenas UPDATE no banco

