
# Backfill Retroativo - Leads "Construir para Alugar" nos ultimos 15 dias

## Situacao Atual
- **152 compradores unicos** de "Construir para Alugar" desde 04/02/2026
- **Nenhum** possui deal no pipeline "INSIDE SALES - VIVER DE ALUGUEL"
- A automacao foi implantada hoje, entao todas as compras anteriores ficaram sem deal no CRM

## Solucao
Criar uma Edge Function temporaria `backfill-construir-alugar` que:

1. Busca todos os compradores unicos de `hubla_transactions` com categoria `ob_construir_alugar` ou `ob_construir` desde 04/02
2. Para cada comprador:
   - Verifica se ja existe contato no CRM (por email ou telefone)
   - Se nao existe, cria novo contato com origin "Viver de Aluguel"
   - Verifica se ja existe deal no pipeline Viver de Aluguel
   - Se nao existe, cria deal no estagio "NOVO LEAD"
   - Tags: `Construir-Alugar`, `Hubla`
3. Suporta modo `dry_run` para verificar antes de executar
4. Retorna relatorio completo de quantos foram criados, ja existiam, ou falharam

## Constantes utilizadas
- Origin ID (Viver de Aluguel): `4e2b810a-6782-4ce9-9c0d-10d04c018636`
- Stage ID (Novo Lead): `2c69bf1d-94d5-4b6d-928d-dcf12da2d78c`

## Detalhes Tecnicos

### Novo arquivo: `supabase/functions/backfill-construir-alugar/index.ts`

A funcao segue a mesma logica da `createDealForConsorcioProduct` do webhook handler:

1. Busca transacoes com `SELECT DISTINCT ON (customer_email)` para deduplicar
2. Para cada comprador, reutiliza contato existente ou cria novo
3. Verifica duplicacao de deal antes de inserir
4. Retorna JSON com resumo: `{ total, created, skipped, errors }`

### Fluxo de execucao

```text
1. Chamar a funcao com POST (dry_run: true) para preview
2. Verificar o relatorio
3. Chamar novamente com POST (dry_run: false) para executar
4. Recarregar pagina do CRM para ver os novos leads
```

### Campos do deal criado
- `name`: "Nome do Cliente - Construir Para Alugar"
- `origin_id`: 4e2b810a (Viver de Aluguel)
- `stage_id`: 2c69bf1d (Novo Lead)
- `tags`: ['Construir-Alugar', 'Hubla', 'Backfill']
- `custom_fields`: source, product, sale_date
- `data_source`: 'backfill'

## Apos execucao
A funcao pode ser deletada pois e de uso unico. Os novos webhooks ja criam deals automaticamente com a mudanca implantada anteriormente.
