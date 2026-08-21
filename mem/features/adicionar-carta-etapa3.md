---
name: Adicionar Carta (venda manual) na etapa 3
description: Botão "Adicionar Carta" vive na etapa 3 (Termos de Adesão Pendentes) e cria venda completa — 1 proposta aceita + N cartas + N cadastros — com lead obrigatório no CRM.
type: feature
---

O antigo "Adicionar Pendente" (etapa 4) foi substituído por **"Adicionar Carta"** no cabeçalho da
aba de propostas (`PropostasTab` em `src/pages/crm/PosReuniao.tsx`), ao lado do "Exportar Excel".
Componente: `src/components/consorcio/AddCartaModal.tsx` (o `AddPendingRegistrationModal` foi removido).

O que ele cria, numa transação lógica:
1. `consorcio_proposals` — status `aceita`, `proposal_date` e `aceite_date` = data de aceite informada,
   valor = soma das cartas, `origem_lead` = origem estruturada;
2. `consorcio_proposal_cartas` — uma por carta (crédito, prazo, produto, categoria, condição,
   objetivo, parcela 1ª–12ª, demais parcelas, parcelas MCF);
3. `consorcio_pending_registrations` — um por carta, com `carta_id` vinculado; documento sobe uma vez
   e é replicado por `replicarDocumentosDaVenda`.

Regras:
- **Lead no CRM é obrigatório.** "Criar lead novo no CRM" insere contato + negócio na origem
  Efeito Alavanca + Clube (`7d7b1cb5-…`), etapa "Parceiros" (`801a19f4-…`) — entrada neutra sem
  automação de mensagem ao cliente.
- Origem passa a ser gravada na coluna estruturada `origem` (catálogo `consorcio_origem_options`),
  com `origem_detalhe` livre para o resto. Nunca mais texto livre em `vendedor_name`.
- Como nasce com `proposal_id`, a carta manual **entra na trava de assinatura**: só aparece em
  "Cotas a Fazer" depois do termo assinado. Está escrito no cabeçalho do formulário.
- Os 331 cadastros históricos sem `proposal_id` continuam isentos — sem migração retroativa.

Correção de vínculo (`useCorrigirVinculoCota` / `CorrigirVinculoCotaModal`) é caminho separado e
segue criando cadastro sem proposta — não exige termo.
