
## Regras da Safra do Carrinho

### Campo oficial do contrato
`sale_date` da tabela `hubla_transactions` — fonte primária da data do contrato.

### Janelas por métrica
```text
SAFRA DO CARRINHO (ex: carrinho sexta 28/03)
─────────────────────────────────────────────
Contratos da safra:  sale_date entre Qui 20/03 00:00 → Qua 26/03 23:59
R2 da safra:         vinculada ao lead do contrato, scheduled_at > sale_date
                     Classificação:
                       na_janela = scheduled_at dentro de Sex 21/03 → Sex 28/03
                       tardia    = scheduled_at > Sex 28/03
                       sem_r2    = nenhuma R2 após sale_date
R1 da safra:         mesma janela dos contratos (Qui-Qua)
Vendas parceria:     Sex 28/03 → Seg 31/03, matched ao lead da safra
```

### Regras de R2
1. R2 deve ser posterior ao contrato (`scheduled_at > sale_date`)
2. Quando há múltiplas R2, usa a primeira agendada após o contrato
3. Classificação temporal: na_janela / tardia / sem_r2
