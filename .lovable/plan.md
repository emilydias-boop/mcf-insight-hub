
## Cancelar os 3 jobs de importação CSV travados

Os 3 jobs de import de CSV do dia 13/02 estão:
- `62190420` — pending — deals_1770990471569.csv
- `4cb1c4b7` — pending — deals_1770989567343.csv  
- `8aaaf71c` — processing — deals_1770988842673.csv

### Correção
Executar UPDATE no banco para setar `status = 'cancelled'` e adicionar uma mensagem de erro explicativa nesses 3 jobs específicos (pelos IDs de `import_deals_csv` de fevereiro/2026).

```sql
UPDATE sync_jobs
SET 
  status = 'cancelled',
  error_message = 'Cancelado manualmente — job travado sem processamento',
  updated_at = NOW()
WHERE id IN (
  '62190420-1df1-4ddd-9ac9-e0caa688fd1e',
  '4cb1c4b7-9fa3-4cf8-a28e-7da7e82a93af',
  '8aaaf71c-7074-46e8-9a23-584695712907'
);
```

Isso é uma operação de banco simples, sem alteração de código.
