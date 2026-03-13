

## Executar cleanup-backfill-partners

### Passo 1: Deploy da função
A função `cleanup-backfill-partners` já existe no código e está registrada no `config.toml`. Precisa ser deployada.

### Passo 2: Executar com `dry_run: true`
Chamar a função com `{ "dry_run": true }` para listar os 21 parceiros que seriam removidos, sem alterar nada.

### Passo 3: Validar resultado
Revisar a lista retornada — confirmar que são de fato parceiros (emails com transações em `parceria`/`incorporador`).

### Passo 4: Executar com `dry_run: false`
Chamar a função com `{ "dry_run": false }` para:
- Registrar os 21 deals na tabela `partner_returns` (auditoria)
- Deletar os 21 deals do pipeline

### Resultado esperado
- **Antes**: 169 deals com tag `Backfill-Offer`
- **Depois**: ~148 deals legítimos no pipeline
- 21 parceiros registrados em `partner_returns` com `return_source: 'backfill-cleanup'`

