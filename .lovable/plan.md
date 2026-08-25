# Laudo: "Novo Contato" devolvendo 409 em silêncio

Resumo: **não é o `clint_id`, e o botão não está quebrado para todo mundo.** O 409 vem da trava de duplicidade por telefone — os dois números que você usou já existem no banco. O que **está** errado é a interface: nesta tela o erro não é traduzido nem exibido de forma que o operador entenda, e o modal fica exatamente como estava.

## A. A causa exata do 409 — sua suspeita cai

O 409 **não é** violação de índice único de coluna. `crm_contacts` tem apenas duas constraints únicas: `crm_contacts_pkey` (`id`) e `crm_contacts_clint_id_key` (`clint_id`) — e o `clint_id` enviado é único por construção (ver B).

O 409 é levantado pelo **trigger** `prevent_duplicate_crm_contact` (BEFORE INSERT, `SECURITY DEFINER`), que faz `RAISE EXCEPTION 'duplicate_contact:phone:%:%' USING ERRCODE = 'unique_violation'`. PostgREST traduz `unique_violation` (23505) em **HTTP 409**. Definição criada em `supabase/migrations/20260427183320_bb6da08f-b7dc-41bb-a7de-6178df70cc20.sql`.

A regra: e-mail normalizado, e **os últimos 9 dígitos do telefone**, comparados contra qualquer contato ativo (`is_archived` falso e `merged_into_contact_id` nulo).

Os dois telefones que você usou já pertencem a contatos ativos:

| Telefone digitado | Já existe em | Criado em |
|---|---|---|
| `11900000000` | `Igor` — thalissoanh@gmail.com — `1310fb8e-6d1b-454b-9d8e-bf7f1f3ecd4e` | 2025-11-21 |
| `11987654321` | `Marcos Helias` — marcos.helias@gmail.com — `adde7ad0-ea2f-462d-a875-dbae0fc0b624` | 2025-11-21 |

Ou seja: você trocou o telefone, mas trocou por outro número igualmente "de teste" que também já estava lá (há ainda um terceiro, `21900000000`, da Márcia Monteiro, batendo nos mesmos 9 dígitos do primeiro). O e-mail era inédito; **o telefone é que colidiu, nas três tentativas.** A mensagem exata que o banco devolveu foi `duplicate_contact:phone:900000000:1310fb8e-…` (e depois `…:987654321:adde7ad0-…`).

## B. O componente e o `clint_id`

- `src/components/crm/ContactFormDialog.tsx:36-43` monta o payload e chama `createContact.mutateAsync`.
- `clint_id` entra na linha **37**: `` clint_id: `local-${Date.now()}` ``. Não é vazio nem nulo — é `local-<timestamp em ms>`, sintético. Existe porque a coluna veio da sincronização com o Clint e é `NOT NULL`/única; contato criado à mão recebe um identificador próprio com prefixo `local-`. É exatamente esse prefixo que permite medir o item D.
- O insert de verdade está em `src/hooks/useCRMData.ts:322-344` (`useCreateCRMContact`).

## C. Por que o erro não aparece na tela

Duas coisas somadas:

1. **O `onError` existe** — `src/hooks/useCRMData.ts:340-342`: `toast.error(\`Erro ao criar contato: ${error.message}\`)`. O `toast` vem do `sonner` (linha 3) e o `<Sonner />` está montado em `src/App.tsx:179`. Então há um toast previsto, e a mensagem que ele mostraria é o texto cru do banco: `Erro ao criar contato: duplicate_contact:phone:900000000:1310fb8e-...`. Isso é ilegível para o operador — se apareceu e passou, não comunicou nada; **por que você não o viu é o único ponto que ainda não consigo afirmar por leitura de código** (a hipótese honesta é toast curto com texto que não parece erro de negócio). Isso se confirma reproduzindo na tela com o console aberto, e é o primeiro passo se você mandar consertar.
2. **O modal não trata nada.** `ContactFormDialog.tsx:36` faz `await createContact.mutateAsync(...)` **sem `try/catch`**. A promessa rejeita, as linhas 45-46 (limpar campos e fechar) nunca rodam, e o componente **não tem estado de erro nenhum** — nenhuma mensagem inline, nenhum destaque no campo Telefone. Resultado exato do que você viu: modal aberto, campos preenchidos, nada explicado. O `console.log` também não existe aqui — por isso o console ficou limpo.
3. **O tradutor da mensagem existe e não foi usado aqui.** `src/lib/duplicateContactError.ts` converte `duplicate_contact:phone:...` em *"Este telefone já está cadastrado em outro lead: Igor (11900000000)."* — e é usado em `src/components/crm/R2MeetingDetailDrawer.tsx:195` e `src/components/crm/SdrSummaryBlock.tsx:69`, **mas não em `ContactFormDialog` nem em `useCreateCRMContact`.** É a lacuna concreta.

## D. Não está quebrado para todo mundo — e não está quebrado há meses

Contagem por origem do `clint_id` em `crm_contacts`:

| Origem | Contatos | Primeiro | Último |
|---|---|---|---|
| Sincronização Clint (UUID) | 112.952 | 2025-11-19 | 2026-04-24 |
| Outros (webhooks/Hubla/integrações) | 89.545 | 2025-11-26 | **2026-08-25 03:05** |
| Importação de planilha | 1.282 | 2026-03-03 | 2026-08-21 |
| **Manual pela tela (`local-`)** | **562** | 2026-01-20 | **2026-08-24 15:12** |

Manuais nos **últimos 90 dias: 99**. Nos **últimos 7 dias: 13**. O último foi ontem. Conclusão: a tela cria contato normalmente quando o telefone e o e-mail são realmente inéditos. O que quebra em silêncio é **o caso de duplicidade** — e esse caso é frequente numa base com 200 mil contatos e histórico de duplicados.

## E. Como seguir a auditoria agora (sem conserto)

Pela própria tela, funciona: use um telefone inédito de verdade, não `1190000-0000` nem `1198765-4321`. Sugestão de par inédito: nome `ZZ TESTE AUDITORIA FUNIL - NAO USAR`, e-mail `teste.auditoria.funil@exemplo.invalido` (já verificado como inexistente) e telefone com 9 dígitos finais improváveis, por exemplo `11 94422-7731` — se der 409 de novo, o toast/`duplicate_contact:phone:` indica qual contato tomou o número.

Caminhos alternativos que criam o contato sem passar por essa tela:
- **Negócios → novo negócio**: `src/components/crm/DealFormDialog.tsx:224-238` procura contato por e-mail/telefone e cria se não achar, já vinculando o deal — é o caminho mais útil para auditar o funil, porque entrega contato **e** lead num passo. Sujeito ao mesmo trigger, mas com aviso melhor: linha 216 já mostra "Este lead já existe nesta pipeline".
- **Bloco do SDR / drawer da R2** (`SdrSummaryBlock.tsx:54`, `R2MeetingDetailDrawer.tsx:195`): criam contato **com a mensagem amigável de duplicidade** — são hoje os únicos lugares que explicam o 409.
- **Importação de planilha** (`supabase/functions/import-spreadsheet-leads/index.ts`): reaproveita contato existente por e-mail/telefone; bom para volume, exagerado para um lead.

## F. "Falha em silêncio" é caso isolado ou padrão?

O `clint_id` sintético **não é o problema** e aparece em vários lugares legítimos (`useCreatePipeline.ts`, `useBulkCreateDeals.ts:44`, `useLimboLeads.ts:418`, `AddCartaModal.tsx:253`, `OutsideDistributionButton.tsx:133`, `DealFormDialog.tsx:227`, `SdrSummaryBlock.tsx:57`) — todos com valor único por timestamp/prefixo.

O padrão que **é** preocupante é outro: `await mutation.mutateAsync(...)` sem `try/catch` em componentes que dependem do sucesso para fechar/limpar. Há ~20 ocorrências só em `src/components/crm/` (`EditLeadDialog.tsx:75,104`, `MoveToPipelineModal.tsx:85,91`, `BulkTransferDialog.tsx:62`, `CreateTaskDialog.tsx:126,160`, `R2RescheduleModal.tsx:158`, `QuickScheduleModal.tsx:635`, entre outras). Na maioria o hook tem `onError` com toast, então o usuário recebe *algo* — o problema é que o texto é a mensagem crua do Postgres, que para erros de negócio (como este trigger) não diz nada ao operador. Portanto: **não é um botão isolado; é uma lacuna de tradução de erro de negócio no CRM**, com o caso mais visível sendo a duplicidade de contato.

## Se você mandar consertar (fora desta rodada)

1. `ContactFormDialog`: `try/catch`, mensagem inline no campo Telefone/E-mail, e uso de `describeDuplicatePhoneError` (mais um equivalente para e-mail) em vez do texto cru.
2. Oferecer no próprio erro o atalho "abrir o contato existente" com o id que o trigger já devolve.
3. Reproduzir o caso com console aberto para fechar o único ponto não confirmado: se o toast do `onError` está aparecendo e sendo ignorado, ou não está aparecendo.
