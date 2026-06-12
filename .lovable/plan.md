Gerar dois arquivos CSV em `/mnt/documents/` com os leads de 2026 que **pagaram mas não têm deal em PIPELINE INSIDE SALES** (match por `lower(email)`).

## Arquivo 1: `a010_orfaos_2026.csv` (~146 linhas)
Base: `hubla_transactions` 2026, `transaction_type = 'PRINCIPAL'`, `installment_number = 1`, `offer_name ILIKE 'A010%'`.
Colunas: `email, nome, telefone, oferta, primeira_compra`.

## Arquivo 2: `outside_orfaos_2026.csv` (~9 linhas)
Base: `hubla_transactions` 2026, `offer_name IN ('Contrato - Curso R$ 97,00', 'Contrato Perfil A - Vitrine A010')`.
Colunas: `email, nome, telefone, ofertas, primeira_compra`.

## Filtro órfão (ambos)
`LEFT JOIN` com emails distintos de `crm_deals` cuja `crm_origins.name ILIKE '%inside sales%'`, mantendo só os sem match.

Entrego os dois com tags `<presentation-artifact>` para download.