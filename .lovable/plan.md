# Discador Sonax no painel comercial — resultado da investigação (Passo 1) e desenho

## Passo 1 — Não existe CDR consultável na API Sonax (confirmado com testes reais)

Testei somente leitura, sem repetir nenhuma discagem, a partir de uma edge function temporária
(o sandbox é bloqueado por Cloudflare; a Supabase não é). A function de sondagem já foi apagada.

Ações testadas contra `api.sonax.net.br/a2billing_v2/admin/Public/dbdial_webapi.php` (a mesma base
que o `sonax-campaign-proxy` usa hoje), com `id_cliente` + `token` válidos:
`relatorio_chamadas`, `relatorio`, `relatorio_analitico`, `cdr`, `detalhe_chamada(s)`,
`historico_chamadas`, `lista_chamadas`, `chamadas_realizadas`, `chamadas_ramal`,
`consulta_chamada`, `status_chamadas`, `lista_ramais`, `status_ramais`, `lista_campanhas`,
`lista_pausa`, `lista_tabulacao`.

Resultado: **todas retornam HTTP 404 (Apache "Not Found")** — inclusive `lista_tabulacao`, que o
código do projeto assume que funciona.

Descobertas colaterais importantes:

1. **O `sonax-campaign-proxy` está apontando para um arquivo que não existe.** O diretório
   `/a2billing_v2/admin/Public/` responde 200 com uma página estática `<h1>Vingadora API</h1>`
   para qualquer querystring, mas `dbdial_webapi.php` (e variações: `api.php`, `webapi.php`,
   `dbdial.php`, `dialer_webapi.php`, host `pabxcloud`, path `a2billing` sem `_v2`) dá 404.
   Isso explica por que `sonax_campaigns` tem 0 linhas: o discador em massa nunca funcionou,
   não é só "nunca usado".
2. **O click-to-call avulso funciona** (`api.sonax.net.br/sonax-click2call.php` com params → HTTP 200
   e corpo de texto), e é o único endpoint Sonax comprovadamente operante hoje.
3. A documentação pública da Sonax confirma o quadro: só publicam o `click2call`; relatórios
   analíticos/CDR existem **apenas na exportação CSV/PDF do painel** `pabxcloud.sonax.net.br`,
   e credenciais de API extra têm de ser pedidas por e-mail ao suporte.
4. Existe, porém, um caminho de **callback**: a "URL de Integração" do painel Sonax, que a Sonax
   dispara para um endpoint nosso a cada evento de chamada, com parâmetros documentados
   `id_chamada`, `ramal`, `numero_cli`, `atendente`, `id_fila`, `tipo`. É o análogo do webhook de
   status que você levantou como alternativa.

### Conclusão do Passo 1
Não há CDR consultável. Logo, o **Passo 2 (polling/cron de enriquecimento) não é implementável**
como desenhado. Os dois caminhos possíveis:

- **A (recomendado, precisa de ação humana):** ativar a "URL de Integração"/webhook no painel Sonax
  apontando para uma edge function nossa, e/ou pedir ao suporte Sonax (`suporte@sonax.net.br`) o
  endpoint correto de relatório analítico + o arquivo certo do webapi do discador. Sem isso, não
  temos atendimento/duração de forma nenhuma.
- **B (dá para fazer já, sem depender de terceiro):** painel só com o que o `deal_activities`
  registra hoje — volume de discagens, leads distintos discados, discagens por lead, taxa de erro
  por ramal (agora confiável, com a detecção corrigida). Sem "efetivas/qualificadas" reais.

## Passo 3 — desenho do painel (executa o B agora, pronto para receber o A)

`src/hooks/useSdrActivityMetrics.ts`
- Trocar a fonte de ligações: sai `calls` (Twilio, `duration_seconds` furado), entra
  `deal_activities` com `activity_type = 'click_to_call'` no mesmo range de datas, lendo
  `metadata.ramal`, `metadata.ok`, `metadata.sonax_status` e (quando existir) `metadata.answered` /
  `metadata.duration_seconds`.
- Métricas por SDR: `discagens` (total), `discagensOk`, `discagensErro`, `taxaErro`, `ramais`
  (lista de ramais usados), `leadsDiscados` (deal_id distintos), `ligPorLead`.
- Efetividade: `atendidas`/`efetivas`/`conexao%`/`qualif%` só são calculadas se houver
  `metadata.answered` na amostra; caso contrário o hook devolve `null` (não 0), e a tabela mostra
  `—` com tooltip "sem dado de atendimento — depende do webhook Sonax", em vez de zerar a coluna.
- Notas/Movimentos/WhatsApp continuam vindo de `deal_activities` como hoje.

`src/components/crm/SdrActivityMetricsTable.tsx`
- Colunas: SDR | Ramal | Discagens | Falhas | Taxa erro | Atendidas | Conexão % | Lig/Lead |
  Leads | Notas | Movimentos | WhatsApp | Detalhes.
- Saem "Ring drop" e "Caixa postal" (eram derivadas do Twilio e não têm equivalente Sonax).
- "Taxa erro" com badge de severidade (verde/amarelo/vermelho) e tooltip listando o motivo
  predominante (`metadata.sonax_body`, ex.: "RAMAL 107 NAO ESTA ATENDENDO"), que é justamente o
  sinal de softphone desregistrado.
- Linha de totais mantida; ordenação passa a ser por `discagens` desc.

`SdrLeadCallsDialog`
- Passa a listar as tentativas de `deal_activities` do lead (data/hora, ramal, ok, corpo cru da
  Sonax truncado) em vez das linhas de `calls`. Mantém o mesmo gatilho e layout.

Sem migration: `deal_activities` já tem tudo em `metadata` (inclusive `sonax_body`, adicionado no
fix de hoje). Se depois ativarmos o webhook (caminho A), ele só precisa gravar `answered` e
`duration_seconds` no mesmo `metadata`, e as colunas de efetividade acendem sozinhas.

## Aviso sobre o histórico
O `deal_activities` só tem `click_to_call` a partir de hoje (10/08) — 23 tentativas. O painel de
ligações vai ficar praticamente vazio para períodos anteriores, e o histórico Twilio da `calls`
deixa de aparecer. Se você quiser manter o passado visível, a alternativa é exibir as duas fontes
lado a lado com rótulo de origem; diga se prefere assim.