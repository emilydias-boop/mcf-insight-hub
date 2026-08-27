# Prova de ponta a ponta — cláusula 3 do termo do Laercio

Nada foi alterado nesta rodada.

## Q1 — o caminho multi NÃO reimplementa a lista

`src/lib/consorcioTermo.ts:382` (dentro de `montarDadosTermoMulti`) e `:420`:

```ts
const mcf = montarTabelaParcelasMcfConsolidada(regs);
...
clausula_mcf: montarClausulaMcf(mcf.qtd, mcf.total, mcf.tabela),
parcelas_mcf_qtd: String(mcf.qtd),
parcelas_mcf_total: formatCurrency(mcf.total),
```

`montarTabelaParcelasMcfConsolidada` (`:334-357`) é quem monta CARTA / PARCELA / VENCIMENTO / VALOR / RESPONSÁVEL e o total:

```ts
const itens = regs.flatMap((reg, i) =>
  parcelasMcfComValoresDigitados(reg).map(p => ({
    carta: rotulo(reg, i),
    numero: p.numero,
    valor: p.valor,
    venc: Number(reg.dia_vencimento) ? `dia ${Number(reg.dia_vencimento)}` : 'A definir',
  })),
);
const total = itens.reduce((s, p) => s + p.valor, 0);
```

Ou seja: chama `parcelasMcfComValoresDigitados(reg)` **por cadastro**, e essa função (`:105-112`) repassa `parcelas_numeros: reg.parcelas_mcf_numeros ?? null` para `getParcelasEmpresa`. **Não há reimplementação da lista no caminho multi.**

## Q2 — simulação com os dados atuais (resultado cru)

```
qtd_parcelas | total
24           | 10650.00
```

Bate exatamente com o esperado: **24 parcelas, R$ 10.650,00**. O dado está pronto.

Prova adicional rodando o **próprio código** (`montarDadosTermoMulti` com os 6 cadastros como estão hoje, execução só em memória):

```
qtd: 24 total: R$ 10.650,00
| Carta | Parcela | Vencimento | Valor | Responsável |
| Carta 1 · R$ 150.000,00 | 2ª | A definir | R$ 443,75 | MCF Capital |
| Carta 1 · R$ 150.000,00 | 3ª | A definir | R$ 443,75 | MCF Capital |
| Carta 1 · R$ 150.000,00 | 5ª | A definir | R$ 443,75 | MCF Capital |
| Carta 1 · R$ 150.000,00 | 7ª | A definir | R$ 443,75 | MCF Capital |
```

## Q3 — não existe segundo caminho para o total da MCF

Todas as ocorrências em `consorcioTermo.ts` que produzem cláusula 3 / total:

```
105: parcelasMcfComValoresDigitados  (única ponte para getParcelasEmpresa, :106)
204: montarDadosTermo         → parcelas = parcelasMcfComValoresDigitados(reg)
236: clausula_mcf             → montarClausulaMcf(parcelas.length, total, lista)
344: montarTabelaParcelasMcfConsolidada → parcelasMcfComValoresDigitados(reg)
382/420: montarDadosTermoMulti → mcf.qtd / mcf.total / mcf.tabela
```

`getParcelasEmpresa` é importado **uma única vez** (`:2`) e chamado **um único lugar** (`:106`), sempre com `parcelas_numeros`. Nenhum ponto soma `parcelas_pagas_empresa × valor`. Não há onde o 28.650 ser recalculado hoje.

## Q4 — preview e conteúdo gravado são o MESMO objeto

`GerarTermoModal.tsx`:

```ts
const dados   = useMemo(() => (regs.length ? montarDadosTermoMulti(regs as any[]) : null), [regs]);
const preview = useMemo(() => (modelo && dados ? renderTermo(modelo.conteudo, dados) : ''), [modelo, dados]);
...
await createTermo.mutateAsync({ ..., dados, conteudoRenderizado: preview });
```

Uma só função (`montarDadosTermoMulti`) alimenta o preview e o `conteudo_renderizado`. Não são caminhos diferentes.

## De onde vem, então, o 1,2,3,4 / R$ 28.650,00 que o dono viu

Só sobram duas origens, e ambas são de tempo, não de lógica:

1. **Snapshot antigo.** Os dois únicos termos do Laercio foram gerados às 15:32 e 15:56 (ambos `cancelado`), antes da propagação de 16:06. O texto 1,2,3,4 / 28.650 está congelado no `dados_snapshot`. Se o dono abriu o link público ou o card do termo, é isso que ele vê — e vai continuar vendo para sempre.
2. **Build publicado desatualizado.** O suporte a `parcelas_numeros` e a propagação entraram no código às ~15:54-16:18. O dono acessa `mcfgestao.com` (publicado). Enquanto não houver publish, o preview dele roda a versão anterior, que deriva `normal` + `4` → 1,2,3,4 → R$ 28.650,00 — exatamente o número da foto, inclusive com o dado já corrigido no banco.

Nenhuma dessas duas causas é corrigível por mudança de código: a primeira exige gerar um termo novo, a segunda exige publicar.

## Próximo passo sugerido (sem código)

1. Publicar a versão atual.
2. No `Pós-Reunião` do Laercio, gerar um termo novo (o antigo está cancelado) e conferir: deve sair 24 parcelas, 2ª/3ª/5ª/7ª por carta, total R$ 10.650,00.
3. Se, **depois de publicar**, o preview ainda mostrar 28.650, aí sim existe defeito vivo — e eu instrumento o caminho com evidência de tela.

---

### Respostas em 3 linhas

(a) Sim — a simulação deu **24 parcelas / R$ 10.650,00**, tanto em SQL quanto rodando o próprio `montarDadosTermoMulti`.
(b) O caminho multi **passa a lista** — `montarTabelaParcelasMcfConsolidada` chama `parcelasMcfComValoresDigitados(reg)` por cadastro, que repassa `parcelas_mcf_numeros`.
(c) **Nenhuma linha precisa mudar.** O 28.650 vem de snapshot antigo (termos de 15:32/15:56, cancelados) e/ou do build publicado antes da correção — a ação é publicar e gerar o termo novamente.
