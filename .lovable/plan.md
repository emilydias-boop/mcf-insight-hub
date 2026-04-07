

# Fix: SDRs/Closers sem acesso ao Fechamento e Home

## Diagnostico

Existem **dois problemas de vinculacao** que impedem o acesso:

### Problema 1: Tabela `sdr` — 4 registros sem `user_id`
O hook `useOwnFechamento` busca primeiro por `user_id`, depois por `email`. Quando `user_id` e NULL, o fallback por email funciona — mas so se o email do auth coincidir exatamente com o email do `sdr`. Esses 4 nao tem `user_id` vinculado:

| Nome | Email | Profile ID encontrado |
|------|-------|----------------------|
| Alex Dias | alex.dias@minhacasafinanciada.com | 16c5d025-... |
| Julio | julio.caetano@minhacasafinanciada.com | dd76c153-... |
| Thayna | thaynar.tavares@minhacasafinanciada.com | 6bb81a27-... |
| Vitor Costta | vitor.ferreira@minhacasafinanciada.com | 15f3eba4-... |

### Problema 2: Tabela `employees` — registros com `profile_id` mas sem `user_id`
O hook `useMyEmployee` busca por `employees.user_id`, nao por `profile_id`. Exemplo: **Antony Nicolas** tem `profile_id = d77b494c` mas `user_id = NULL` e `email_pessoal = NULL`, entao o hook nao encontra e mostra "cadastro nao vinculado".

## Correcoes

### 1. Migration: vincular `user_id` nos 4 SDRs
UPDATE na tabela `sdr` para preencher `user_id` dos 4 registros usando os profile IDs encontrados.

### 2. Migration: sincronizar `employees.user_id` com `profile_id`
UPDATE em `employees` para copiar `profile_id` para `user_id` onde `user_id IS NULL AND profile_id IS NOT NULL`.

### 3. Codigo: `useMyEmployee` — adicionar fallback por `profile_id`
Apos o fallback por email, adicionar uma terceira tentativa buscando por `profile_id = user.id`. Isso cobre casos futuros onde o employee tem profile_id mas nao user_id nem email.

### Arquivos
| Arquivo | Acao |
|---------|------|
| Migration SQL | Vincular user_id nos 4 SDRs + sincronizar employees |
| `src/hooks/useMyEmployee.ts` | Adicionar fallback por profile_id |

