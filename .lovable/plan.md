## Objetivo
Antes de rodar o backfill, gerar uma lista auditável dos ~30 leads da planilha A010 (Hubla + Kiwify de 16/06) que **não casam por email** mas **casam por telefone** com algum contato existente no CRM, para você decidir linha a linha o que fazer.

## O que vou entregar

### 1. Modo "dry-run detalhado" na edge function `backfill-a010-from-spreadsheets`
Adicionar parâmetro `mode: 'inspect'` que **não escreve nada** e retorna um JSON com 3 buckets:

- `matched_by_email[]` — já confirmados (10 esperados)
- `matched_by_phone_only[]` — os ~30 em discussão, cada linha contendo:
  - `planilha`: `{ source, name, email, phone, sale_date }`
  - `contato_existente`: `{ id, name, email, phone }`
  - `ultimo_deal`: `{ id, pipeline (origin name), stage, owner_email, created_at, tags[], product_name_anterior }`
  - `risco`: `'baixo' | 'medio' | 'alto'` baseado em:
    - baixo → último deal já está em PIPELINE INSIDE SALES e/ou tem tag A010
    - médio → deal em outro pipeline mas sem venda fechada
    - alto → deal em outro pipeline com venda fechada de outro produto
- `no_match[]` — nem email nem telefone batem (criar contato + deal novos)

### 2. Página de revisão `/crm/recuperacao-a010` (somente leitura nesta etapa)
Tabela com os 3 buckets em abas, filtros por `source` (Hubla/Kiwify) e `risco`, e por linha:
- Checkbox "aprovar atualização" (default: marcado se risco=baixo, desmarcado se médio/alto)
- Botão "Ver no CRM" abre o deal/contato em nova aba
- Botão final **"Executar backfill com a seleção"** (desabilitado até você abrir o item)

### 3. Execução posterior (fora desse plano)
Depois que você revisar e clicar em "Executar", chamamos a mesma edge function em `mode: 'apply'` passando o array de decisões `{ planilha_key, action: 'update_existing' | 'create_new' | 'skip' }`. Esta etapa eu só implemento após você revisar a lista.

## Arquivos

**Editar**
- `supabase/functions/backfill-a010-from-spreadsheets/index.ts` — adicionar `mode: 'inspect'`, retornar buckets enriquecidos com último deal/pipeline/tags

**Criar**
- `src/pages/crm/RecuperacaoA010.tsx` — UI de revisão
- `src/hooks/useA010RecoveryInspect.ts` — invoca a função em modo inspect
- Rota em `src/App.tsx` (ou onde estiverem as rotas CRM)

**Fora de escopo agora**
- Execução do `mode: 'apply'` com as decisões (próximo plano, após sua revisão)
- Investigação do webhook Kiwify (plano separado)
- Card no `WebhookIntakeAnalytics`

## Confirmações rápidas
1. Pode ser uma rota nova `/crm/recuperacao-a010` visível só para Admin/Coordenador?
2. Quero incluir já no inspect os 41 (todos) ou só os 30 do bucket "phone-only" (mais leve)?
