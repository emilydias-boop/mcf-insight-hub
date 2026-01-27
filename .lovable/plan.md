
# Plano: Corrigir Filtro de Responsáveis na Pipeline Inside Sales

## Problema Identificado

O filtro "Todos os responsáveis" não funciona na pipeline Inside Sales porque há uma **incompatibilidade de tipos** entre o filtro e os dados.

### Diagnóstico

| Componente | Campo Usado | Tipo |
|------------|-------------|------|
| **DealFilters.tsx** (linha 160) | `user.id` | UUID |
| **Negocios.tsx** (linha 306) | `deal.owner_id` | Email |

Quando você seleciona um responsável no dropdown:
- O filtro guarda o **UUID** do profile (ex: `b0ea004d-ca72-4190-ab69-a9685b34bd06`)
- A comparação tenta encontrar `deal.owner_id` que é um **email** (ex: `jessica.martins@minhacasafinanciada.com`)
- Como UUID ≠ email, **nenhum deal passa no filtro**

### Contexto da Migração

De acordo com a arquitetura do sistema, a migração para UUIDs (Phase 4) criou o campo `owner_profile_id` para uso interno, mantendo `owner_id` (email) para sincronização externa com Clint.

## Solução

Alterar a comparação na linha 306 de `Negocios.tsx` para usar `owner_profile_id` em vez de `owner_id`:

```diff
- if (filters.owner && deal.owner_id !== filters.owner) return false;
+ if (filters.owner && deal.owner_profile_id !== filters.owner) return false;
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/Negocios.tsx` | Linha 306: trocar `owner_id` por `owner_profile_id` |

## Impacto

- Filtro de responsáveis volta a funcionar corretamente
- Compatível com a nova arquitetura UUID-based
- Deals sem `owner_profile_id` definido não serão filtrados (comportamento esperado)

## Resultado Esperado

Ao selecionar "Jessica Bellini" no filtro:
- **Antes**: 0 deals mostrados (comparação UUID vs email falha)
- **Depois**: Todos os deals atribuídos à Jessica (comparação UUID vs UUID funciona)
