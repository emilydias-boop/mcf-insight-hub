

## Nova aba "Pagamentos" no módulo Consórcio

### Visão geral

Criar uma nova aba principal "Pagamentos" ao lado de Cotas / Cadastros Pendentes / Contemplação. Essa aba será um painel operacional financeiro que consolida todas as 51.539 parcelas de 215 cotas, com KPIs, alertas, filtros e ações inline.

Os dados já existem nas tabelas `consortium_installments` e `consortium_cards` -- não é necessário criar tabelas novas. A aba apenas consulta e exibe os dados existentes com lógica de status automática.

### Arquivos a criar

**1. `src/components/consorcio/pagamentos/ConsorcioPagamentosTab.tsx`**
Componente principal da aba. Orquestra KPIs, alertas, filtros e tabela. Contém:
- Hook customizado para buscar parcelas com JOIN em `consortium_cards` (nome, grupo, cota, status, vendedor, origem)
- Lógica de status automático baseada em data:
  - `pago`: já tem `data_pagamento`
  - `vencendo`: vencimento nos próximos 7 dias
  - `vencida`/`atrasada`: vencimento passado sem pagamento
  - `pendente`: vencimento futuro
- Cálculo de situação da cota (adimplente/pendente/em atraso/quitada) agregando parcelas por `card_id`

**2. `src/components/consorcio/pagamentos/PagamentosKPIs.tsx`**
Cards no topo com: Total recebido, Total pendente, Total em atraso, Parcelas pagas, Parcelas pendentes, Parcelas vencidas, Cotas inadimplentes, Cotas quitadas.

**3. `src/components/consorcio/pagamentos/PagamentosAlerts.tsx`**
Banner de alerta no topo: X parcelas em atraso, Y cotas com atraso, R$ Z em aberto.

**4. `src/components/consorcio/pagamentos/PagamentosTable.tsx`**
Tabela paginada com colunas: Cliente, Grupo, Cota, Nº Parcela, Tipo, Valor, Vencimento, Data Pgto, Status (badge colorido), Situação Cota (badge), Responsável, Ações.

**5. `src/components/consorcio/pagamentos/PagamentosFilters.tsx`**
Barra de filtros: busca textual, status parcela, situação cota, vencimento, grupo, responsável, origem, tipo, período, toggles "apenas inadimplentes" / "apenas quitadas" / "vencendo esta semana".

**6. `src/components/consorcio/pagamentos/PagamentoDetailDrawer.tsx`**
Drawer lateral ao clicar numa linha: histórico de pagamentos da cota, parcelas pagas/pendentes/atrasadas, observações, link para abrir a cota completa.

**7. `src/hooks/useConsorcioPagamentos.ts`**
Hook que faz query paginada no Supabase:
```sql
SELECT i.*, c.nome_completo, c.grupo, c.cota, c.status as cota_status, 
       c.vendedor_name, c.origem, c.tipo_produto, c.razao_social, c.tipo_pessoa
FROM consortium_installments i
JOIN consortium_cards c ON c.id = i.card_id
```
Com filtros dinâmicos. Retorna também os KPIs agregados via query separada.

### Arquivo a editar

**`src/pages/bu-consorcio/Index.tsx`**
- Importar `ConsorcioPagamentosTab`
- Adicionar `<TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>` na linha 386 (após contemplação)
- Adicionar `<TabsContent value="pagamentos"><ConsorcioPagamentosTab /></TabsContent>`

### Lógica de status automático

Calculada no frontend ao receber os dados:

| Condição | Status parcela |
|----------|---------------|
| `status = 'pago'` ou `data_pagamento` preenchido | Paga |
| Vencimento em até 7 dias, sem pagamento | Vencendo |
| Vencimento passado, sem pagamento | Atrasada |
| Vencimento futuro, sem pagamento | Pendente |

| Condição | Situação cota |
|----------|--------------|
| Todas parcelas pagas | Quitada |
| Nenhuma atrasada, tem pendentes | Pendente |
| Qualquer parcela atrasada | Em atraso |
| Cota cancelada | Cancelada |

### Performance

Com 51k parcelas, a query precisa ser paginada no servidor. O hook usará `.range(from, to)` do Supabase com limit de 50 por página. Os KPIs serão calculados com uma query `SELECT COUNT/SUM` separada que roda uma vez e é cacheada.

