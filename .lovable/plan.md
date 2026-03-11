
Objetivo: corrigir a divisão por carrinho para respeitar o horário de corte (ex.: quarta 12:00), evitando que os mesmos nomes apareçam nos dois carrinhos no dia compartilhado.

Diagnóstico rápido
- Hoje o filtro está apenas por dia (`dateMatchesCarrinho` em `useCarrinhoConfig.ts`), sem usar horário.
- Resultado: em dias marcados nos dois carrinhos (como quarta), ambos mostram os mesmos leads.
- Seu cenário atual no banco confirma isso: quarta está nos dois carrinhos e ambos com corte 12:00.

Plano de implementação

1) Reintroduzir lógica de corte na classificação do carrinho
- Arquivo: `src/hooks/useCarrinhoConfig.ts`
- Criar helper para converter `HH:mm` em minutos.
- Criar helper de classificação única por item, algo como `getCarrinhoForDate(config, scheduledAt)`.
- Regra de negócio (para 2 carrinhos):
  - Se só um carrinho contém o dia: item vai para ele.
  - Se os dois contêm o dia:
    - horário `<= corte` do Carrinho 1 → Carrinho 1
    - horário `> corte` do Carrinho 1 → Carrinho 2
- Atualizar `filterByCarrinho` para usar essa classificação (em vez de “match por carrinho isolado”).
- Efeito: cada reunião cai em apenas um carrinho no dia compartilhado.

2) Ajustar textos da configuração para não gerar ambiguidade
- Arquivo: `src/components/crm/CarrinhoConfigDialog.tsx`
- Trocar o label/descrição para deixar explícito que o campo é funcional:
  - “Horário de corte do carrinho”
  - “Em dias compartilhados, horários após este corte vão para o próximo carrinho.”
- Manter `horario_reuniao` sincronizado internamente (se quiser manter modelo atual), mas sem texto “informativo” que conflita com a regra.

3) Validar integração na tela do Carrinho R2
- Arquivo: `src/pages/crm/R2Carrinho.tsx`
- Manter uso atual de `filterByCarrinho` (já aplicado em agendadas, fora, aprovados, vendas/badge e KPIs derivados).
- Confirmar que ao alternar “Carrinho 1 / Carrinho 2” os dados mudam corretamente por faixa horária.

Resultado esperado no seu exemplo (quarta com corte 12:00)
- Carrinho 1: reuniões de quarta até 12:00.
- Carrinho 2: reuniões de quarta após 12:00.
- Sem duplicação dos mesmos nomes entre os dois carrinhos nesse dia.

Detalhes técnicos (curto)
- Comparação de horário será feita no mesmo `scheduled_at` já usado na UI, garantindo coerência com os horários exibidos.
- Limite adotado: `12:00` pertence ao Carrinho 1; “depois do 12” vai para Carrinho 2.
- Não muda query no Supabase; correção fica no filtro client-side já existente.
