## Migração: 26 deals A010 presos no estágio "A017 - Novo Lead"

### Objetivo
Mover 26 deals que compraram A010 (Viver de Aluguel) mas estão travados no estágio "A017 - Novo Lead" de volta para "Novo Lead" do pipeline A010, onde os SDRs conseguem trabalhá-los.

### Escopo
- **Mover (26 deals):** todos os deals atualmente em `stage_id = '8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda'` (A017 - Novo Lead) cujas tags contêm `A010`.
- **Manter (15 deals):** deals com apenas tag `A017` permanecem no estágio atual (já estão corretos).

### Execução (SQL)
Um único UPDATE em `crm_deals`:

```sql
UPDATE crm_deals
SET 
  stage_id = (SELECT id FROM crm_stages 
              WHERE pipeline_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b' 
              AND name = 'Novo Lead'),
  pipeline_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b',
  updated_at = now()
WHERE id IN (<26 IDs da auditoria>);
```

Os 26 IDs vêm exatamente do CSV `a017_migracao_auditoria.csv` (linhas com `acao_sugerida = MOVER_A010`).

### Segurança / não-impacto
- Não altera dados do contato, valor, tags, histórico ou owner.
- Não dispara webhook de ingestão (é UPDATE direto, não INSERT).
- Não toca nos 15 deals A017 puros.
- Não toca em deals fora do estágio A017 - Novo Lead.
- Reversível: caso necessário, basta voltar `stage_id`/`pipeline_id` para os valores anteriores (registrados no CSV de auditoria).

### Pós-execução
- Validar contagem: `SELECT count(*) FROM crm_deals WHERE stage_id = '8a0b84d0-...' AND tags ILIKE '%A010%'` → deve retornar 0.
- Confirmar com o usuário no preview que os 26 deals aparecem em "Novo Lead" do pipeline A010.
