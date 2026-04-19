

## Diagnóstico final (com dados batendo)

Rodei a RPC com `p_apply_contract_cutoff = true` para a safra Qui 09/04 → Qua 15/04. Resultado:
- Aprovado dentro do corte: **49** (deveria ser 44)
- Aprovado fora do corte: **10**
- Excedente: **12 leads que sobram, 7 que precisam virar**

Cruzando os 49 contra a lista verdadeira de 44, os 12 intrusos são:

| Lead | Contrato | R2 |
|---|---|---|
| Alexandre Bonetto | 07/04 | 09/04 15:00 |
| Alexandre DaLuz | 08/04 | 09/04 19:00 |
| Douglas Diego Dias | 07/04 | 09/04 19:00 |
| Flávia Avelar | 08/04 | 09/04 15:00 |
| Gustavo de Almeida | 09/04 manhã | 10/04 09:00 |
| Helder Correa | 08/04 | 09/04 16:00 |
| Heloiza Helena | 08/04 | 10/04 10:00 |
| Jaziel Alencar | 09/04 manhã | 09/04 20:00 |
| Márcio Barros | 06/04 (encaixado) | 10/04 19:00 |
| Sarah Coelho | 08/04 | 09/04 17:00 |
| Thiago Grossi | 08/04 | 10/04 10:00 |
| Willian Chaves | 26/03 | 09/04 16:00 |

### Padrão real

Todos têm R2 entre **Qui 09/04 00:00 e Sex 10/04 12:00** com contrato **anterior a 10/04 12:00**. Esses leads pertencem operacionalmente à **safra anterior** (02/04 → 08/04, carrinho do dia 10/04), não à atual.

Causa raiz: a janela `p_window_start` está em Qui 00:00 do `weekStart`, mas o corte real da safra anterior só fecha **Sex 10/04 12:00**. A RPC deveria considerar que o início real da janela operacional da safra atual é **a sexta da semana anterior no horário de corte** (Sex 10/04 12:00), não Qui 09/04 00:00.

Hoje a regra de `dentro_corte` faz `>= p_window_start`, que é Qui 00:00 — janela que se sobrepõe com o "rabo" da safra anterior.

## O que ajustar

### 1. RPC `get_carrinho_r2_attendees`
Adicionar parâmetro `p_previous_cutoff timestamptz` (Sex anterior no corte = `p_window_start` real da safra). Lógica de `dentro_corte` passa a exigir:

```text
contrato pago em [p_previous_cutoff, p_window_end)
  OU
(contrato pago < p_previous_cutoff AND scheduled_at >= p_previous_cutoff
 AND scheduled_at < p_window_end AND parceria_first_at NULL/futura)
```

Em vez do atual `>= p_window_start` (Qui 00:00), passa a ser `>= p_previous_cutoff` (Sex anterior 12:00). Isso elimina o sobreposto Qui→Sex manhã.

### 2. `src/lib/carrinhoWeekBoundaries.ts`
Adicionar campo `previousCutoff` no `getCarrinhoMetricBoundaries`:
- `previousCutoff = Sex da semana anterior no horário_corte` (já é o `currentFridayCutoff` atual, que aliás está nomeado errado).

### 3. `src/hooks/useCarrinhoUnifiedData.ts`
Passar `p_previous_cutoff: boundaries.previousCutoff.toISOString()` na chamada da RPC.

### 4. Encaixados (Márcio Barros)
`is_encaixado = true` continua sendo override manual e entra como aprovado dentro do corte — está correto manter. Se não estiver na sua lista de 44, é porque o usuário precisa remover o encaixe pra ele. Não mexo na regra de encaixe.

### Validação esperada após o ajuste

- Aprovado dentro do corte: **44** (ou 45 se Márcio Barros encaixado for legítimo)
- Aprovado fora do corte: **22** (os 10 atuais + 12 intrusos que migram)
- Demais cards (Pendente, No-show, Reembolso, Total Pagos) **não** mudam, porque a regra só afeta `dentro_corte`, que só é consumida por filtros de "aprovado da safra".

### Escopo

- 1 migration na RPC
- 1 ajuste em `carrinhoWeekBoundaries.ts`
- 1 ajuste em `useCarrinhoUnifiedData.ts`

Sem mexer em painel, hook de relatório, nem componente — eles já leem `dentro_corte` corretamente.

