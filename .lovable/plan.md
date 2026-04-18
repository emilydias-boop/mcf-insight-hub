

## Diagnóstico: Por que as vendas do dia 17/04 não aparecem e a semana padrão está errada

### Os dois problemas são da mesma raiz: **a definição de "semana atual"**

#### Problema 1 — Vendas do 17/04 não sobem na safra 09/04-15/04

A janela de "Vendas Parceria" (em `getCarrinhoMetricBoundaries`, linhas 109-111 de `carrinhoWeekBoundaries.ts`) é fixa e curta:

```
Vendas Parceria = Sex do carrinho 00:00 → Seg 23:59:59 (4 dias)
```

Para a safra **09/04-15/04** (Qui-Qua), a sexta do carrinho é **10/04**. Então a janela de vendas é:
- **Sex 10/04 00:00 → Seg 13/04 23:59**

**As vendas do 17/04 (sexta) caem FORA dessa janela** — elas pertencem ao próximo ciclo de carrinho. Por isso não aparecem.

Confirmei via SQL: existem **dezenas de vendas de parceria em 17/04/2026** (Claudio, Evano, Dyego, Saulo, João Pedro, etc.) que estão "esperando" mas o carrinho 09-15 não enxerga porque já fechou a janela em 13/04.

#### Problema 2 — Sempre precisa voltar para ver "a semana atual"

A página inicia com `weekDate = new Date()` (= hoje, sexta 17/04). O `getCartWeekStart(17/04)` retorna **Qui 16/04** (a quinta mais recente), mostrando a safra **16/04-22/04** — que é a safra "em construção".

Mas operacionalmente, na sexta-feira **antes do corte (12:00)** e **até segunda à noite**, o usuário ainda está finalizando o carrinho da semana **anterior** (vendas pós-aprovação rolam até segunda). Por isso ele sempre clica "voltar" para ver 09-15.

### Por que isso quebra: a "semana operacional" ≠ "semana de safra"

A memória `carrinho-safra-operational-logic-v6` define que o ciclo do carrinho é uma janela **contínua entre cortes** (Sex 12:00 → Sex 12:00). A página, porém, navega por **safras Qui-Qua** (`getCartWeekStart` ancora em quinta), o que não bate com o momento em que o usuário está operando.

### Solução proposta

#### Mudança 1 — Inicializar `weekDate` na "safra ativa" (não na safra futura)
Em `R2Carrinho.tsx`, linha 34:
```ts
const [weekDate, setWeekDate] = useState(getActiveCartReferenceDate(new Date()));
```

Nova função `getActiveCartReferenceDate(now)` em `carrinhoWeekBoundaries.ts`:
- Se `now` está entre **Qui 00:00** e **Sex antes do corte (12:00)** → safra atual = a que **termina** nessa quarta (a "em construção"). Mostrar como hoje.
- Se `now` está entre **Sex pós-corte** e **próxima Qua 23:59** → operação ativa é a safra que **acabou de fechar** (Qui anterior - Qua dessa semana). Usar uma data dentro dela como referência para `getCartWeekStart`.

Resultado: na sexta 17/04 às 21h, a página abre direto em **09/04-15/04** sem precisar clicar "voltar".

#### Mudança 2 — Estender a janela de "Vendas Parceria"
Em `getCarrinhoMetricBoundaries`, mudar `vendasParceria` de "Sex→Seg" para **"Sex do carrinho 00:00 → próxima Sex no corte (12:00)"** (Sex→Sex, 7 dias).

Antes: `Sex 10/04 00:00 → Seg 13/04 23:59`  
Depois: `Sex 10/04 00:00 → Sex 17/04 11:59:59`

Isso captura **todas as vendas geradas pelo trabalho de aprovação dessa safra**, incluindo as de quinta e sexta de manhã da semana seguinte. Vendas do 17/04 após o corte continuam pertencendo ao próximo ciclo (correto).

#### Mudança 3 — Atualizar o label informativo
O texto "Safra: Contratos de DD/MM a DD/MM" continua. Adicionar abaixo um sub-label indicando a janela de vendas:
```
Vendas: 10/04 00:00 → 17/04 12:00
```
Para o usuário entender o que está dentro/fora da contagem.

#### Mudança 4 — (Opcional) Botão "Carrinho ativo agora"
Diferente do "Hoje" (que pula para a safra futura), um botão que sempre traz para a safra operacionalmente ativa. Pode substituir o "Hoje" para evitar confusão.

### Arquivos a alterar

- `src/lib/carrinhoWeekBoundaries.ts` — adicionar `getActiveCartReferenceDate()`; estender `vendasParceria` para Sex→Sex(corte).
- `src/pages/crm/R2Carrinho.tsx` — usar a nova função no `useState` inicial; ajustar label do "Hoje".
- (Opcional) `src/components/crm/R2VendasList.tsx` — exibir o sub-label da janela de vendas no header.

### Resultado esperado

- **Vendas do 17/04** passam a aparecer no carrinho 09-15 (até as 12:00 do 17/04).
- **Vendas do 17/04 pós-corte (12:01+)** ficam no próximo carrinho (16-22), como deve ser.
- **Página abre direto** na safra ativa correta sem precisar clicar "voltar".
- O número "3 vendas" do print deve subir significativamente (vimos ~25+ vendas no 17/04 só na consulta SQL).

### Nota sobre regras de negócio

A memória `carrinho-safra-operational-logic-v6` já documenta esse comportamento operacional. A janela atual de Sex→Seg parece ter sido um valor inicial conservador; estendê-la para o ciclo completo Sex→Sex(corte) está alinhado com a regra escrita.

