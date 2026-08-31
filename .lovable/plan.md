# Mapa (somente leitura): registro de teste travado em "Tratados" — Thiago Felipe Faustino

## 1) O que joga a linha para "Tratados"

Componente: `src/pages/crm/PosReuniao.tsx` (bloco renderizado por `FilaDuasListas`, `src/pages/crm/PosReuniao.tsx:758-769`).

```tsx
// PosReuniao.tsx:336-346
const propostasPendentes = useMemo(() =>
  propostas.filter(p => !termoAssinadoDe(p)) ... );
const propostasTratadas = useMemo(
  () => [...propostas.filter(p => !!termoAssinadoDe(p)), ...desistidas], ...);
```

Duas entradas independentes para "Tratados":

- `termoAssinadoDe(p)` = `termosDe(p).find(t => t.status === 'assinado')` (`PosReuniao.tsx:317`), lendo `consorcio_termos` via `useTermosByProposal` (`PosReuniao.tsx:311`).
- `desistidas` = propostas com `carta_excluida = true` no período (`PosReuniao.tsx:286-289`). Note que a lista principal exclui essas linhas (`PosReuniao.tsx:255-257`: `!p.carta_excluida`), então elas entram em "Tratados" **só** pelo caminho `desistidas`.

Esta linha satisfaz os dois critérios ao mesmo tempo.

## 2) Selo → campo

| Selo | Origem |
| --- | --- |
| `Recusada` | `consorcio_proposals.status` renderizado cru em `PosReuniao.tsx:500-504` (`{p.status}` capitalizado) |
| `Termo assinado · 22/08/2026` | `consorcio_termos.status = 'assinado'` + `assinado_em`, em `seloTermo` (`PosReuniao.tsx:378-388`) |
| `Desistência da Carta` + motivo em itálico | `consorcio_proposals.carta_excluida` / `carta_excluida_em` / `carta_excluida_por_nome` / `carta_excluida_motivo` (`PosReuniao.tsx:523-536`) |

`consorcio_proposal_cartas.declinada_at` / `motivo_declinio` **não** desenham selo nesta aba — eles só reduzem o agregado da venda (trigger `tg_sync_proposal_cartas_agregado`) e aparecem em Cotas a Fazer.

Quem grava `carta_excluida`: `useDeleteConsorcioCard` (`src/hooks/useConsorcio.ts:649-660`) — ao excluir a cota, marca todas as propostas com aquele `consortium_card_id`. O texto do diálogo desta aba (`DeletePropostaDialog`, `PosReuniao.tsx:880-940`) diz literalmente "Esta ação não pode ser desfeita"; o hook que ele chama, `useExcluirProposta` (`src/hooks/useConsorcioPostMeeting.ts:986-1110`), faz DELETE da proposta — ou seja, não é ele que produziu este estado.

## 3) O que o lápis faz

`PosReuniao.tsx:645-652` → `EditProposalModal` (`PosReuniao.tsx:845-861`).

```tsx
// EditProposalModal.tsx:98-101, 139, 170-184
const termoAssinado = useMemo(() => termos.find(t => t.status === 'assinado') || null, [termos]);
...
if (termoAssinado) return; // trava dura: nada muda com termo assinado
<DialogTitle>{termoAssinado ? 'Proposta (somente leitura)' : 'Editar Proposta'}</DialogTitle>
```

Com termo assinado o modal abre **somente leitura**. Ele não desfaz desistência e não cancela termo assinado: `useCancelTermo` (`src/hooks/useConsorcioTermos.ts:218-245`) tem `.eq('status', 'pendente')` — cancelar termo assinado é impossível pela aplicação, por desenho (snapshot).

## 4) Caminhos de reversão existentes

- **Reverter declínio da carta/cadastro:** existe — `useUndeclinePendingRegistration` (`src/hooks/useConsorcioPendingRegistrations.ts:790-860`), exposto em Cotas a Fazer: `src/components/consorcio/PendingRegistrationsList.tsx:381` e botão "Reverter declínio" em `:882-891`. Limpa `declinada_at/motivo_declinio/declinada_by` da carta e devolve o cadastro para `aguardando_abertura`; só reverte `proposals.status` de `recusada` para `aceita` se houver carta ativa.
- **Desfazer `carta_excluida` (Desistência da Carta) na proposta:** **não existe**. Nenhum ponto do `src/` escreve `carta_excluida: false`.
- **Cancelar/excluir termo assinado:** **não existe** (guard `.eq('status','pendente')`).
- **Voltar a carta para "Pendentes" nesta aba:** **não existe** — a classificação é derivada, não editável.

## 5) Reversão de etapa (`useConsorcioReversaoEtapa`)

Cobre só as etapas 5 e 4 do funil de cotas: `useReverterEtapa5Para4` (5 → 4, "Cotas a Fazer") e `useDesfazerParcelaInicial` (6 → 5), expostas em `src/components/consorcio/CotasCadastradasTab.tsx:119-127, 215-228`. As RPCs validam a etapa de origem e nunca escrevem em id de outra etapa. **Não existe** reversão de etapa 3 → "Reunião Realizada"; o mecanismo não cobre este caso.

## 6) Estado cru do registro

Proposta `68a1624b-42b4-49a7-8829-37402a3a82e1` (deal `d77e2eb3-84f2-40b1-88c4-430199d70da7`, "Thiago Felipe Faustino - EFEITO ALAVANCA", etapa atual do deal: **R1 Realizada**):

- `status = 'recusada'`, `motivo_recusa = 'teste do grima'`, `recusada_at = 2026-08-24 00:25:35Z`
- `carta_excluida = true`, `carta_excluida_em = 2026-08-24 00:24:10Z`, por **Grimaldo de Oliveira Melo Neto**, motivo `'teste do grima .'`
- `consortium_card_id = NULL` (a cota foi excluída; vínculo caiu por ON DELETE SET NULL), `deleted_at = NULL`
- Crédito 350.000, prazo 240, produto `parcelinha`, `proposal_date = 2026-08-22`

Cartas (`consorcio_proposal_cartas`) — três, só a primeira declinada:

| carta | ordem | declinada_at | motivo | pending_registration_id |
| --- | --- | --- | --- | --- |
| `fe0149b8-…6cc` | 1 | 2026-08-31 13:49:31Z | teste do grima | `808473fd-…673` |
| `f057252a-…fd03` | 2 | — | — | — |
| `dd190305-…9b6b` | 3 | — | — | — |

Cadastro pendente `808473fd-445c-406a-a928-ce5488ed6673`: `status = 'declinada'`, `declinada_at = 2026-08-31 13:51:23Z`, motivo `'termo de adesão houve divergencia pós assinatura'`, `consortium_card_id = NULL`.

Ou seja, o estado é o empilhamento de quatro ações de teste: exclusão da cota (24/08), recusa da proposta (24/08), declínio da carta 1 (31/08) e declínio do cadastro (31/08) — mais o termo assinado de 22/08.

## 7) O termo

`eb10b02a-609f-49bd-915b-fc1175cc523b`, `tipo = 'adesao'`, `status = 'assinado'` — **assinatura real, não simulada**:

- `created_at = 2026-08-22 12:14:28Z`, `visualizado_em = 12:14:34Z`, `assinado_em = 12:14:45Z`
- `assinante_nome = 'THIAGO FELIPE FAUSTINO'`, `assinante_cpf = '068.857.656-78'`, `assinante_ip = 191.183.40.91`
- `conteudo_renderizado` presente (2.896 caracteres), `conteudo_hash = 5047ce5b…a73b`
- `cancelado_em = NULL`, `expires_at = 2026-09-21`
- Vinculado ao cadastro pendente `808473fd-…673`

Documento assinado é snapshot: não há botão para cancelá-lo nem para reemitir sobre ele, e o guard do hook impede qualquer cancelamento de termo já assinado.

## Resumo em uma frase

A linha está presa porque três marcadores independentes convivem na mesma proposta (`status='recusada'`, `carta_excluida=true`, termo `assinado`), e a aplicação só tem reversão para um deles (declínio da carta/cadastro, em Cotas a Fazer) — não há caminho para desfazer `carta_excluida` nem para cancelar termo assinado.

## Antes de propor solução

Uma pergunta decide o desenho: o dono quer (a) um caminho genérico e auditado de "desfazer desistência da carta" nesta aba, reutilizável, ou (b) apenas destravar este registro de teste pontualmente (nominal, sem nova feature)? E o termo assinado deste teste: aceita-se permitir cancelamento de termo assinado apenas por papel de liderança e com justificativa, ou o termo deve permanecer intocável e a saída é a proposta ficar fora do funil sem tocar no documento?
