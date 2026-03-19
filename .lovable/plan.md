

## Plano: Adicionar aba "Auditoria" na navegação do CRM principal

### Problema

A aba "Auditoria" existe nas rotas BU-específicas (ex: `/bu-incorporador-mcf/auditoria-agendamentos`) mas **não aparece** na navegação do CRM principal (`/crm`). O array `allNavItems` em `CRM.tsx` não inclui a rota `/crm/auditoria-agendamentos`.

### Correção

Adicionar a entrada de navegação no `CRM.tsx`:

| Arquivo | Ação |
|---------|------|
| `src/pages/CRM.tsx` | Adicionar `{ to: '/crm/auditoria-agendamentos', label: 'Auditoria', icon: Shield }` no array `allNavItems`, visível apenas para roles admin/manager/coordenador (não para SDRs/closers agenda-only) |

A rota já existe em `App.tsx` (linha 229), então só falta o link de navegação.

