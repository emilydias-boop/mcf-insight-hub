

# Desativar Integração Clint CRM

## Contexto
As queries confirmaram que leads chegam via Hubla webhook direto, e o Clint está gerando duplicatas por race condition. Vamos desativar a integração sem deletar codigo -- apenas early returns, botoes desabilitados e comentarios.

## Alteracoes

### 1. `supabase/functions/clint-webhook-handler/index.ts`
- Adicionar early return logo apos o CORS check (linha 38), antes de qualquer processamento
- O retorno sera `{ received: true, processing: false, reason: 'clint_integration_disabled' }` com status 200
- Todo o restante do codigo permanece intacto

### 2. `src/components/crm/CronJobSetup.tsx`
- Comentar os blocos SQL de agendamento (`scheduleSQL` e `unscheduleSQL`) 
- Adicionar comentario `// DESATIVADO 05/04/2026 - Clint integracao encerrada`
- Exibir um Alert informando que a integracao foi encerrada, em vez dos SQLs de cron

### 3. `src/components/crm/SyncControls.tsx`
- Desabilitar todos os 4 botoes de sync (Importar Contatos, Importar Deals, Vincular Contatos, Sync Manual) com `disabled={true}`
- Adicionar tooltip "Integracao Clint encerrada" em cada botao
- Alterar titulo do card para indicar status desativado
- Adicionar banner visual de "integracao encerrada"

### 4. Banco de dados
- Nenhuma alteracao -- `clint_id` permanece como referencia historica

## Arquivos alterados
1. `supabase/functions/clint-webhook-handler/index.ts` -- early return
2. `src/components/crm/CronJobSetup.tsx` -- UI desativada + comentario
3. `src/components/crm/SyncControls.tsx` -- botoes desabilitados + tooltip

## Complexidade
Baixa -- apenas adicionando guards e desabilitando UI, sem reestruturacao.

