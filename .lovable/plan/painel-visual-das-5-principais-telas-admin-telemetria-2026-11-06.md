# Painel visual das 5 principais telas — /admin/telemetria

## O que você vai ver
No topo da página de Telemetria (acima das tabelas, que continuam iguais), um bloco "As 5 telas mais usadas" que respeita o período escolhido (24 h / 7 / 30 dias):

1. **5 cartões, um por tela** (as 5 com mais aberturas no período), cada um com:
   - nome da tela (rota) e número de aberturas + pessoas;
   - tempo típico de abertura com selo de cor: verde (até 1 s), amarelo (1–3 s), vermelho (acima de 3 s);
   - número de erros e "erros a cada 100 aberturas", com selo vermelho quando houver erro;
   - mini-linha diária de aberturas no período.
2. **Gráfico comparativo "Aberturas x Tempo de abertura"**: barras com as aberturas de cada tela e linha com o tempo típico, no mesmo gráfico (dois eixos).
3. **Gráfico "Ocorrências de erro"**: barras horizontais com erros por tela, ordenadas, com a taxa por 100 aberturas ao lado.
4. **Medidores (gauges) de performance**, um por tela: meio-círculo com faixas verde (até 1 s), amarelo (1–3 s) e vermelho (acima de 3 s), ponteiro no tempo típico e, abaixo, o número de erros a cada 100 aberturas. A cor final de cada tela considera o pior entre tempo e erros (erros: verde 0, amarelo até 2 a cada 100, vermelho acima disso).
5. Legenda curta explicando "tempo típico" e as cores.

Telas sem medição de tempo ou sem erros mostram "—" / "0" (nunca inventam valor). Em celular, cartões em coluna.

## Detalhes técnicos
- Só `src/pages/admin/Telemetria.tsx` (e, se ficar grande, um componente novo `src/components/admin/TelemetriaTop5.tsx`). Sem banco, sem RPC nova: reaproveita os registros já carregados de `app_telemetry`.
- Gráficos com `recharts` (já usado no projeto), cores por tokens do tema (primary, destructive, muted), sem cores fixas.
- Tempo típico = mediana (p50) já calculada; erros/100 = erros ÷ aberturas × 100, oculto se aberturas = 0.
- Sem publicação.
