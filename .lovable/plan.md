## Melhorias em Cadastros Pendentes

Três correções principais: (1) escolher Select / Parcelinha no cadastro manual, (2) permitir editar dados em "Ver Detalhes", (3) preencher closer/parcelas/total para pendentes manuais ou sem deal vinculado.

### 1. AddPendingRegistrationModal — Select / Parcelinha + Closer
- Adicionar **Tipo de produto**: tabs `Select` ↔ `Parcelinha` (valor salvo em `tipo_produto`).
- Adicionar campo **Closer responsável** (Select de profiles ativos da BU Consórcio), salvo em `vendedor_id` + `vendedor_name_cota`.
- Quando `Empresa paga parcelas? = sim`, manter os campos atuais (tipo_contrato: Normal/Intercalado par/Intercalado ímpar, qtde parcelas) — esses já existem.
- Passar `tipo_produto`, `vendedor_id`, `vendedor_name_cota` para `useCreateManualPendingRegistration` (estender `CreateManualPendingInput`).

### 2. Lista — usar closer manual quando não houver deal
- Em `usePendingRegistrations`, quando `deal.owner_id` for `null`, buscar `vendedor_id` da registration e resolver via `profiles` para preencher `closer_name`.
- Sem isso, manuais sempre mostrarão "—" na coluna Closer.

### 3. OpenCotaModal (modo `view`) — Editar dados do pendente
- Adicionar botão **"Editar"** no header quando `mode='view'`. Toggle de um estado `isEditing` que remove o `disabled` do `<fieldset>` apenas dos campos de **Dados do Cliente** + nova seção **Dados do Pendente** (valor crédito, prazo, tipo_produto, empresa_paga_parcelas, tipo_contrato, parcelas_pagas_empresa, vendedor_id/closer, observações).
- Botão **"Salvar alterações"** chama nova mutação `useUpdatePendingRegistration({ id, patch })` que faz `update` em `consorcio_pending_registrations` com os campos editáveis e invalida `consorcio-pending-registrations` + `consorcio-pending-registration`.
- Não altera o fluxo normal de "Abrir Cota" (`mode='open'`).

### 4. Backfill visual: KPI Parcelas/Crédito
- Como `getParcelasEmpresa` já calcula a partir de `parcelas_pagas_empresa`+`prazo_meses`+`valor_credito`+`tipo_contrato`+`empresa_paga_parcelas`, basta editar esses campos via OpenCotaModal e a coluna "Parcelas (empresa)" / "Total a pagar" / KPIs populam automaticamente. Nenhuma mudança no cálculo.

### Backend
- **Sem migration nova**: todas as colunas usadas (`tipo_produto`, `vendedor_id`, `vendedor_name_cota`, `parcelas_pagas_empresa`, `tipo_contrato`, `empresa_paga_parcelas`, `valor_credito`, `prazo_meses`, `observacoes`) já existem em `consorcio_pending_registrations`.

### Arquivos
- Editar: `src/components/consorcio/AddPendingRegistrationModal.tsx` — tabs Select/Parcelinha + select de closer.
- Editar: `src/hooks/useConsorcioPendingRegistrations.ts` — estender `CreateManualPendingInput`; novo hook `useUpdatePendingRegistration`; fallback de closer via `vendedor_id` no select da lista.
- Editar: `src/components/consorcio/OpenCotaModal.tsx` — botão Editar/Salvar no modo view com nova seção "Dados do Pendente".

### Fora de escopo
- Vincular retroativamente os pendentes antigos a um `deal_id`. Para esses, o closer entra via edição manual.
