

## Plano: Melhorias para Setor de Cobrança Completo

### Diagnóstico Atual

O módulo já possui uma base sólida: sync com Hubla (a cada 30min), KPIs globais e mensais, gestão de parcelas, acordos, histórico, registro de pagamentos, agrupamento por cliente, WhatsApp, e exportação Excel. Porém, falta operacionalizar a cobrança de fato. Dados atuais:

- 1.261 assinaturas atrasadas (de 1.690 total = 74%)
- 0 assinaturas com responsável financeiro atribuído
- 0 observações registradas
- 0 acordos criados
- 30 clientes em risco de cancelamento (4+ parcelas atrasadas)
- Sem nenhum mecanismo de priorização ou fila de trabalho

### Melhorias Propostas (por prioridade)

---

**1. Fila de Cobrança com Priorização por Inadimplência**

Adicionar uma nova aba/visão "Fila de Cobrança" no topo da página, antes da tabela geral. Mostra apenas assinaturas atrasadas, ordenadas por gravidade:

- Calcular `parcelas_atrasadas` por subscription (contagem de installments com `status = 'atrasado'`)
- Classificar risco: `Cancelamento` (4+), `Alto` (3), `Médio` (1-2)
- Colunas: Cliente, Produto, Parcelas Atrasadas, Dias Desde Último Pgto, Responsável, Última Ação
- Badge colorido por nível de risco
- Ação rápida: "Cobrar WhatsApp" direto na linha

Arquivo: `src/components/financeiro/cobranca/CobrancaQueue.tsx` (novo)
Hook: `src/hooks/useBillingQueue.ts` (novo) — query que junta `billing_subscriptions` + contagem de `billing_installments` atrasadas + última entrada de `billing_history`

---

**2. Indicador de "Dias Sem Contato" e Última Ação**

Enriquecer a tabela e o drawer com:
- "Última ação": data do registro mais recente em `billing_history` (excluindo tipo `parcela_paga`)
- "Dias sem contato": diff entre hoje e última ação manual (tentativa_cobranca, observacao, acordo)
- Se nunca houve contato manual, mostrar "Nunca contatado" em vermelho

Isso exige uma sub-query ou view que busque a `MAX(created_at)` de `billing_history` por subscription onde tipo IN ('tentativa_cobranca', 'observacao', 'acordo_realizado').

Arquivo: Ajustar `useBillingQueue.ts` e `CobrancaTable.tsx`

---

**3. Registrar Tentativa de Cobrança**

Ao clicar "Cobrar WhatsApp" no drawer, além de abrir o WhatsApp, registrar automaticamente um evento `tentativa_cobranca` no `billing_history` com a data/hora. Isso alimenta o "Dias sem contato".

Arquivo: `CobrancaDetailDrawer.tsx` — no `onClick` do botão WhatsApp, chamar `addHistory.mutateAsync` com tipo `tentativa_cobranca`.

---

**4. Atribuição de Responsável em Massa**

Permitir selecionar múltiplas assinaturas na fila e atribuir um responsável financeiro de uma vez. Útil para distribuir a carteira entre os cobradores.

Arquivo: `CobrancaQueue.tsx` — checkboxes + botão "Atribuir Responsável" com select do nome.

---

**5. KPI de Inadimplência no Topo**

Adicionar aos KPIs globais:
- **Clientes em Risco** (3+ parcelas): número + badge vermelho
- **Nunca Contatados**: quantidade de atrasados sem nenhum registro manual no histórico

Arquivo: Ajustar `CobrancaKPIs.tsx` e `useBillingKPIs`

---

**6. Filtro por Responsável na Tabela Principal**

Já existe o campo `responsavel` nos filtros, mas como 100% está sem responsável, o filtro é inútil hoje. Após a atribuição em massa funcionar, o filtro ganha valor. Já está implementado.

---

### Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `src/components/financeiro/cobranca/CobrancaQueue.tsx` | Novo — fila de cobrança priorizada |
| `src/hooks/useBillingQueue.ts` | Novo — query com inadimplência + última ação |
| `src/components/financeiro/cobranca/CobrancaDetailDrawer.tsx` | Registrar tentativa_cobranca ao clicar WhatsApp |
| `src/components/financeiro/cobranca/CobrancaKPIs.tsx` | Adicionar KPIs de risco e "nunca contatados" |
| `src/hooks/useBillingSubscriptions.ts` | Ajustar `useBillingKPIs` para incluir contagem de risco |
| `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx` | Integrar CobrancaQueue acima da tabela |

### Resultado Esperado

O time de cobrança terá uma fila de trabalho clara — sabe quem cobrar primeiro (maior risco), quem nunca foi contatado, e pode distribuir a carteira entre responsáveis. Cada ação de cobrança fica registrada automaticamente, alimentando métricas de produtividade.

