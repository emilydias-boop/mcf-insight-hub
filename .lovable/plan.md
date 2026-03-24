

## Plano atualizado: Criar 4 deals faltantes

### Situação atual verificada

- **36 deals** de backfill existem (confirmado)
- **0 duplicatas internas** restantes (as 3 de Carlos Wesley, Higor Coura e Robert Douglas já foram removidas pela migração anterior de telefone)
- **4 leads confirmados** sem deal no PIS e sem match por telefone

### Leads a criar

| Nome | Email | Telefone | Contact ID | Valor |
|------|-------|----------|------------|-------|
| Adrielson Pereira Da Silva | adrielprodigital@gmail.com | +5561994229051 | 1d94bf06 | R$ 43,23 |
| Jovane Monteiro | jovane-monteiro10@hotmail.com | +5591985273443 | 374d3606 | R$ 43,00 |
| Marcel Klaczko Neto | warcelando@gmail.com | +5511930846492 | ac073054 | R$ 43,00 |
| Mateus Santos Araújo | mateus.28.msa@gmail.com | 11946872005 | ee6a7322 | R$ 44,26 |

### SQL (via insert tool)

```sql
INSERT INTO crm_deals (clint_id, name, contact_id, origin_id, stage_id, value, tags, custom_fields, data_source)
VALUES
  ('hubla-bf-final-adrielson', 'Adrielson Pereira Da Silva - A010', '1d94bf06-8836-4183-8e3c-3dbe3db52ef7', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 43.23, ARRAY['A010','Backfill'], '{"source":"hubla","product":"A010","sale_date":"2025-12-18"}', 'webhook'),
  ('hubla-bf-final-jovane', 'Jovane Monteiro - A010', '374d3606-ed45-4558-94c3-893cde707a81', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 43.00, ARRAY['A010','Backfill'], '{"source":"hubla","product":"A010","sale_date":"2025-12-09"}', 'webhook'),
  ('hubla-bf-final-marcel', 'Marcel Klaczko Neto - A010', 'ac073054-5992-4dc8-bb12-44198b674ffd', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 43.00, ARRAY['A010','Backfill'], '{"source":"hubla","product":"A010","sale_date":"2025-12-22"}', 'webhook'),
  ('hubla-bf-final-mateus', 'Mateus Santos Araújo - A010', 'ee6a7322-b330-4483-819f-93a5054d707c', 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b', 44.26, ARRAY['A010','Backfill'], '{"source":"hubla","product":"A010","sale_date":"2025-11-25"}', 'webhook');
```

### Resultado esperado

- **+4 deals** criados
- **40 deals** de backfill no total (36 + 4)
- Limpeza de duplicatas internas ja concluida (0 pendentes)

