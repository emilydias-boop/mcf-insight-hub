

## Diagnóstico final: vendas de parceria não casam com aprovados

### A causa raiz

A janela `aprovados` (em `getCarrinhoMetricBoundaries`) é **Sex 12:00 → Sex 12:00**. Mas a safra é **Qui 00:00 → Qua 23:59**. Isso joga muitos R2s aprovados para a semana errada:

Na safra **09/04-15/04** (carrinho da Sex 10/04), os R2s aprovados que deveriam pertencer:
- Sarah Coelho — R2 Qui **09/04 17:00 BRT** → fora (antes de Sex 12:00)
- Heloiza Helena — R2 Sex **10/04 10:00 BRT** → fora (antes do corte 12:00)
- Uislaine Fuzzo — R2 Sex **10/04 07:00 BRT** → fora
- Maria Tatiana — R2 antigo (**10/03**) → fora (correto)
- Lucas Fonseca — R2 **jan/26** → fora (correto)

Vendas dessas pessoas em 10-16/04 caem como **órfãs** porque o "Aprovado" está em outra janela. Por isso só aparecem **3-4 vendas no print** ao invés de 25+.

E ainda: vendas pós-corte (Wellington, Marcia, Valdinei vendendo 17/04 13-14h BRT) ficam fora da janela `vendasParceria` (que vai até Sex 11:59).

### As 2 mudanças necessárias

#### Mudança 1 — Janela `aprovados` = janela completa da safra
Hoje: `Sex 10/04 12:00 → Sex 17/04 12:00` (7 dias deslocados).  
**Proposta**: `Qui 09/04 00:00 → Sex 17/04 12:00` (safra inteira + carry over até o corte da semana seguinte).

Isso captura:
- R2s de Qui/Sex de manhã (Sarah, Heloiza, Uislaine) → entram corretamente
- R2s de Qua à noite (Wellington, Marcia, Valdinei feitos na sex 17 manhã) → continuam entrando
- R2s da próxima sex pós-corte → ficam para a próxima safra (correto)

#### Mudança 2 — Janela `vendasParceria` = casar com `aprovados`
Hoje: `Sex 10/04 00:00 → Sex 17/04 11:59`.  
**Proposta**: `Qui 09/04 00:00 → Sex 17/04 11:59` (alinhar início com a safra, manter fim no corte).

Vendas que acontecem **dentro da safra** (Qui-Qua) também são contabilizadas, não só as Sex+. Isso é importante porque vendas de incorporador (que não dependem só de R2 da semana) podem rolar Qui-Sex.

### Por que faz sentido operacionalmente

A memória `carrinho-safra-operational-logic-v6` define a safra como **Qui→Qua**. O corte de Sex 12:00 só serve para **fechar** a safra (cortar o que entra na próxima). Não faz sentido **excluir** o que aconteceu DENTRO da safra (Qui inteiro, Sex de manhã).

A janela Sex→Sex foi um erro de modelagem: confundiu "corte que fecha" com "corte que abre". O ciclo correto é:
```
Safra ativa: [Qui 00:00 ──────────────── Qua 23:59] + [Qui-Sex_corte da próxima semana para terminar processamento]
                                                      ↑
                                         carry-over para Aprovados/Vendas
```

### Resultado esperado

- **Aprovados** sobe de ~45 para ~55-65 (incluindo Heloiza, Uislaine, Sarah, etc.)
- **Vendas de Parceria** sobe de **4** para **20-25+** (todos os matches do dia 10-17 antes do corte)
- Conversão `vendas/aprovados` fica realista
- "Vendas Sem Vínculo" cai porque a maioria vai casar

### Arquivo a alterar

- `src/lib/carrinhoWeekBoundaries.ts` — em `getCarrinhoMetricBoundaries`:
  - `aprovados.start = thuStart` (Qui 00:00 da safra)
  - `aprovados.end = nextFridayCutoff` (Sex 12:00 da semana seguinte) — mantém
  - `r2Meetings.start = thuStart` (mesma coisa)
  - `vendasParceria.start = thuStart` (Qui 00:00, não Sex)
  - `vendasParceria.end` mantém

### Risco / efeito colateral

- A aba "R2 Agendadas" e "R2 Realizadas" (que usam `r2Meetings`) também vão incluir Qui/Sex-manhã. Isso é o comportamento correto — esses são leads dessa safra.
- O número de "R2 Agendadas" (65 no print) vai subir um pouco. Se isso estiver ok, vamos em frente. Se quiser que `r2Meetings` continue Sex→Sex e só `aprovados`+`vendasParceria` mudem, é trivial.

