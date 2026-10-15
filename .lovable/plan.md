# Relatório diário por BU — 14/10/2026 (somente leitura)

## Objetivo
Executar e colar a saída bruta, linha a linha, de:
```sql
SELECT * FROM public.relatorio_diario_bu('2026-10-14') ORDER BY bu, metrica;
```

## O que será feito
- Executar a consulta dentro de transação `BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;` pelo canal administrativo do Supabase — o mesmo recurso usado no relatório de 13/10, porque a leitura normal do sandbox retorna 42501 (sem permissão de EXECUTE) para `relatorio_diario_bu`.
- Nenhum dado é lido fora da transação só de leitura; nada é inserido, atualizado ou excluído.
- Colar a saída bruta completa no chat, ordenada por `bu, metrica`, sem formatação ou interpretação.

## Garantias
- Somente SELECT, dentro de transação READ ONLY desfeita no final.
- Sem UPDATE/DELETE/INSERT, sem migration, sem deploy, sem alterar gatilhos, edge functions ou webhooks.
- Se o canal administrativo também estiver bloqueado nesta sessão, paro e aviso antes de tentar qualquer alternativa.
