
# Verificação: por que ainda entram em Viver de Aluguel

## Diagnóstico
- Confirmei que o problema ainda existe e não é só visual.
- Casos auditados:
  - `andreaatelier@gmail.com`: tem compra A010 registrada e deal em `PIPELINE - INSIDE SALES - VIVER DE ALUGUEL`, mas não tem deal em `PIPELINE INSIDE SALES`.
  - `luan.felipe.navarro@gmail.com`: já tem deal em `PIPELINE INSIDE SALES` e mesmo assim também ganhou deal em Viver.
- Isso mostra 2 falhas diferentes:
  1. O fluxo A010 do Make ainda pode falhar ao criar o deal correto no Incorporador.
  2. O fluxo de `Construir Para Alugar` ainda pode abrir deal em Viver mesmo quando o lead já comprou A010.

## Causa raiz encontrada
- `supabase/functions/webhook-make-a010/index.ts` ainda usa:
  - `.upsert(... onConflict: 'contact_id,origin_id')` em `crm_deals`
- Isso repete o mesmo problema do índice único parcial já corrigido no `hubla-webhook-handler`, então algumas compras A010 ficam só na transação e não viram deal no Inside Sales.
- Em `supabase/functions/hubla-webhook-handler/index.ts`, o fluxo `createDealForConsorcioProduct(...)` de `ob_construir_alugar` ainda está frágil:
  - a proteção depende de achar o deal/A010 “na hora”;
  - a checagem não é robusta para corrida entre eventos, contatos duplicados e variação email/telefone;
  - por isso ainda nasce deal em Viver para lead que deveria passar primeiro no Incorporador.

## Plano
1. Corrigir o webhook Make A010
- Em `supabase/functions/webhook-make-a010/index.ts`, trocar o `upsert` do deal por `insert` com fallback para duplicata, igual ao padrão já aplicado no Hubla.
- Objetivo: garantir que a compra A010 sempre gere/atualize primeiro o deal no `PIPELINE INSIDE SALES`.

2. Blindar a regra “A010 passa primeiro no Incorporador”
- Em `supabase/functions/hubla-webhook-handler/index.ts`, reforçar `createDealForConsorcioProduct(...)` para `ob_construir_alugar`:
  - procurar compra A010 e deal de Inside Sales por email e por telefone normalizado/sufixo;
  - olhar todos os contatos equivalentes, não só um registro;
  - se houver A010 confirmado, nunca criar deal em Viver antes de garantir o deal no Inside Sales.
- Regra final:
  - se já existe deal no Inside Sales: só adicionar tag/atividade;
  - se existe compra A010 mas o deal do Inside Sales está faltando: criar/recuperar esse deal primeiro e bloquear Viver.

3. Corrigir os casos recentes já afetados
- Criar migration para:
  - gerar os deals faltantes no `PIPELINE INSIDE SALES` para compradores A010 que ficaram só com Viver;
  - ajustar os deals indevidos de Viver criados no período recente.
- Priorizar os casos já confirmados na auditoria, como `andreaatelier@gmail.com` e `thiagoamorim18@hotmail.com`.

4. Ajustar a leitura no drawer de contato
- Em `src/components/crm/ContactDetailsDrawer.tsx`, parar de usar apenas o deal mais recente como “principal”.
- Quando houver deal de A010/Inside Sales, priorizar ele no drawer.
- Isso evita confusão nos casos em que o contato tem mais de um negócio.

## Arquivos
| Arquivo | Ação |
|---|---|
| `supabase/functions/webhook-make-a010/index.ts` | trocar `upsert` por `insert` com tratamento de duplicata |
| `supabase/functions/hubla-webhook-handler/index.ts` | endurecer o bloqueio de Viver para quem tem A010 e garantir criação/recuperação no Inside Sales |
| `src/components/crm/ContactDetailsDrawer.tsx` | priorizar o deal de Inside Sales/A010 como deal principal |
| `supabase/migrations/*.sql` | backfill/correção dos leads recentes afetados |

## Resultado esperado
- Quem compra A010 entra primeiro na BU Incorporador.
- `Construir Para Alugar` não abre Viver para lead que já é A010.
- Os casos já errados ficam corrigidos no banco.
- A tela passa a refletir o deal certo no CRM.
