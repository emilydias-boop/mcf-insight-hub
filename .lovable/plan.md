

## Plano: Filtrar auditoria para mostrar apenas mudanças relevantes

### Problema

A aba "Mudanças de Status" traz **todas** as alterações de status (307), incluindo transições normais do fluxo operacional como `pre_scheduled → invited`, `invited → scheduled`, etc. Isso polui a visão e dificulta identificar mudanças realmente relevantes para auditoria.

### Solução

Melhorar os filtros e a lógica para focar nas mudanças que importam para auditoria:

**1. Arquivo: `src/hooks/useStatusChangeAudit.ts`**

- Adicionar uma lista de transições "normais" (que não são relevantes para auditoria) e filtrá-las por padrão:
  - `pre_scheduled → invited` / `pre_scheduled → scheduled`
  - `invited → scheduled` / `invited → confirmed`
  - `scheduled → confirmed`
  - Estas são progressões naturais do fluxo
- Expandir a lista de `SUSPICIOUS_TRANSITIONS` para incluir mais transições realmente suspeitas:
  - `no_show → completed`, `completed → no_show` (já existem)
  - `no_show → invited`, `completed → invited` (já existem)
  - `no_show → scheduled`, `completed → scheduled` (regressões)
  - `cancelled → completed`, `refunded → completed` (reversões)
- Remover o `limit(500)` que pode estar cortando dados ou aumentar para 2000

**2. Arquivo: `src/components/audit/StatusChangesTab.tsx`**

- Adicionar filtro dropdown de "Tipo de mudança":
  - **Todas** — mostra tudo (como está hoje)
  - **Apenas suspeitas** — substitui o switch atual
  - **Mudanças manuais** — exclui transições automáticas do fluxo normal
- Mudar o padrão do filtro para "Mudanças manuais" em vez de mostrar tudo
- Adicionar mais cards de stats para as novas categorias suspeitas
- Os cards de resumo devem sempre mostrar stats de todas as mudanças (não do filtrado), para dar visão geral

### Resultado esperado

Ao abrir a página, o usuário verá apenas as mudanças que merecem atenção (não as transições operacionais normais), com destaque visual nas suspeitas. Poderá trocar para "Todas" se quiser a visão completa.

