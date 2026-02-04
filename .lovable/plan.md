
# Plano: Redirecionar SDRs do Consórcio para CRM Correto

## Problema Identificado

O Cleiton (SDR do Consórcio) está acessando a rota `/crm` que **força** `bu="incorporador"` no contexto, mesmo ele tendo `squad: [consorcio]` no perfil.

### Causa Raiz

No `AppSidebar.tsx`, o menu para SDRs aponta para rotas fixas:

```
├── Agenda → /crm/agenda (linha 277-281)
└── Negócios → via /crm/negocios
```

Essas rotas são wrappadas pelo `CRM.tsx` que define:
```tsx
<BUProvider bu="incorporador" basePath="/crm">
```

## Solução

### Opção A: Rotas Dinâmicas no Sidebar (Recomendada)

Modificar o `AppSidebar.tsx` para rotear SDRs/Closers **dinamicamente** com base na sua BU:

| BU do Usuário | Rota da Agenda |
|---------------|----------------|
| `consorcio` | `/consorcio/crm/agenda` |
| `credito` | `/bu-credito/crm/agenda` |
| `projetos` | `/bu-projetos/crm/agenda` |
| `leilao` | `/leilao/crm/agenda` |
| `incorporador` (ou sem BU) | `/crm/agenda` |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/layout/AppSidebar.tsx` | Adicionar lógica para construir URLs dinâmicas baseadas na BU do usuário |

### Implementação

1. **Criar mapa de base paths por BU:**

```tsx
const BU_CRM_BASE_PATH: Record<BusinessUnit, string> = {
  incorporador: '/crm',
  consorcio: '/consorcio/crm',
  credito: '/bu-credito/crm',
  projetos: '/bu-projetos/crm',
  leilao: '/leilao/crm',
};
```

2. **Modificar itens de menu para SDR/Closer:**

Substituir:
```tsx
{
  title: "Agenda",
  url: "/crm/agenda",  // fixo
  ...
}
```

Por lógica dinâmica:
```tsx
{
  title: "Agenda",
  url: getBUBasePath() + "/agenda",  // dinâmico
  ...
}
```

3. **Adicionar menu "Negócios" para SDRs/Closers:**

Atualmente SDRs não têm link direto para Negócios no sidebar; eles acessam via abas internas. Adicionar:

```tsx
{
  title: "Negócios",
  url: getBUBasePath() + "/negocios",
  icon: Briefcase,
  requiredRoles: ["sdr", "closer"],
}
```

### Lógica de Resolução de BU

```tsx
function getCRMBasePath(userBUs: BusinessUnit[]): string {
  // Prioridade: consorcio > credito > projetos > leilao > incorporador
  const buPriority: BusinessUnit[] = ['consorcio', 'credito', 'projetos', 'leilao', 'incorporador'];
  
  for (const bu of buPriority) {
    if (userBUs.includes(bu)) {
      return BU_CRM_BASE_PATH[bu];
    }
  }
  
  return '/crm'; // fallback para incorporador
}
```

## Resultado Esperado

- **Cleiton** (`squad: consorcio`) ao clicar em "Agenda" ou "Negócios" irá para:
  - `/consorcio/crm/agenda`
  - `/consorcio/crm/negocios`
  
- Essas rotas usam `BUCRMLayout bu="consorcio"` que corretamente:
  - Filtra closers do Consórcio na agenda
  - Filtra pipelines/origens do Consórcio nos negócios

## Detalhamento Técnico

### Modificações no AppSidebar.tsx

```tsx
// 1. Adicionar mapa de base paths
const BU_CRM_BASE_PATH: Record<BusinessUnit, string> = {
  incorporador: '/crm',
  consorcio: '/consorcio/crm',
  credito: '/bu-credito/crm',
  projetos: '/bu-projetos/crm',
  leilao: '/leilao/crm',
};

// 2. Dentro do componente, criar função helper
const getCRMBasePath = (userBUs: BusinessUnit[]): string => {
  // Prioridade para BUs específicas
  const buPriority: BusinessUnit[] = ['consorcio', 'credito', 'projetos', 'leilao'];
  
  for (const bu of buPriority) {
    if (userBUs.includes(bu)) {
      return BU_CRM_BASE_PATH[bu];
    }
  }
  
  return '/crm'; // fallback (incorporador)
};

// 3. Usar nos itens de menu
const crmBase = getCRMBasePath(myBUs);

// Substituir o menu "Agenda" estático por dinâmico
{
  title: "Agenda",
  url: `${crmBase}/agenda`,
  icon: Calendar,
  resource: "crm",
  requiredRoles: ["sdr", "closer", "closer_sombra"],
  separator: true,
},

// Adicionar menu "Negócios" para SDRs/Closers
{
  title: "Negócios",
  url: `${crmBase}/negocios`,
  icon: Briefcase,
  resource: "crm",
  requiredRoles: ["sdr", "closer"],
},
```

### Abordagem de Implementação

Como os `menuItems` são definidos fora do componente (estático), precisamos de uma das abordagens:

**Abordagem 1**: Mover a definição dos itens de SDR/Closer para dentro do componente onde temos acesso ao `myBUs`.

**Abordagem 2**: Criar um hook ou função que gera os menu items dinamicamente.

A **Abordagem 1** é mais simples e será utilizada: mover apenas os itens que precisam de URL dinâmica (Agenda e Negócios para SDR/Closer) para serem construídos dentro do componente.

## Estimativa de Impacto

- **Apenas 1 arquivo** precisa ser modificado
- **Nenhuma mudança** nas rotas do App.tsx
- **Nenhuma mudança** no banco de dados
- Imediatamente após deploy, Cleiton e outros SDRs do Consórcio verão dados corretos
