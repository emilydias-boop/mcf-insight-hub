

## Plano: Transformar Dashboard CRM em Painel de Controle do Funil Comercial

### Situação Atual
A aba "Dash" mostra 6 cards genéricos (Total de Contatos, Origens Ativas, etc.) + listas de "Contatos Recentes" e "Maiores Negócios". Informação superficial, sem visão do funil.

### Nova Estrutura

**Seção 1 — KPIs do Funil (4 cards, focados em conversão)**
- **Novos Leads** (count de deals criados no período)
- **Reuniões Agendadas** (deals no stage "Reunião 01 Agendada")
- **Contratos Pagos** (deals no stage "Contrato Pago")
- **Taxa de Conversão** (Contratos / Novos Leads × 100)

Cada card com comparativo vs período anterior (seta verde/vermelha + %).

**Seção 2 — Funil Duplo (Lead A × Lead B)**
- Reutilizar o componente `FunilDuplo` existente, que já tem seleção de período (Hoje/Semana/Mês), filtro de etapas, contagem de A010 e divisão Lead A/B com barras de progresso e metas.
- Origin ID fixo: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` (Pipeline Inside Sales)

**Seção 3 — Distribuição por Etapa (horizontal bar chart)**
- Gráfico de barras horizontais mostrando quantos deals estão em cada stage ativo, dando uma visão de "onde estão parados os leads".
- Usar Recharts (já instalado).

**Seção 4 — Negócios Recentes + Maiores Negócios (manter, mas compactar)**
- Manter as duas listas lado a lado, mas renomear: "Últimas Movimentações" e "Maiores Oportunidades".

### Etapas de Implementação

1. **Reescrever `DashboardContent` em `Overview.tsx`**
   - Trocar os 6 cards genéricos por 4 KPIs do funil com queries focadas em stages
   - Adicionar `FunilDuplo` com o origin ID do Pipeline Inside Sales
   - Adicionar gráfico de distribuição por stage usando Recharts `BarChart`
   - Compactar e renomear as listas existentes

2. **Atualizar título e descrição do Overview**
   - "Visão Geral do CRM" → "Painel de Controle do Funil Comercial"
   - Subtítulo: "Acompanhe a performance do seu funil de vendas em tempo real"

### Detalhes Técnicos

- O `FunilDuplo` precisa do `originId = "e3c04f21-ba2c-4c66-84f8-b4341c826b1c"`
- As queries de KPIs filtram por stages específicos (`crm_stages.stage_name`)
- O gráfico de distribuição faz uma query agrupando deals por stage (`crm_deals` + `crm_stages`)
- Comparativo de período: busca contagens da semana anterior para calcular variação %

