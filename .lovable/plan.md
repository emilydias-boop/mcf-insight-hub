
## Objetivo
Fazer o relatório de **Contratos** deixar de aparecer zerado (hoje está falhando por erro 400 na query) e, conforme sua decisão (“**Ambos**”), exibir também a visão baseada em **pagamentos Hubla do produto A000** (inspirado na página de Vendas), além da visão **Agenda (contract_paid)**.

---

## Diagnóstico (o motivo do “zerado” agora)
Ao abrir o relatório, a aplicação faz uma requisição ao Supabase e recebe erro **400**:

- Erro: `column meeting_slot_attendees.attendee_email does not exist`

Isso acontece porque o hook `useContractReport` está selecionando a coluna `attendee_email`, mas na tabela `meeting_slot_attendees` **não existe** essa coluna (existe `attendee_name` e `attendee_phone`, mas não `attendee_email`).

Como a query falha, o React Query não recebe dados e a tela fica mostrando 0.

---

## O que será feito (alto nível)
1) Corrigir o relatório “Agenda” (contract_paid) removendo a coluna inexistente `attendee_email` do select e ajustando o cálculo de `contactEmail`.
2) Implementar a segunda fonte “Hubla (A000)” inspirada na página de Vendas:
   - Buscar `hubla_transactions` no período com `sale_status='paid'` e `product_name` contendo `A000` (e fallback “contrato” se necessário).
3) Unificar em “Ambos”:
   - Mostrar **dois totais** (Agenda atribuídos e Hubla A000 pagos)
   - Mostrar uma terceira métrica: **Pendentes de atribuição** (Hubla A000 que não achou match na Agenda)
   - Listar tabela combinada com coluna “Fonte” e indicação de “Sem closer” quando vier só da Hubla.
4) Ajustar exportação Excel para exportar também os campos da Hubla quando aplicável (e a coluna Fonte).

---

## Arquivos que serão alterados
- `src/hooks/useContractReport.ts`
- `src/components/relatorios/ContractReportPanel.tsx`
- (novo hook opcional, dependendo do padrão do projeto) `src/hooks/useHublaA000Contracts.ts` **ou** lógica embutida no painel com `useQuery`

Obs: em modo de implementação eu seguirei o padrão já usado (React Query + Supabase client), parecido com `SalesReportPanel`/`useTransactionsByBU`.

---

## Passo a passo detalhado

### 1) Corrigir o hook `useContractReport` (Agenda / contract_paid)
**Mudanças:**
- Remover `attendee_email` do `.select(...)`.
- Ajustar o trecho que calculava email do contato:
  - Antes: `contact?.email || row.attendee_email || null`
  - Depois: `contact?.email || null` (ou usar outro fallback real, se existir, como email no deal/contato; hoje `meeting_slot_attendees` não tem email)

**Resultado esperado:**
- A requisição deixa de retornar 400
- O relatório volta a listar os ~226 contratos do período (dependendo do filtro)

---

### 2) Implementar fonte Hubla “A000 (paid)”
Criar uma busca inspirada na página de Vendas, mas filtrando **produto A000**.

**Filtro sugerido (robusto):**
- `sale_status = 'paid'`
- `sale_date` entre `startDate` e `endDate`
- `product_name ilike %a000%`
- (fallback adicional) `OR product_name ilike %contrato%` — opcional, para cobrir variações de nome

**Formato retornado (model):**
- id, sale_date, product_name, net_value, product_price/gross_override (se existir), customer_name, customer_email, customer_phone, source, installment info.

---

### 3) Matching (para achar “Pendentes” e ligar Hubla ↔ Agenda)
Para “Ambos”, precisamos detectar quais pagamentos Hubla (A000) já foram atribuídos na Agenda:

**Estratégia de match (mesma filosofia do reprocessamento):**
1. **Email**: `lower(trim(customer_email))` ↔ `lower(trim(crm_contacts.email))`
2. **Telefone** (fallback): normalizar e comparar sufixo (últimos 9 dígitos), usando `normalizePhoneNumber` (já existe em `src/lib/phoneUtils.ts`)

**Saídas do matching:**
- `hublaMatched`: pagamentos Hubla que encontraram um registro na Agenda
- `hublaUnmatched`: pagamentos Hubla sem match → entram como “Pendentes de atribuição”

---

### 4) UI/UX no `ContractReportPanel`
Adicionar um seletor de “Fonte” (sem quebrar a experiência atual):

**Opções:**
- `Ambos` (padrão)
- `Agenda (atribuídos)` (somente contract_paid)
- `Hubla A000 (pagos)` (todos A000 pagos)
- `Pendentes` (apenas Hubla A000 sem match na Agenda)

**Cards de resumo:**
- Contratos (Agenda)
- Pagamentos A000 (Hubla)
- Pendentes (Hubla sem match)
- (opcional) % atribuídos = Agenda / Hubla

**Tabela combinada:**
- Adicionar coluna “Fonte” (Agenda/Hubla/Pendente)
- Para linhas Hubla pendentes:
  - Closer: “—” ou “Sem atribuição”
  - Lead: customer_name
  - Email/Telefone: se existir
  - Data: sale_date
- Para linhas Agenda:
  - Mantém o layout atual com closer + meeting + pipeline + canal (A010/BIO/LIVE)

---

### 5) Exportação Excel
Quando “Fonte = Ambos”, exportar linhas com colunas unificadas:
- Fonte
- Data Pagamento (Hubla: sale_date; Agenda: contract_paid_at)
- Closer (se houver)
- Lead / Cliente
- Email / Telefone (se houver)
- Produto (Hubla)
- Canal (Agenda)
- etc.

---

## Critérios de aceite (como validar)
1. O relatório não pode mais retornar “zerado” por erro de coluna inexistente.
2. A aba/visão “Agenda (atribuídos)” deve listar contratos do período quando existirem.
3. A visão “Hubla A000 (pagos)” deve listar pagamentos A000 quando existirem.
4. A visão “Ambos” deve:
   - Mostrar os dois totais
   - Mostrar “Pendentes” quando houver diferença
5. Exportação Excel deve refletir a fonte selecionada.

---

## Riscos e cuidados
- Se a Hubla não tiver registros A000 no período, “Hubla A000” pode aparecer 0 (isso é esperado) e “Pendentes” também 0.
- Precisamos garantir que a consulta Hubla respeite RLS (igual o relatório de Vendas já respeita).
- Matching por telefone pode ter falsos positivos em casos raros; manter email como prioridade.

---

## Implementação técnica (resumo)
- Corrigir `useContractReport.ts`: remover `attendee_email` e ajustar `contactEmail`.
- Criar query Hubla A000 com React Query (padrão do projeto).
- No `ContractReportPanel.tsx`, combinar datasets e implementar seletor “Fonte”, cards e export.

