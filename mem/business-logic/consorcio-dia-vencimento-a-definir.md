---
name: Dia de vencimento da cota "A definir"
description: dia_vencimento da cota é opcional na abertura (definido pela Embracon depois); sem ele o cronograma de parcelas não é gerado e nasce quando o dia chega
type: feature
---
`consortium_cards.dia_vencimento` é **nulo permitido** = "A definir". Quem define é a Embracon depois da abertura (tende a ser 10, 15 ou 20; se cair em fim de semana/feriado, próximo dia útil).

- `OpenCotaModal`: campo opcional, placeholder "A definir", texto de apoio explicando a regra. Nunca gravar 0/1 fake.
- **Cronograma**: sem o dia, `consortium_installments` NÃO é gerado (data seria inventada). É gerado depois por `gerarCronogramaSeFaltando(cardId)` em `src/lib/consorcioCronograma.ts`, chamado por `useUpdateConsorcioCard` (quando o dia é preenchido) e por `useConvertReservaToContratacao`.
- `ConfirmarContratacaoModal` exige o dia (1–31) — é o retorno da Embracon; a conversão grava o dia e recalcula/gera as parcelas.
- UI (cota, drawer, cronograma, Termo de Adesão, Relatório do Lead) mostra **"A definir"**, nunca vazio/0.
- Limpeza histórica: 15 cadastros com `dia_vencimento = 101520` foram zerados; backup em `public.bkp_dia_vencimento_20260821`.
