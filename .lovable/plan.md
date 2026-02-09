

# Adicionar Opção "Sem dono" no Filtro de Responsáveis do CRM

## Problema

Atualmente, o filtro de responsáveis no CRM só permite selecionar "Todos os responsáveis" ou um responsável específico. Não existe uma opção para localizar deals sem dono (owner_id e owner_profile_id nulos), dificultando o trabalho dos SDRs ativos que precisam movimentar esses leads.

## Solução

Adicionar uma opção "Sem dono" no dropdown de responsáveis, presente em todos os CRMs (Consórcio, Crédito, Projetos, Leilão). Como todos usam o mesmo componente `DealFilters.tsx` e a mesma lógica de filtragem em `Negocios.tsx`, basta modificar esses dois arquivos.

## Mudanças

### 1. Componente DealFilters.tsx - Adicionar opção no dropdown

Inserir um `SelectItem` com value `__no_owner__` logo após "Todos os responsáveis":

```text
<SelectItem value="all">Todos os responsáveis</SelectItem>
<SelectItem value="__no_owner__">Sem dono</SelectItem>
```

### 2. Página Negocios.tsx - Lógica de filtragem

No bloco de filtro de responsável (linha ~370), adicionar tratamento para o valor `__no_owner__`:

```text
if (filters.owner) {
  if (filters.owner === '__no_owner__') {
    // Mostrar apenas deals sem dono
    if (deal.owner_id || deal.owner_profile_id) return false;
  } else if (filters.owner.startsWith('email:')) {
    const emailFilter = filters.owner.replace('email:', '');
    if (deal.owner_id !== emailFilter) return false;
  } else {
    if (deal.owner_profile_id !== filters.owner) return false;
  }
}
```

## Seção Técnica

| Arquivo | Mudança |
|---------|---------|
| `src/components/crm/DealFilters.tsx` | Adicionar `<SelectItem value="__no_owner__">Sem dono</SelectItem>` após linha 194 |
| `src/pages/crm/Negocios.tsx` | Adicionar condição `filters.owner === '__no_owner__'` no bloco de filtro (linhas 370-377) |

### Abrangência

Como todas as BUs (Consórcio, Crédito, Projetos, Leilão) compartilham o mesmo `DealFilters.tsx` e `Negocios.tsx`, a opção ficará disponível automaticamente em todos os CRMs sem necessidade de alterações individuais.

