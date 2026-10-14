# Mostrar "BU - Crédito Imobiliário" no menu da Karen

## O que achei
- No menu, o grupo "BU - Crédito Imobiliário" só aparece para admin, gerente e coordenador. A Karen é SDR e Gerente de Relacionamento, por isso ela vê apenas o grupo "BU - Pós Venda".
- Não dá para liberar o grupo para todo SDR do Crédito. Outros 4 SDRs também estão no Crédito e passariam a ver o grupo.
- A tela de CRM do Crédito já aceita SDR, e a liberação individual feita antes já inclui a PIPELINE CRÉDITO IMOBILIÁRIO. O que falta é o caminho no menu.

## O que muda
- O grupo "BU - Crédito Imobiliário" passa a aparecer também para quem tem a pipeline de Crédito Imobiliário na liberação de visão completa. Hoje isso é só a Karen. Dentro do grupo ela vê "CRM" e "Painel Comercial".
- Ao clicar em CRM, ela abre a pipeline de Crédito Imobiliário com todos os clientes.
- Para os outros colaboradores, o menu continua igual.

## Detalhes técnicos
- `AppSidebar.tsx`: uma consulta leve a `sdr.full_view_origin_ids` do usuário logado (react-query, `staleTime` de 5 min).
- No filtro de `filteredMenuItems`: se o item for o grupo do Crédito (o subitem tem `url` `/credito/crm`) e a lista tiver `c4ed1700-0000-4000-8000-000000000002`, a checagem de `requiredRoles` é dispensada.
- O resto continua valendo, inclusive a checagem do recurso `crm`.
- Sem mudança no banco.
