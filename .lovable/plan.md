

## Plano: Limpeza completa das importações incorretas

### Situação

Temos 257 registros problemáticos (156 do batch 1 + 101 do batch 2) além dos 3.935 originais.

### Ação — DELETE via migration SQL

**Batch 1 (156 registros — 14:28)**: Todos devem ser removidos. Foram criados pela importação com mapeamento errado (telefone como nome, dados desalinhados). Os 72 com "nomes reais" também estão com dados incorretos nos outros campos.

**Batch 2 (101 registros — 15:27)**: Todos devem ser removidos. 38 são duplicatas confirmadas dos originais; os 63 restantes têm encoding corrompido e dados potencialmente errados.

**Contatos órfãos**: Deletar contatos criados nos mesmos batches que não tenham mais deals vinculados.

```sql
-- 1. Delete batch 1 (156 deals)
DELETE FROM crm_deals 
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at < '2026-03-20 14:29:00+00';

-- 2. Delete batch 2 (101 deals)
DELETE FROM crm_deals 
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND created_at >= '2026-03-20 15:27:00+00'
  AND created_at < '2026-03-20 15:29:00+00';

-- 3. Orphaned contacts
DELETE FROM crm_contacts 
WHERE clint_id LIKE 'csv_import_%'
  AND created_at >= '2026-03-20 14:28:00+00'
  AND created_at < '2026-03-20 15:29:00+00'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
```

### Resultado esperado

Voltaremos aos **3.935 deals originais** intactos. Os registros da planilha poderão ser reimportados depois com o parser corrigido (TAB + encoding + dedup no banco).

### Sobre os 63 "novos" do batch 2

Se esses 63 eram registros genuinamente novos (não existiam nos originais), eles serão recriados na próxima importação — desta vez com encoding correto e dados nos campos certos.

### Arquivo alterado

| Arquivo | O que muda |
|---------|-----------|
| Migration SQL | DELETE dos 257 deals + contatos órfãos |

