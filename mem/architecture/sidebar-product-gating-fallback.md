---
name: Sidebar BU Menu Visibility for SDR/Closer
description: Os grupos "BU - Incorporador MCF" e "BU - Consórcio" no sidebar são restritos a admin/manager/coordenador. SDR/Closer NÃO os veem.
type: feature
---
SDRs e Closers NÃO devem ver os grupos expansíveis "BU - Incorporador MCF" nem "BU - Consórcio" no sidebar — esses agrupam telas de gestão (Painel Comercial, Vendas, CRM gestor, Relatórios, Movimentações, Fechamento Equipe, Documentos Estratégicos).

Para SDR/Closer, o sidebar mostra apenas itens dedicados:
- Cockpit (SDR)
- Minhas Reuniões (SDR)
- Meu Desempenho (Closer)
- Metas da Equipe (SDR/Closer/Closer Sombra de Incorporador)
- Agenda (URL dinâmica por BU via getCRMBasePath)
- Negócios (URL dinâmica por BU via getCRMBasePath)
- Discador rápido / Auto-Discador
- Configurações, Meu RH, Meu Playbook, Meu Fechamento, Meus Equipamentos

`requiredRoles` dos grupos BU NÃO inclui sdr/closer. Não existe mais fallback em `useMyProducts` que libere o grupo BU por produto — o gate é puramente por role.

`useMyProducts` ainda mantém o fallback squad → products (consorcio/credito → consorcio; incorporador → incorporador) para outros usos que dependem de `myProducts`, mas isso não destrava menus BU para SDR/Closer.
