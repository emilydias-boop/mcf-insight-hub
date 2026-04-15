<final-text>## Diagnóstico

O problema não parece ser só visual na tabela final.

Pelo código atual, `useR2CarrinhoData.ts` já tenta respeitar `carrinho_week_start` e excluir encaixes de outra safra. O ponto mais frágil está antes disso, na origem do encaixe:

- `useR2AccumulatedLeads.ts` marca um lead como “Próxima Semana” se qualquer R2 do contato tiver esse status.
- Mas, na hora de devolver o item para a tela, ele usa o **último R2 do contato** (`validR2s[validR2s.length - 1]`), e não necessariamente o **mesmo attendee** que carregava esse status.
- `useEncaixarNoCarrinho.ts` grava `carrinho_week_start` exatamente no `attendeeId` recebido.
- Resultado: em contatos com mais de um R2, o encaixe pode ser salvo no attendee errado. Depois a safra atual puxa esse attendee “errado” normalmente, parecendo que o sistema jogou o lead em qualquer semana.

Do I know what the issue is?  
Sim: o bug provável não é só na renderização final; ele está na **escolha do attendee que recebe o encaixe**, somado ao fato de Carrinho/KPIs fazerem merge por `id` do attendee, e não por lead.

## Plano

### 1. Corrigir qual attendee recebe o encaixe
**Arquivo:** `src/hooks/useR2AccumulatedLeads.ts`

- Incluir `carrinho_week_start` no select dos R2s.
- Quando houver “Próxima Semana”, escolher como alvo:
  1. o attendee que realmente tem `r2_status_id = Próxima Semana`, ou
  2. se já existir override, o attendee com `carrinho_week_start` preenchido,
  3. só depois usar fallback para o mais recente.
- Parar de usar automaticamente o último R2 do contato para o botão “Encaixar”.

### 2. Garantir um único encaixe ativo por lead
**Arquivo:** `src/hooks/useEncaixarNoCarrinho.ts`

- Antes de setar o novo `carrinho_week_start`, limpar overrides de outros attendees do mesmo lead (mesmo `deal_id`, com fallback por `contact_id`).
- Depois aplicar o `carrinho_week_start` apenas no attendee correto.
- Manter o ajuste de `r2_status_id = Aprovado`.

### 3. Blindar listagem e KPIs
**Arquivos:** `src/hooks/useR2CarrinhoData.ts`, `src/hooks/useR2CarrinhoKPIs.ts`

- Continuar excluindo rows cujo `carrinho_week_start` pertence a outra safra.
- Trocar o merge/dedupe para priorizar o **lead** (`deal_id`, fallback `contact_id`) e não apenas `attendee.id`.
- Priorizar sempre o attendee cujo `carrinho_week_start` bate com a safra atual.

### 4. Tratar dados já contaminados
- Se os registros do print já estiverem gravados com `carrinho_week_start` errado, faço uma limpeza pontual desses overrides durante a implementação, para alinhar o histórico com a regra nova.

## Resultado esperado

Depois desse ajuste:

- se o lead foi encaixado na safra X, ele aparece só na safra X;
- se o contato tiver vários R2s, o sistema usa apenas o attendee correto daquele encaixe;
- o badge “Encaixado” continua, mas agora refletindo um vínculo consistente de verdade.</final-text>