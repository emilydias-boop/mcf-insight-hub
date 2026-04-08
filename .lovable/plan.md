

# Corrigir comp plan de março do Antony para N1

## Problema

A migration anterior atualizou `sdr.nivel` e `employees.nivel/cargo_catalogo_id`, mas não atualizou o `sdr_comp_plan` de 2026-03 que ainda tem valores de N2:

| Campo | Atual (N2) | Correto (N1) |
|---|---|---|
| `fixo_valor` | 3150 | 2800 |
| `variavel_total` | 1350 | 1200 |
| `ote_total` | 4500 | 4000 |
| `cargo_catalogo_id` | `9e3d43e9...` (N2) | `d035345f...` (N1) |

## Mudança

Usar a ferramenta de insert/update para corrigir o registro `a8336c61-4b9e-462b-9ca3-0dab0d8ca999`:

```sql
UPDATE sdr_comp_plan 
SET fixo_valor = 2800, 
    variavel_total = 1200, 
    ote_total = 4000, 
    cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed'
WHERE id = 'a8336c61-4b9e-462b-9ca3-0dab0d8ca999';
```

Após isso, recalcular o payout de março para refletir os novos valores.

