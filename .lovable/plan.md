

## Fix: Aplicar correção do mapeamento Consórcio

### Problema
A migration criada anteriormente (`20260325152340`) não foi aplicada ao banco. O `bu_origin_mapping` ainda contém apenas 1 entrada errada para `consorcio`:
- `origin: 7d7b1cb5-...` (Efeito Alavanca + Clube)

### Solução
Criar uma nova migration (ou re-executar a SQL) para aplicar a correção:

**Arquivo: nova migration SQL**
```sql
DELETE FROM bu_origin_mapping WHERE bu = 'consorcio';

INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default) VALUES
  ('consorcio', 'group', 'b98e3746-d727-445b-b878-fc5742b6e6b8', true),
  ('consorcio', 'group', '267905ec-8fcf-4373-8d62-273bb6c6f8ca', false),
  ('consorcio', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', false),
  ('consorcio', 'origin', '57013597-22f6-4969-848c-404b81dcc0cb', true),
  ('consorcio', 'origin', '4e2b810a-6782-4ce9-9c0d-10d04c018636', false);
```

A migration anterior pode ter falhado silenciosamente. Vou criar uma nova migration com timestamp atualizado para forçar a aplicação.

### Resultado esperado
Após aplicação, Ygor (SDR, consorcio) verá as 3 pipelines corretas na sidebar e a página de Configuração BU mostrará os 5 itens vinculados ao Consórcio.

