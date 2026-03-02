

## Problema

A aba "Marketing" na matriz de permissões está mostrando os mesmos recursos das outras BUs (CRM, Fechamento Equipe, Efeito Alavanca, etc.), mas o Marketing tem recursos próprios: **Dashboard Ads, Campanhas, Aquisição A010, Config Links A010, Documentos Estratégicos**.

## Solução

### 1. Adicionar novos `resource_type` ao enum Postgres

Novos valores:
- `marketing_dashboard_ads`
- `marketing_campanhas`
- `marketing_aquisicao_a010`
- `marketing_config_links`
- `marketing_documentos`

Migration SQL com `ALTER TYPE resource_type ADD VALUE IF NOT EXISTS`.

### 2. Criar mapeamento de recursos por BU

Em vez de um único `BU_RESOURCES` para todas as BUs, criar um `BU_RESOURCE_MAP`:

```typescript
const BU_RESOURCE_MAP: Record<string, ResourceType[]> = {
  incorporador: ['crm', 'fechamento_sdr', 'efeito_alavanca'],
  consorcio:    ['crm', 'fechamento_sdr', 'efeito_alavanca'],
  credito:      ['crm', 'fechamento_sdr', 'efeito_alavanca', 'credito'],
  projetos:     ['crm', 'fechamento_sdr', 'efeito_alavanca', 'projetos'],
  leilao:       ['crm', 'fechamento_sdr', 'efeito_alavanca', 'leilao'],
  marketing:    ['marketing_dashboard_ads', 'marketing_campanhas', 'marketing_aquisicao_a010', 'marketing_config_links', 'marketing_documentos'],
};
```

### 3. Atualizar `RESOURCE_LABELS`

Adicionar labels amigáveis para os novos recursos em `src/types/user-management.ts`.

### 4. Atualizar `Permissoes.tsx`

Trocar a lógica de `resources` para buscar do mapa por BU em vez do array fixo `BU_RESOURCES`.

### Arquivos a modificar
- **Migration SQL** — adicionar 5 novos valores ao enum `resource_type`
- `src/types/user-management.ts` — adicionar labels dos novos recursos
- `src/pages/admin/Permissoes.tsx` — substituir `BU_RESOURCES` por `BU_RESOURCE_MAP`

