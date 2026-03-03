

## Plano: Criar deals para TODOS os leads da planilha que não existem no CRM

### Problema
Atualmente o botão "Criar não encontrados" só envia os leads com `matchStatus === 'not_found'` para a edge function. O usuário quer que **todos** os leads da planilha sejam enviados para criação — a edge function já faz deduplicação por email/telefone e pula os que já existem na pipeline. Assim, qualquer lead que não tenha um deal na pipeline atual será criado com tag `base clint`.

### Mudanças

#### 1. `SpreadsheetCompareDialog.tsx`
- Alterar `handleCreateNotFound` para enviar **todos** os leads da planilha (não só os `not_found`)
- Renomear botão para "Criar leads inexistentes com tag 'base clint'" com contagem do total
- A edge function já faz `check if deal exists for contact + origin` e pula duplicatas

#### 2. `import-spreadsheet-leads/index.ts` (edge function)
- Já possui deduplicação por email → telefone e verifica se deal existe para o contact+origin antes de criar
- Nenhuma mudança necessária — a lógica de skip já funciona corretamente

### Resultado
O botão envia todos os 22.000 leads. A edge function cria apenas os que não existem na pipeline (contato+origin), pulando os que já têm deal. Toast mostra "X criados, Y já existiam".

