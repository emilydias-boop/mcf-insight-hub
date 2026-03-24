

## Problema: Webhook anamnese-insta-mcf rejeitando leads

### Causa raiz

Duas questões:

1. **Field mapping incorreto**: O payload do formulário envia `nomeCompleto` (camelCase), mas o `field_mapping` do endpoint espera `nome_completo` (snake_case) como chave de mapeamento para `name`. Como não bate, o campo `name` nunca é preenchido e a validação falha.

2. **Formulário disparando para 2 endpoints**: O form está enviando simultaneamente para `anamnese-insta-mcf` (camelCase) e `clientdata-inside` (snake_case). O segundo funciona porque recebe o formato correto.

### Correção

**Atualizar o `field_mapping` no banco** para o endpoint `anamnese-insta-mcf`, adicionando a chave `nomeCompleto → name` (camelCase):

```sql
UPDATE webhook_endpoints
SET field_mapping = field_mapping || '{"nomeCompleto": "name"}'::jsonb
WHERE slug = 'anamnese-insta-mcf';
```

Isso faz o mapping funcionar com o payload camelCase que o formulário envia.

### Investigação adicional necessária

Verificar no formulário (externo) por que ele está disparando para **dois** endpoints ao mesmo tempo (`anamnese-insta-mcf` e `clientdata-inside`). Idealmente deveria enviar apenas para `anamnese-insta-mcf`.

### Arquivo a alterar

Nenhum arquivo de código — apenas uma atualização no registro do banco de dados via migration SQL.

