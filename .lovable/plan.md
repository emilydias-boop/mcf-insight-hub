
# Plano: Configurar Abas do CRM por Business Unit

## Objetivo

Configurar o CRM do Consórcio para exibir apenas as abas relevantes:

**Manter:**
- Visão Geral
- Contatos
- Negócios
- Atendimentos
- Agenda R1
- Configurações

**Remover:**
- Agenda R2
- Carrinho R2
- Órfãos
- Duplicados
- Auditoria

---

## Solução

Adicionar um mapeamento de **abas permitidas por BU** no `BUCRMLayout.tsx`.

---

## Alteração no Arquivo

**Arquivo:** `src/pages/crm/BUCRMLayout.tsx`

### Adicionar configuração de abas por BU

```typescript
// Configuração de abas visíveis por BU
const BU_VISIBLE_TABS: Record<BusinessUnit, string[]> = {
  incorporador: [
    'visao-geral', 'contatos', 'negocios', 'atendimentos', 
    'agenda', 'agenda-r2', 'r2-carrinho', 'deals-orfaos', 
    'contatos-duplicados', 'auditoria-agendamentos', 'configuracoes'
  ],
  consorcio: [
    'visao-geral', 'contatos', 'negocios', 'atendimentos', 
    'agenda', 'configuracoes'
  ],
  credito: [
    'visao-geral', 'contatos', 'negocios', 'atendimentos', 
    'agenda', 'configuracoes'
  ],
  projetos: [
    'visao-geral', 'contatos', 'negocios', 'atendimentos', 
    'agenda', 'configuracoes'
  ],
  leilao: [
    'visao-geral', 'contatos', 'negocios', 'atendimentos', 
    'agenda', 'configuracoes'
  ],
};
```

### Adicionar `key` aos itens de navegação

```typescript
const allNavItems = [
  { key: 'visao-geral', to: basePath, label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { key: 'contatos', to: `${basePath}/contatos`, label: 'Contatos', icon: Users },
  { key: 'negocios', to: `${basePath}/negocios`, label: 'Negócios', icon: Briefcase },
  { key: 'atendimentos', to: `${basePath}/atendimentos`, label: 'Atendimentos', icon: MessageCircle },
  { key: 'agenda', to: `${basePath}/agenda`, label: 'Agenda R1', icon: CalendarDays },
  { key: 'agenda-r2', to: `${basePath}/agenda-r2`, label: 'Agenda R2', icon: CalendarDays },
  { key: 'r2-carrinho', to: `${basePath}/r2-carrinho`, label: 'Carrinho R2', icon: ShoppingCart },
  { key: 'deals-orfaos', to: `${basePath}/deals-orfaos`, label: 'Órfãos', icon: UserX },
  { key: 'contatos-duplicados', to: `${basePath}/contatos-duplicados`, label: 'Duplicados', icon: Copy },
  { key: 'auditoria-agendamentos', to: `${basePath}/auditoria-agendamentos`, label: 'Auditoria', icon: Shield },
  { key: 'configuracoes', to: `${basePath}/configuracoes`, label: 'Configurações', icon: Settings },
];
```

### Filtrar abas com base na BU

```typescript
// Primeiro filtrar por BU
const buVisibleTabs = BU_VISIBLE_TABS[bu] || [];
let navItems = allNavItems.filter(item => buVisibleTabs.includes(item.key));

// Depois aplicar filtro de roles (sdr/closer)
if (isAgendaOnly) {
  const allowedTabs: string[] = ['agenda'];
  
  if (canViewR2 && buVisibleTabs.includes('agenda-r2')) {
    allowedTabs.push('agenda-r2');
  }
  
  allowedTabs.push('negocios');
  
  navItems = navItems.filter(item => allowedTabs.includes(item.key));
}
```

---

## Resultado Esperado

### CRM Consórcio (`/consorcio/crm`)
```text
┌─────────────────────────────────────────────────────────────────────┐
│ CRM - Consórcio                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Visão Geral │ Contatos │ Negócios │ Atendimentos │ Agenda R1 │ Config│
└─────────────────────────────────────────────────────────────────────┘
```

### CRM Incorporador (`/crm`)
```text
┌─────────────────────────────────────────────────────────────────────┐
│ CRM - Incorporador                                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Visão Geral │ Contatos │ Negócios │ Atendimentos │ Agenda R1 │       │
│ Agenda R2 │ Carrinho R2 │ Órfãos │ Duplicados │ Auditoria │ Config  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Extensibilidade

Esta abordagem permite configurar facilmente as abas de cada BU futuramente:
- Se Leilão precisar de Agenda R2, basta adicionar `'agenda-r2'` ao array
- Se Crédito não precisar de Atendimentos, basta remover `'atendimentos'`

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/BUCRMLayout.tsx` | Adicionar mapeamento `BU_VISIBLE_TABS` e filtrar abas por BU |
