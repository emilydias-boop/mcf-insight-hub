# Anamnese do cliente no encaminhamento externo

Receber, guardar e mostrar os dados de anamnese que o outro app passou a enviar, sem mexer em nada que já funciona.

## 1. Recebimento (endpoint de encaminhamento)

Ler do corpo do POST, quando vierem: `anamnese_preenchida`, `anamnese_pdf_url`, `anamnese_estruturada`, `anamnese_resumo`, `anamnese_html`, `anamnese_preenchida_em`, `anamnese_atualizada_em`. Os campos antigos (`anamnese` cru, `score`, `faixa_classificacao`) continuam iguais.

Guardar em dois lugares, apenas somando informação:

- No cartão do negócio, dentro do campo de dados extras já existente (`custom_fields`), sob a chave `anamnese_v2` — nenhuma chave atual é removida ou alterada.
- No registro do encaminhamento, em colunas novas criadas por migração aditiva.

## 2. Reenvio do mesmo encaminhamento

Hoje, um reenvio com o mesmo `external_id` responde "duplicado" e não atualiza nada. Passa a: continuar sem criar segundo cartão, e atualizar os dados de anamnese (no registro do encaminhamento e no cartão vinculado) com a versão mais recente. Motivo, área, etapa, responsável, status e histórico permanecem intocados.

## 3. Card do cliente na etapa ENCAMINHADO GR

No cartão do quadro, apenas quando o negócio tiver dados de anamnese:

- Link permanente presente: botão discreto "Ver anamnese" que abre em nova aba.
- Sem link, mas com seções estruturadas: o botão abre uma janela no próprio sistema listando cada seção (título + "rótulo: valor").
- `anamnese_preenchida` falso: botão desabilitado com "sem anamnese".
- Cartões antigos sem esses dados: nada aparece, exatamente como hoje.

O botão não abre o cartão ao ser clicado e não altera nenhuma outra informação exibida.

## Detalhes técnicos

- `supabase/functions/crm-externo-encaminhamento/index.ts`: extração dos campos novos (com coerção defensiva — objeto/array/string inválidos viram `null`/`{}` sem derrubar o webhook); `custom_fields.anamnese_v2 = { preenchida, pdf_url, estruturada, resumo, html, preenchida_em, atualizada_em }`; no ramo de idempotência, `update` em `crm_externo_encaminhamentos` (colunas de anamnese + `payload_original`) e merge do `custom_fields` do deal preservando as chaves existentes.
- Migração aditiva em `crm_externo_encaminhamentos`: `anamnese_preenchida boolean`, `anamnese_pdf_url text`, `anamnese_estruturada jsonb`, `anamnese_resumo text`, `anamnese_html text`, `anamnese_preenchida_em timestamptz`, `anamnese_atualizada_em timestamptz` — todas nulas por padrão, sem alterar RLS, grants, triggers ou colunas existentes.
- Novo componente `src/components/crm/AnamneseExternaButton.tsx`: lê `deal.custom_fields.anamnese_v2`, renderiza botão `variant="ghost"` pequeno com ícone `FileText`, `window.open(pdf_url, '_blank', 'noopener')` ou `Dialog` com as seções; `e.stopPropagation()` no clique.
- `src/components/crm/DealKanbanCard.tsx`: inclusão do botão no bloco de badges, condicionada à presença de `anamnese_v2` (sem depender do nome da etapa, então funciona também no detalhe se quisermos depois).
- Sem alteração em RPCs, distribuição de leads, métricas, remuneração ou dados financeiros. Build e typecheck ao final.
