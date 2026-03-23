

## Plano: Dar acesso ao Assistente Administrativo no Consórcio

### Problema

O cargo `assistente_administrativo` foi criado na interface, mas ele não aparece em nenhuma lista de `requiredRoles` no código. Isso significa que o Assistente Administrativo **não vê nada** na sidebar do Consórcio porque:

1. O menu "BU - Consórcio" exige `requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer"]`
2. Os sub-itens como Fechamento, Vendas, Controle, etc. exigem `requiredRoles: ["admin", "manager", "coordenador"]`
3. O filtro de produtos (linha 461) só isenta admin/manager/coordenador

### Correção

| Arquivo | O que muda |
|---------|-----------|
| `src/components/layout/AppSidebar.tsx` | Adicionar `"assistente_administrativo"` nas `requiredRoles` do menu Consórcio e nos sub-itens permitidos |

### Detalhes

No menu "BU - Consórcio" (linha 143):
```
requiredRoles: ["admin", "manager", "coordenador", "sdr", "closer", "assistente_administrativo"]
```

Sub-itens que o Assistente Administrativo **verá**:
- CRM (`/consorcio/crm`) — sem restrição de role
- Painel Equipe (`/consorcio/painel-equipe`) — sem restrição de role
- Vendas (`/consorcio/vendas`) — adicionar `"assistente_administrativo"`
- Controle Consorcio (`/consorcio`) — adicionar `"assistente_administrativo"`
- Importar (`/consorcio/importar`) — adicionar `"assistente_administrativo"`
- Relatórios (`/consorcio/relatorio`) — adicionar `"assistente_administrativo"`
- Documentos Estratégicos (`/consorcio/documentos-estrategicos`) — adicionar `"assistente_administrativo"`

Sub-itens que **NÃO verá** (conforme solicitado):
- Fechamento (`/consorcio/fechamento`) — permanece restrito a admin/manager/coordenador

Também será necessário adicionar `"assistente_administrativo"` na isenção do filtro de produtos (linha 461) para que ele não precise ter o produto "consorcio" atribuído — ou garantir que o produto "consorcio" esteja no perfil dele.

### Resultado
- Assistente Administrativo verá todas as páginas do Consórcio exceto Fechamento
- Fechamento permanece exclusivo para gestores

