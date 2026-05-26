
## Objetivo

Permitir cadastrar manualmente uma cota pendente direto na aba **Cadastros Pendentes** (sem precisar passar pelo closer) e exibir KPIs no topo mostrando o quanto ainda falta cadastrar.

---

## 1. Botão "Adicionar Pendente" + Modal manual

**Onde:** header da aba "Cadastros Pendentes" (`PendingRegistrationsList.tsx`), ao lado do título.

**Novo componente:** `src/components/consorcio/AddPendingRegistrationModal.tsx`

Modal enxuto, focado no que é necessário para depois "Abrir cadastro":

- **Origem / Parceiro** (texto livre, ex.: "Parceiro Novembro" / "Indicação João") — vai para `vendedor_name` + um campo de origem manual.
- **Tipo de pessoa**: PF / PJ
- **Nome completo / Razão social** + **CPF / CNPJ**
- **Telefone** e **e-mail** (opcionais)
- **Valor da cota** (R$)
- **Prazo (meses)**
- **Empresa paga parcelas?** Sim/Não
  - Se Sim: **Tipo de contrato** (Normal / Intercalado par / Intercalado ímpar) + **Quantidade de parcelas pagas**
- **Data de aceite** (default = hoje)
- **Observações**

Sem `proposal_id` / `deal_id` (cadastro avulso, sem vínculo de CRM).

**Nova mutation:** `useCreateManualPendingRegistration` em `useConsorcioPendingRegistrations.ts`:
- Insere direto em `consorcio_pending_registrations` com `status='aguardando_abertura'`, `created_by=user.id`, `deal_id=null`, `proposal_id=null`.
- Invalida a query da lista.

A enriquecedora `usePendingRegistrations` já tolera `deal=null` (cai em "Sem origem"), então a rotulagem fica `"<vendedor_name manual> · Mai/2026"` — vou ajustar `origem_label` para usar `vendedor_name` quando não houver `deal.origin`.

---

## 2. KPIs de déficit no topo

**Novo componente:** `src/components/consorcio/PendingRegistrationsKPIs.tsx`

Quatro cards acima da tabela, calculados em memória a partir de `usePendingRegistrations()` (sem nova query):

| Card | Cálculo |
|---|---|
| **Cotas a cadastrar** | `registrations.length` |
| **Parcelas a cadastrar (empresa)** | soma de `reg.parcelas_empresa.length` |
| **Crédito total pendente** | soma de `reg.valor_credito` (formatado R$) |
| **Mês com maior déficit** | agrupar por `format(aceite_date || created_at, 'MMM/yyyy')`, pegar o mês com mais cadastros pendentes — mostra `"Nov/2025 · 7 cotas"` |

Cards seguem o mesmo padrão visual usado em outras abas do Consórcio (`Card` shadcn + ícone + valor grande + label).

---

## 3. Ajustes pequenos

- `formatOrigemLabel(originName, aceiteDate)` ganha um terceiro parâmetro fallback `manualOrigem?: string` usado quando `originName` está vazio (para o cadastro manual aparecer corretamente).
- `PendingRegistrationsList.tsx`:
  - Adicionar `<PendingRegistrationsKPIs registrations={registrations} />` acima do `<Card>` da tabela.
  - Adicionar botão **`+ Adicionar Pendente`** no `CardHeader` (à direita do título, `justify-between`).
  - Estado `addOpen` controla o `AddPendingRegistrationModal`.

---

## Fora de escopo

- Não mexe em `AcceptProposalModal` (fluxo via closer continua igual).
- Não muda schema (status `aguardando_abertura` já existe, todos os campos usados já existem).
- Não toca CRM/Pipelines/Agenda.

---

## Arquivos

**Novos**
- `src/components/consorcio/AddPendingRegistrationModal.tsx`
- `src/components/consorcio/PendingRegistrationsKPIs.tsx`

**Editados**
- `src/hooks/useConsorcioPendingRegistrations.ts` (nova mutation `useCreateManualPendingRegistration` + ajuste no rótulo de origem para manuais)
- `src/components/consorcio/PendingRegistrationsList.tsx` (botão + KPIs)
- `src/lib/consorcioOrigemLabel.ts` (fallback de origem manual)
