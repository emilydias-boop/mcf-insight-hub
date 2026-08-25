# Levantamento — 4 frentes (investigação, nada alterado)

## 1) Termo de adesão — cláusula das parcelas pagas pela MCF

**Onde a frase é montada.** Ela NÃO está em código: está no corpo do modelo, na tabela `consorcio_termo_modelos`. Modelo ativo de adesão: `d51977ff-0c3e-4b16-a0a7-16b9392371f6`, versão 2 (versão 1, `6dd7d540-…`, inativa). Texto literal do modelo ativo, seção 3:

```
A **MCF Capital** assume, de forma irrevogável, o compromisso de efetuar o pagamento de **{{parcelas_mcf_qtd}}** parcelas da cota acima descrita, conforme a tabela abaixo, totalizando **{{parcelas_mcf_total}}**:

{{parcelas_mcf_lista}}
```

Cópias históricas do mesmo texto existem em migrações (só como seed, não são lidas em runtime):
- `supabase/migrations/20260817021422_…sql:103` (versão antiga, "conforme discriminado abaixo")
- `supabase/migrations/20260817160010_…sql:38` (texto atual)

Único ponto que substitui os placeholders: `renderTermo` em `src/lib/consorcioTermo.ts:338-340`. Ele é chamado uma única vez por geração, em `src/components/consorcio/GerarTermoModal.tsx:109-112` (`preview`), e esse MESMO `preview` é o que vai para o banco em `GerarTermoModal.tsx:133` (`conteudoRenderizado: preview`). **Não há duplicação de template entre tela e conteúdo gravado** — a tela renderiza `preview` (`GerarTermoModal.tsx:221` → `<TermoMarkdown content={preview} />`) e o banco grava o mesmo string.

**Quem determina a quantidade e o total.**
- 1 carta: `montarDadosTermo` (`consorcioTermo.ts:141-169`) → `parcelas_mcf_qtd = String(parcelas.length)` (linha 163) e `parcelas_mcf_total = formatCurrency(total)` (165), onde `parcelas` vem de `parcelasMcfComValoresDigitados` (88-102) → `getParcelasEmpresa` (`src/lib/consorcioParcelasEmpresa.ts`), alimentado por `prazo_meses`, `parcelas_pagas_empresa`, `tipo_contrato`, `valor_credito`, `empresa_paga_parcelas` do cadastro.
- N cartas: `montarDadosTermoMulti` (290-336) usa `montarTabelaParcelasMcfConsolidada` (255-284), que devolve `{tabela, qtd, total}`; `qtd = itens.length`, `total = soma`.
- Quando não há parcela da MCF, `qtd` é `0`, `total` é `R$ 0,00` e a tabela vira o texto `'Nenhuma parcela sob responsabilidade da MCF Capital.'` (`consorcioTermo.ts:119` no caminho single, `:275` no consolidado). Ou seja: a frase da cláusula continua impressa com 0 e R$ 0,00; só o corpo da tabela troca de forma.

**A tabela é do mesmo trecho?** Não é do mesmo trecho da frase: a frase está no modelo (banco) e a tabela vem do placeholder `{{parcelas_mcf_lista}}`, montada por `montarTabelaParcelasMcf` (`consorcioTermo.ts:114-128`) ou `montarTabelaParcelasMcfConsolidada` (`:255-284`).

**Snapshot — prova no código.**
- Gravação única no insert: `src/hooks/useConsorcioTermos.ts:183-201` — `hash = await sha256Hex(input.conteudoRenderizado)` (183), `dados_snapshot` (194), `conteudo_renderizado` (195), `conteudo_hash` (196).
- Não existe nenhum `update` de `conteudo_renderizado`/`conteudo_hash`/`dados_snapshot` em lugar nenhum: os únicos `.update()` sobre `consorcio_termos` são `useCancelTermo` (`useConsorcioTermos.ts:223-232`: status/cancelado_*) e, na edge function, status/assinatura/visualização (`supabase/functions/termo-assinatura/index.ts:109`, `116-119`, `172-185`). Nenhum recalcula hash.
- Leitura sempre serve o gravado: `TermoPanelDialog.tsx:49` (`conteudo: t.conteudo_renderizado`), edge function `index.ts:79` (`conteudo: t.conteudo_renderizado`) e página pública `src/pages/public/TermoAssinatura.tsx:129` (`<TermoMarkdown content={termo.conteudo} />`).
- Conclusão: **mudar o modelo não afeta termos já emitidos.** Só documentos novos (mesma nota já registrada em `consorcioTermo.ts:110-113`).

**Termos com 0 parcelas / R$ 0,00:** zero. Contagem em `consorcio_termos` (tipo adesão): 25 assinados, 2 pendentes, 1 cancelado; `dados_snapshot->>'parcelas_mcf_qtd' = '0'` → 0 linhas; `conteudo_renderizado like '%pagamento de **0**%'` ou `'%totalizando **R$ 0,00**%'` → 0 linhas; `'Nenhuma parcela sob responsabilidade%'` → 0 linhas.

## 2) Termo — endereço e dia de vencimento

**Endereço.** Placeholder `{{cliente_endereco}}` (modelo, seção 1), preenchido em `consorcioTermo.ts:152` (single) e `:310` (multi):
`(isPj ? reg.endereco_comercial : reg.endereco_completo) || reg.endereco_completo || '—'`.
Vazio ⇒ imprime literalmente `—`. Hoje, nos termos existentes, `dados_snapshot->>'cliente_endereco' = '—'` → **0 linhas** (nenhum termo emitido saiu sem endereço).

**Dia de vencimento.** Modelo imprime `**Dia de vencimento:** dia {{dia_vencimento}}` — daí sair "dia A definir". Origem do valor: `consorcioTermo.ts:162` `Number(reg.dia_vencimento) ? String(reg.dia_vencimento) : 'A definir'`; no multi, `:323-325` com `unicoOuVerTabela`. A tabela de parcelas também usa `'A definir'` (`:120` e `:269`). Campo real: `consortium_cards.dia_vencimento` / `consorcio_pending_registrations.dia_vencimento`, nulo permitido — quem define é a Embracon depois da abertura; a confirmação da contratação (`ConfirmarContratacaoModal`) exige o dia 1–31. Termos com `dia_vencimento = 'A definir'` no snapshot: **7** (5 assinados, 1 pendente, 1 cancelado).

**Validação antes de gerar.** Existe e é bloqueante:
- `validarDadosTermoMulti` (`consorcioTermo.ts:193-209`) exige nome, documento, e por carta: `valor_credito`, `prazo_meses`, `parcela_1a_12a`, `parcela_demais`. **Endereço e dia de vencimento NÃO são exigidos.**
- `divergenciasIdentidade` (`:182-190`) bloqueia CPF/nome divergentes entre cadastros.
- UI: alerta destrutivo "Dados obrigatórios faltando" com `rotuloFaltando` em `GerarTermoModal.tsx:204-219`, botão "Completar cadastro" (`:233-237`) e `bloqueado` em `:114`. Esse é o padrão a seguir para novos avisos (aviso amarelo/não bloqueante seria variante nova).

## 3) Criar contato — 409 silencioso

- Componente: `src/components/crm/ContactFormDialog.tsx` — submit em `:31-47`, `await createContact.mutateAsync({...})` em `:36-43`, sem `try/catch`.
- Mutation: `useCreateCRMContact` em `src/hooks/useCRMData.ts:322-344`; insert em `:327-331`, `if (error) throw error` (`:333`).
- Tratamento hoje: **existe** `onError` em `useCRMData.ts:340-342` → `toast.error(\`Erro ao criar contato: ${error.message}\`)`, e o `Sonner` está montado (`src/App.tsx:179`). O que o código explica com certeza é que o modal **não fecha** e o formulário não é limpo (linhas 45-46 nunca executam, porque `mutateAsync` rejeita e a rejeição fica sem tratamento no `handleSubmit`). Já a ausência total de toast **não determinei** pelo código — o `onError` deveria disparar; se na prática nada aparece, falta reproduzir com console aberto.
- Mensagem do trigger (`pg_proc.prosrc` de `prevent_duplicate_crm_contact`), literal:
  - `RAISE EXCEPTION 'duplicate_contact:email:%:%', v_email_norm, v_existing_id USING ERRCODE = 'unique_violation';`
  - `RAISE EXCEPTION 'duplicate_contact:phone:%:%', v_phone9, v_existing_id USING ERRCODE = 'unique_violation';`
  - Chave de telefone: `right(regexp_replace(phone,'\D','','g'), 9)`, só quando tem 9 dígitos; só contatos ativos (`is_archived=false` e `merged_into_contact_id IS NULL`).
  - No cliente: `error.code = '23505'` (unique_violation, HTTP 409) e `error.message` contendo `duplicate_contact:phone:<9dígitos>:<uuid>`. Já existe parser pronto para isso em `src/lib/duplicateContactError.ts:11` (regex `duplicate_contact:phone:([0-9]+):([0-9a-f-]{36})`) — hoje não usado por este formulário.
- Reuso: `ContactFormDialog` é usado só em `src/pages/crm/Contatos.tsx:553`. A mutation `useCreateCRMContact` também é usada em `src/components/crm/SdrSummaryBlock.tsx:20`.

## 4) Cache funil × externa

- A key `['consorcio-cotas-origem-funil']` aparece **uma única vez em todo o projeto**: `src/hooks/useConsorcioCotasOrigem.ts:15`. `rg -n "consorcio-cotas-origem" src` retorna só essa linha — **nunca** é invalidada nem tem `setQueryData`. Confirmado.
- Config do hook: `staleTime: 5 * 60 * 1000` (`:16`); **`gcTime` não é definido** (fica no default do React Query, 5 min).
- `useOpenCota` (`src/hooks/useConsorcioPendingRegistrations.ts:1012`), invalidações no `onSuccess` (`:1287-1292`), nesta ordem:
  1. `['consorcio-pending-registrations']`
  2. `['consortium-cards']`
  3. `['consortium-summary']`
  4. `['consorcio-proposals']`
- Consumidores da classificação: `FunilConsorcioTimeline.tsx`, `CotasTab.tsx`, `CotasReservadasTab.tsx`, `ConfirmarContratacaoModal.tsx`.
- Outros pontos que mudam o vínculo `consortium_card_id` (logo, a origem) e que também ficam servindo cache velho:
  - `useVincularCarta` — `src/hooks/useConsorcioPostMeeting.ts:918-921` (grava `consorcio_proposals.consortium_card_id`); invalida só `['consorcio-proposals']` (`:936`).
  - `useOpenCota` — `useConsorcioPendingRegistrations.ts:1278` (grava `consorcio_pending_registrations.consortium_card_id`).
  - `useDeleteConsorcioCard` — `src/hooks/useConsorcio.ts:624-680` (deleta o card; vínculo cai por `ON DELETE SET NULL`); invalida `['consortium-cards']`, `['consortium-summary']`, `['consorcio-proposals']`.
  - `useCreateConsorcioCard` — `src/hooks/useConsorcio.ts:336` (cota avulsa, nasce "externa").
  - Reversões — `src/hooks/useConsorcioReversaoEtapa.ts:80-91` (`invalidarFunil`) invalida 7 keys: `consorcio-cotas-cadastradas`, `consortium-cards`, `consorcio-cotas-reservadas`, `consorcio-reservas-aguardando`, `consorcio-pending-registrations`, `consorcio-reversao-status`, `consorcio-funil-r1` — **nenhuma delas é a de origem**.
  - Fora do funil — `src/hooks/useConsorcioForaFunil.ts:54` e `:70` invalidam só `['consorcio-cotas-contratadas']`.

Nenhum arquivo foi alterado, nenhuma migração rodada, nenhum dado tocado.
