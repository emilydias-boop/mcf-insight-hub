## Objetivo
Criar um pop-up de gamificação para SDRs que aparece a cada hora mostrando, com visual moderno e motivacional, o progresso da meta diária, semanal e mensal — destacando em vermelho quando há déficit que precisa ser recuperado.

## Escopo desta entrega
Apenas SDRs. Closers ficam para uma fase posterior (mesma arquitetura, basta plugar a fonte de dados de Closer depois).

## Como vai funcionar

### Fonte das metas
- **Meta diária**: `sdr.meta_diaria` (campo já existente por SDR).
- **Meta semanal**: `meta_diaria × dias úteis decorridos da semana até hoje (inclusive)`.
- **Meta mensal**: `meta_diaria × dias úteis do mês` (usando `businessDays.ts` já existente, respeitando a regra de início de semana por BU — Consórcio segunda, demais sábado).

### Fonte dos realizados (agendamentos)
Reaproveitar o hook já consolidado `useSdrMetricsFromAgenda` (mesma fonte do KPI oficial da equipe), filtrado pelo `email` e `squad` do SDR logado, para três janelas:
- Hoje (00:00 → agora)
- Semana corrente (início da semana → agora, conforme BU)
- Mês corrente (dia 1 → agora)

### Lógica de saldo / alerta vermelho
Para cada janela calculamos:
```
esperadoAteAgora = meta_diaria × dias_uteis_decorridos_na_janela
saldo            = realizado − esperadoAteAgora
faltaTotal       = metaTotalDaJanela − realizado
```
- Verde quando `saldo ≥ 0`.
- Amarelo quando `saldo < 0` e ainda dá para recuperar nos dias úteis restantes com ritmo ≤ 1,5× meta diária.
- Vermelho quando o ritmo necessário para fechar a janela passa de 1,5× meta diária (exemplo do usuário: 5/dia, sexta com 10 → precisa 15 no dia → vermelho).

A mensagem no card mostra, em linguagem direta: "Faltam X agendamentos para fechar a semana — você precisa de Y por dia nos N dias úteis restantes."

### Cadência do pop-up
- Aparece **a cada hora cheia** dentro do horário comercial (09:00 → 19:00, dias úteis), apenas para usuários com papel `sdr`.
- Persistência em `localStorage` (`gamification:lastShownAt:<userId>`) para não reabrir ao navegar entre rotas dentro da mesma hora.
- Botão "Fechar" e auto-dismiss em 30s. Tecla `Esc` fecha.
- Não aparece em `/auth`, `/reset-password` e durante chamadas ativas (checa `TwilioContext`).

### Visual
- Dialog grande (max-w-2xl), cantos arredondados, fundo com gradiente sutil usando tokens semânticos do design system (sem cor hardcoded).
- Cabeçalho: avatar/iniciais + "Bora, {nome}!" + badge da BU.
- Três cards lado a lado (Hoje / Semana / Mês), cada um com:
  - Anel de progresso circular (realizado / meta).
  - Número grande do realizado vs meta.
  - Linha de saldo (+N adiantado / −N atrasado) colorida por status.
  - Frase de ritmo necessário quando houver déficit.
- Rodapé com microcopy motivacional dinâmico conforme melhor status (ex.: "Você está adiantado, mantenha o ritmo!" / "Dá pra virar o jogo hoje, foco!").
- Sem emojis aleatórios; ícones do `lucide-react` (Target, TrendingUp, Flame, AlertTriangle).

## Estrutura técnica

### Novos arquivos
- `src/hooks/useSdrGamificationProgress.ts` — calcula diária/semanal/mensal (meta, realizado, esperado, saldo, status, ritmo necessário). Reaproveita `useSdrMetricsFromAgenda` × 3 janelas + `businessDays.ts` + `BUContext`.
- `src/components/gamification/SdrGamificationDialog.tsx` — UI do pop-up (Dialog + 3 GoalCards + footer).
- `src/components/gamification/GoalProgressCard.tsx` — card individual reutilizável (também servirá para Closers depois).
- `src/components/gamification/GamificationScheduler.tsx` — controla quando abrir (timer horário, localStorage, regras de horário comercial/papel/rota).

### Integração
- Montar `<GamificationScheduler />` dentro de `MainLayout.tsx`, ao lado do `<GlobalQualificationModal />`, somente quando `isSDR` for true (já existe a flag no layout).

### Não muda
- Nenhuma migração de banco (usa dados já existentes).
- Nenhuma alteração nas rotas, no Closer, no fluxo de qualificação ou nos hooks de métricas.

## Critérios de aceite
1. SDR logado vê o pop-up no próximo "minuto :00" após login, e depois 1×/hora em horário comercial.
2. Card "Hoje" mostra `realizado / meta_diaria` e fica vermelho se passou de 50% do expediente com menos de 50% da meta.
3. Card "Semana" usa início de semana por BU e vira vermelho no exemplo dado (sexta, meta 5/dia, 10 agendados na semana → precisa 15 hoje).
4. Card "Mês" mostra ritmo diário restante para bater a meta cheia.
5. Fechar o pop-up não o reabre antes da próxima hora cheia.
6. Nenhum hardcoded de cor; tudo via tokens (`bg-card`, `text-destructive`, etc.).
7. Closers e demais papéis não veem nada.
