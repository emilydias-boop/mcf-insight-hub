

# Reverter Antony Elias para Nível 1 (N1)

## Situação atual

Antony Elias está registrado como **N2** em 3 locais:
- `sdr.nivel = 2`
- `employees.nivel = 2`
- `sdr_comp_plan` de 2026-03 com valores de N2 (Fixo R$3.150, OTE R$4.500)

## O que será feito

Criar uma migration SQL para reverter tudo para N1:

| Tabela | Campo | De | Para |
|---|---|---|---|
| `sdr` | `nivel` | 2 | 1 |
| `employees` | `nivel` | 2 | 1 |
| `employees` | `salario_base` | 2800 (ok) | 2800 |
| `employees` | `ote_mensal` | 1200 | 1200 |
| `sdr_comp_plan` (2026-03) | `fixo_valor` | 3150 | 2800 |
| `sdr_comp_plan` (2026-03) | `variavel_total` | 1350 | 1200 |
| `sdr_comp_plan` (2026-03) | `ote_total` | 4500 | 4000 |

Também atualizar o `cargo_catalogo_id` do employee para apontar para "SDR Inside N1" (`d035345f-8fe3-41b4-8bba-28d0596c5bed`) em vez do N2.

Após a migration, será necessário recalcular o payout de março para refletir os novos valores de fixo/variável.

