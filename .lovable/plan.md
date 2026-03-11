

## Problema: Deduplicação excessiva reduzindo faturamento

### Diagnóstico
A deduplicação atual usa `PARTITION BY email + data + installment_number`, o que é muito amplo. Quando um cliente compra 2 produtos diferentes no mesmo dia (ex: A010 + ACESSO VITALÍCIO), ambos com `installment_number = 1`, a deduplicação remove um deles.

Dados concretos:
- 3.251 registros removidos pela deduplicação
- **2.122 são de fontes legítimas** (hubla, kiwify) — não deveriam ser removidos
- 888 registros "ACESSO VITALÍCIO" da hubla removidos incorretamente
- 874 registros "A010" da hubla removidos incorretamente

### Solução
Em vez de ROW_NUMBER() genérico, usar abordagem cirúrgica: **excluir apenas registros `make` genéricos ("Parceria") quando já existe um registro de fonte prioritária para o mesmo email + mesma data**.

Lógica SQL:
```text
-- Manter TODOS os registros normalmente
-- EXCETO: registros make com product_name = 'Parceria' 
-- QUANDO existir outro registro não-make para o mesmo email no mesmo dia
```

Isso resolve o caso do Samuel (Parceria do make é excluída porque mcfpay já tem A001) sem afetar vendas legítimas de produtos diferentes no mesmo dia.

### Correção adicional
Incluir `'kiwify'` no filtro de sources — está faltando atualmente.

### Migration SQL
Recriar ambas as RPCs (`get_all_hubla_transactions` e `get_hubla_transactions_by_bu`) removendo o ROW_NUMBER e usando NOT EXISTS para excluir apenas `make` "Parceria" duplicados.

