

## Refinar email do Incorporador (Jessica) — 9 ajustes

### 1. KPIs do Carrinho — Contratos: nomes confusos

**Hoje** (com os números do print):
- Total Transações: 41 — *inclui recorrências e reembolsos, gera dúvida do que é*
- Recorrências: 3
- Com Reembolso: 38 — *nome sugere "que tiveram reembolso", mas é "novos contratos antes do desconto"*
- Reembolsos: 11
- Contratos Líq.: 27

**Proposta** (mesmos números, nomes que explicam):
- **Transações no período**: 41 (todas as transações A000)
- **Recorrências (parcelas)**: 3 (não são contratos novos)
- **Contratos novos (bruto)**: 38 (= 41 − 3)
- **Reembolsos no período**: 11
- **Contratos novos (líquido)**: 27 (= 38 − 11) ← destaque verde

Adicionar tooltip/legenda curta abaixo: *"Contratos novos = transações novas A000 menos parcelas recorrentes. Líquido = bruto menos reembolsos."*

### 2. Bloco R1 — números não fecham e falta %

Você está certo: 293 − 153 ≠ 94. Investigando o código (linhas 267–275, 561–572):
- **Agendamentos (293)** vem do RPC `get_sdr_metrics_from_agenda` — conta TODAS as reuniões agendadas no período, **incluindo reagendamentos e canceladas**
- **R1 Realizada (153)** conta apenas as efetivamente realizadas
- **No-Show R1 (94)** conta marcações de "no_show", mas **exclui reagendadas, canceladas e ainda-pendentes**

Por isso 293 ≠ 153 + 94. Os 46 da diferença são reagendadas + canceladas + ainda não realizadas.

**Proposta**:
- Manter as 3 KPIs e **adicionar uma 4ª: "Outros (reagendadas/canceladas/pendentes)"** = 293 − 153 − 94 = 46
- Adicionar **% Comparecimento** = R1 Realizada / (R1 Realizada + No-Show) — métrica mais honesta, ignora os "outros"
- Adicionar **% No-Show** = No-Show / (R1 Realizada + No-Show)
- Tooltip: *"Agendamentos inclui reagendamentos. Comparecimento e No-Show calculados sobre as que efetivamente aconteceram (Realizada + No-Show)."*

### 3. Bloco R2 — explicar de onde vem cada número

Hoje só mostra os valores. Preciso explicitar a janela:
- **R2 Agendada (52)**: attendees R2 não-parceiros agendados na semana (Sáb→Sex) + encaixados manualmente
- **R2 Realizada (45)**: agendadas menos no-shows reais
- **Aprovados (31)**: status R2 = "Aprovado"
- **Próx. Semana (3)**: status = "Próxima Semana"
- **Fora Carrinho (6)**: Reprovados + Reembolso + Desistente + Cancelado

**Proposta**: adicionar **subtítulo explicativo** — *"Reuniões R2 da semana (Sáb a Sex), incluindo leads encaixados manualmente"* — e **legenda curta abaixo de cada KPI** (1 linha cinza) explicando o que cada um conta.

### 4. Origem dos Leads — explicar que são "entradas no Carrinho R2"

Hoje aparece "Origem dos Leads (R2)" sem contexto. Os 45+1+6 = 52 batem com R2 Agendada acima.

**Proposta**: renomear para **"Origem das Entradas no Carrinho R2 (52)"** com subtítulo: *"Como cada lead que entrou no carrinho desta semana foi originado: A010 (compra antiga), ANAMNESE (passou pelo funil de qualificação), LIVE (entrou direto via evento)"*.

### 5. Adicionar 2º gráfico de pizza — Contratos Fechados por origem

Hoje só tem pizza de status R2. Você pediu "um mostrando contratos da mesma forma".

**Proposta**: adicionar **segunda pizza ao lado** = "Contratos Fechados (27) por Origem" — quebra os 27 contratos líquidos em A010/ANAMNESE/LIVE usando o mesmo cruzamento de email já feito nas linhas 401–460. Visual: duas pizzas lado a lado, mesma legenda.

### 6. Ranking SDRs — adicionar Meta e explicar critério do 1º lugar

Hoje:
- Coluna "Meta/Agend." mostra `45/45` mas o `45` da meta nem sempre aparece (depende de comp_plan vigente)
- Ordenação por `contratos desc, r1Realizadas desc` (linha 591) — não está documentado no email

**Proposta**:
- **Separar em duas colunas**: "Meta Semanal" e "Agendados" (hoje estão juntos como `45/45`)
- Adicionar coluna **"% Meta"** = Agendados / Meta
- Adicionar **legenda no topo da tabela**: *"Ranking ordenado por nº de Contratos fechados. Em caso de empate, desempata por R1 Realizadas. Meta semanal = meta mensal ÷ dias úteis × 5."*
- Manter destaque das linhas 1º/2º/3º

### 7. Closers R1 — adicionar % Conversão

Hoje a tabela mostra R1 Agendada / R1 Realizada / Contratos sem nenhuma %.

**Proposta**: adicionar duas colunas:
- **% Comparecimento** = R1 Realizada / R1 Agendada
- **% Conversão** = Contratos / R1 Realizada

Exemplo do print: Cristiane 60→45→12 viraria 75% comparecimento, 27% conversão.

### 8. Closers R2 — produto por closer não mostra os números corretamente

Hoje a coluna "Produtos" lista nomes longos (`A001 - MCF INCORPORADOR COMPLETO: 1, A009 - ...`) e fica truncada. Apenas a Claudia tem dados; Jessica Martins e Bellini aparecem com `-` mesmo tendo aprovados.

**Proposta**:
- **Adicionar coluna "% Conversão R2"** = Aprovados / R2 Realizada
- **Adicionar coluna "Ticket Médio Parc."** = receita parceria / vendas parc.
- **Substituir "Produtos" por "Receita Parceria"** (valor R$) — números longos saem da tabela e vão pro Resumo Financeiro
- Mostrar breakdown de produtos só no Resumo Financeiro (seção 4), não duplicar

### 9. Resumo Financeiro — mostrar Bruto e Líquido

Hoje só mostra um "Valor" (que é `net_value` da `hubla_transactions`). Você quer ver os dois.

**Proposta**: adicionar 2 colunas no lugar de 1:
- **Bruto** = soma de `reference_price` da `product_configurations` (mesma lógica do `useCarrinhoAnalysisReport`, linhas 425–446)
- **Líquido** = `net_value` (o que é hoje)
- **Diferença %** opcional: `(Bruto − Líquido) / Bruto`

Exemplo: A001 18 vendas → Bruto R$ 89.820 / Líquido R$ 68.296 (24% desconto/taxas)

Para Vendas A010 e Contratos A000 a lógica é igual: buscar `reference_price` por `product_name` em `product_configurations`.

---

### Detalhes técnicos

**Arquivo único alterado**: `supabase/functions/weekly-manager-report/index.ts`, função `buildIncorporadorReport` (linhas 163–867).

**Novas queries** (adicionar):
1. `product_configurations` (todos produtos relevantes) → Map para lookup de `reference_price` no Resumo Financeiro
2. Cruzamento contratos A000 × emails A010/ANAMNESE/LIVE → para 2ª pizza (já temos `dealContactMap` + `a010EmailSet` + `anamneseDealIds`, basta cruzar com transações A000 por email)

**Sem alteração de banco**. Sem novos arquivos. Sem impacto em Consórcio/Diretor.

**Deploy**: redeploy de `weekly-manager-report` + disparo de teste via `supabase--curl_edge_functions` com `{ buFilter: 'incorporador' }` para Jessica validar.

