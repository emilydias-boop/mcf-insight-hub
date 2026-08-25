# Levantamento — modelo do termo, sessão e conferências

## A) Modelo ativo `d51977ff-0c3e-4b16-a0a7-16b9392371f6` — campo `conteudo` cru

```markdown
# TERMO DE ADESÃO E COMPROMISSO — CONSÓRCIO

Emitido em {{data_emissao}}

## 1. IDENTIFICAÇÃO DO CONSORCIADO

**Nome / Razão Social:** {{cliente_nome}}
**CPF / CNPJ:** {{cliente_documento}}
**Telefone:** {{cliente_telefone}}
**E-mail:** {{cliente_email}}
**Endereço:** {{cliente_endereco}}

## 2. OBJETO DA CONTRATAÇÃO

O consorciado acima identificado declara ter contratado, junto à administradora **{{administradora}}**, cota de consórcio com as seguintes características:

**Produto:** {{produto}}
**Objetivo do crédito:** {{objetivo}}
**Valor do crédito contratado:** {{valor_credito}}
**Prazo:** {{prazo}} meses
**Condição de pagamento:** {{condicao_pagamento}}
**Valor da parcela (1ª à 12ª):** {{parcela_1a_12a}}
**Valor das demais parcelas:** {{parcela_demais}}
**Dia de vencimento:** dia {{dia_vencimento}}
**Tipo de contrato:** {{tipo_contrato}}

## 3. COMPROMISSO DA MCF CAPITAL

A **MCF Capital** assume, de forma irrevogável, o compromisso de efetuar o pagamento de **{{parcelas_mcf_qtd}}** parcelas da cota acima descrita, conforme a tabela abaixo, totalizando **{{parcelas_mcf_total}}**:

{{parcelas_mcf_lista}}

O pagamento será realizado diretamente à administradora, nas datas de vencimento das respectivas parcelas. As demais parcelas do plano são de responsabilidade exclusiva do consorciado.

## 4. DECLARAÇÕES DO CONSORCIADO

O consorciado declara, expressamente, que:

1. Compreende que **consórcio não é investimento nem financiamento**, tratando-se de sistema de autofinanciamento em grupo regido pela Lei 11.795/2008;
2. Compreende que **não há garantia de contemplação** em prazo determinado, ocorrendo a contemplação exclusivamente por sorteio ou lance, conforme regulamento do grupo;
3. Está ciente de que **as parcelas não cobertas pelo compromisso da MCF Capital são de sua inteira responsabilidade**, e que a inadimplência pode implicar exclusão do grupo e demais consequências previstas em contrato;
4. **Leu e concorda** com as condições gerais do contrato de participação em grupo de consórcio da administradora, bem como com os valores, prazos e encargos aqui descritos;
5. Recebeu todas as informações necessárias e as presta de forma livre, consciente e de boa-fé.

## 5. ASSINATURA ELETRÔNICA

Este termo é assinado eletronicamente. A assinatura eletrônica aqui coletada tem validade jurídica nos termos da **Medida Provisória nº 2.200-2/2001** e da **Lei nº 14.063/2020**, ficando registrados nome, documento, data, hora, endereço IP e o resumo criptográfico (hash SHA-256) do conteúdo lido pelo signatário.
```

- **Numeração:** escrita à mão no texto (`## 1.` … `## 5.`, e a lista `1..5` da seção 4). Nada é gerado. Remover a seção 3 exige renumerar 4→3 e 5→4 no próprio texto.
- **Tabela da cláusula:** vem do placeholder `{{parcelas_mcf_lista}}`, montado por `montarTabelaParcelasMcfConsolidada(regs)` — é markdown pronto, separado do texto da cláusula. Quantidade e total vêm de `parcelas_mcf_qtd` / `parcelas_mcf_total` (`src/lib/consorcioTermo.ts`, retorno de `montarDadosTermoMulti`, linhas ~330-333).
- **`renderTermo` (`src/lib/consorcioTermo.ts:338-340`) — função inteira:**

```ts
export function renderTermo(template: string, dados: TermoDados): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => dados[key] ?? `{{${key}}}`);
}
```

  Só substituição. **Não existe bloco condicional, loop, if, nem seção opcional.**
- Placeholder no modelo sem chave em `dados`: o texto literal `{{chave}}` fica impresso no documento. Chave em `dados` que não existe no modelo: simplesmente ignorada (nenhum erro).
- **Snapshot:** confirmado — nenhum caminho re-renderiza termo existente. `renderTermo`/`sha256Hex` só são chamados na criação (`useCreateTermo`) e no preview do editor de modelo; a página pública e a edge function `termo-assinatura` leem `conteudo_renderizado` e `dados_snapshot` do banco (`supabase/functions/termo-assinatura/index.ts:50, 79`). Mudar o modelo **não afeta** termos antigos.
- Termos **assinados** com `parcelas_mcf_qtd = '0'`: **0** (contagem via SELECT).

## B) Sessão expirando

- **Configuração de expiração do projeto Supabase (access token TTL, refresh rotativo):** não determinei. Não é legível por SQL nem está em `supabase/config.toml` (o arquivo só tem `project_id` e blocos `[functions.*]`; não há bloco `[auth]`).
- **Cliente (`src/integrations/supabase/client.ts:19-25`):**

```ts
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

  `brokeredPreviewStorage()` (`src/integrations/supabase/previewAuthStorage.ts`) devolve `localStorage` fora de preview; dentro de preview enquadrado, faz broker por postMessage com o editor.
- **Ocorrências de `signOut` (projeto inteiro):**
  - `src/contexts/AuthContext.tsx:41` — tipo do contexto.
  - `src/contexts/AuthContext.tsx:90` — `checkUserBlockedInBackground`: desloga se `profiles.access_status` = bloqueado/desativado ou `blocked_until` futuro. **Roda a cada `handleSession`** (login, INITIAL_SESSION, restauração de aba).
  - `src/contexts/AuthContext.tsx:279` — dentro do `signIn`, mesma checagem de bloqueio.
  - `src/contexts/AuthContext.tsx:349-366` — `signOut` do contexto (botão sair).
  - `src/contexts/AuthContext.tsx:373` — `handleInactivityLogout` chama `void signOut()`.
  - `src/pages/ResetPassword.tsx:100` — após trocar a senha.
  - `src/components/layout/AppSidebar.tsx:866` — item de menu "Sair".
  - `src/lib/supabase-utils.ts:12` — `resetSupabaseSession()`, que também apaga todas as chaves `sb-*` do localStorage. Chamado em `src/components/auth/ConnectivityCheck.tsx:84` e `src/components/auth/ProtectedRoute.tsx:40` — **ambos só por clique do usuário** ("Limpar sessão e reiniciar", exibido após 8 s de loading).
  - Nenhum `onError`/interceptor de query chama `signOut`.
- **Timer de inatividade: existe.** `src/hooks/useInactivityLogout.ts`, ativado em `AuthContext.tsx:376-381` com `timeoutMs = 3h` e aviso 5 min antes. O timer reinicia com mouse/teclado/scroll/click e sincroniza entre abas via `localStorage['mcf:lastActivity']`. **Não explica logout em menos de uma hora.**
- Suspeitos compatíveis com o sintoma, sem confirmação: (a) `handleSession` com `newSession = null` quando `getSession()` estoura o timeout de 5 s (`AUTH_TIMEOUT_MS`, linha 27) — mas isso zera só o estado React, não a sessão no storage; (b) storage brokerado do preview perdendo a sessão entre superfícies. Qual dos dois ocorreu no seu teste: **não determinei** — precisaria dos logs `[Auth] onAuthStateChange: …` do console na hora da queda.

## C) Conferências

- **`src/lib/duplicateContactError.ts` (arquivo inteiro):** já está em contexto — `describeDuplicatePhoneError(error)` extrai `duplicate_contact:phone:<sufixo>:<uuid>` por regex, **faz um SELECT em `crm_contacts` e devolve frase pronta com nome e telefone do dono** ("Este telefone já está cadastrado em outro lead: X (tel)."), ou a frase genérica se o SELECT falhar; devolve `null` quando o erro não é esse. Só cobre **phone** — o trigger também emite `duplicate_contact:email:…`, que hoje o parser ignora.
- **`ContactFormDialog`:** `handleSubmit` está dentro de `<form onSubmit={handleSubmit}>` (linha 56) e chama `await createContact.mutateAsync(...)` sem `try/catch` (linhas 36-43). A rejeição vira **unhandled promise rejection** no handler do form — não é capturada por nenhum ErrorBoundary (boundary de React não pega erro assíncrono), então o que se perde é o resto do handler: `setFormData` e `onOpenChange(false)` não rodam, o modal fica aberto. O `onError` da mutation (`src/hooks/useCRMData.ts:339-341`) **dispara um toast** `Erro ao criar contato: <message>` — se você não viu nada, o toast provavelmente apareceu e sumiu, ou ficou fora de vista; **não determinei** por que não foi percebido.
- **Espaço para alerta fixo:** sim. O `DialogContent` é `sm:max-w-md` com `<form className="space-y-4">`; cabe um bloco de alerta entre o `DialogHeader` e o primeiro campo, sem mexer em layout.
- O diálogo é usado em **um único lugar**: `src/pages/crm/Contatos.tsx:553`. A mutation `useCreateCRMContact` — verificar outros consumidores ficou fora deste levantamento; se quiser, listo na próxima rodada.

Nada foi editado, nenhuma migração rodada, nenhum dado alterado.
