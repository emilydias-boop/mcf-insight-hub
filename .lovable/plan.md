# Retrato do que está no ar — parcelas MCF (somente leitura)

Nada foi alterado.

## 1) `ConsorcioCardForm` está consistente — só a grade

Nenhum seletor de modo. `rg "modo_parcelas|Por padrão|Escolher as parcelas"` só encontra um texto solto em `LinkExistingCotaModal.tsx:131` (contexto de filtro de cotas, sem relação).

`ConsorcioCardForm.tsx:1793-1806` — única entrada é a grade:

```tsx
<FormField
  control={form.control}
  name="parcelas_mcf_numeros"
  render={({ field }) => (
    <FormItem>
      <ParcelasMcfPicker value={field.value || []} onChange={field.onChange} />
```

Logo abaixo (`:1807+`), os legados são só leitura, com comentário explícito:

```tsx
{/* Derivados: só leitura — ninguém digita mais tipo nem quantidade. */}
...
{derivadoMcf.parcelas_pagas_empresa} parcela(s), padrão {rotuloTipoContrato(derivadoMcf.tipo_contrato)}
```

`tipo_contrato` / `parcelas_pagas_empresa` seguem no schema Zod (`:136-137`, `optional`) apenas para hidratar registros antigos e alimentar o diff (`:1258-1260`) — não existe `FormField` para nenhum dos dois. O único `Select` que sobrou no bloco é `empresa_paga_parcelas` (sim/não, `:1677`), que é a chave liga/desliga, não desenho de parcela.

`OpenCotaModal.tsx:1304-1311` — mesma grade:

```tsx
<FormField control={form.control} name={'parcelas_mcf_numeros' as any} render={({ field }) => (
  <FormItem>
    <ParcelasMcfPicker value={(field.value as number[]) || []} onChange={field.onChange} disabled={readOnly} />
```

e o "equivale a" (`:1313-1330`) é texto. Também sem input de tipo/quantidade.

`CartasProposalEditor.tsx:606-610` — mesma grade, rótulo de intenção:

```tsx
<ParcelasMcfPicker
  value={c.parcelasMcf}
  onChange={v => patch(c.key, { parcelasMcf: v })}
  label="Parcelas que a MCF paga (intenção)"
/>
```

Conclusão: os três lugares usam o `ParcelasMcfPicker` extraído (`src/components/consorcio/ParcelasMcfPicker.tsx`). Não ficou meio-termo.

## 2) Portas digitáveis que sobraram: nenhuma

`rg 'name="tipo_contrato"|name="parcelas_pagas_empresa"'` em todo `src` → **zero** ocorrências.
`rg "intercalado" src -g '*.tsx'` fora de `ConsorcioCardForm`/`OpenCotaModal` → **zero**; e dentro desses dois só em textos de rótulo/derivação.

Onde os dois campos ainda aparecem, é leitura ou derivação:

- `ConsorcioCardForm.tsx:1118-1121` — grava sempre a partir de `derivarParcelasEmpresa` quando há lista.
- `ConsorcioCardForm.tsx:344-345` — só rótulos do painel de diff.
- `ConsorcioCardForm.tsx:2010` — usa a quantidade como `max` de outro input (parcelas retroativas), não a edita.
- `OpenCotaModal.tsx:83-93` e `:649-652` — payload derivado.
- `ProposalModal.tsx:101-103`, `AddCartaModal.tsx:566-568` — payload derivado da marcação da carta.
- `ViewRegistrationDialog.tsx:189-190`, `DossieCadastroDialog.tsx:416`, `PendingRegistrationsList.tsx:283/694` — exibição.

Único resíduo conceitual: a coluna legada continua sendo escrita (por desenho, para não quebrar leitores antigos), e o "sim/não" de `empresa_paga_parcelas` continua manual. Fora isso, não há porta de digitação.

## 3) Sanidade do banco — bate com o esperado

```
reg_com_lista | cards_com_lista | termos_com_placeholder
6             | 0               | 1
```

Exatamente o previsto: 6 cadastros do Laercio com lista, nenhuma cota com lista própria, e 1 termo com placeholder literal (caso conhecido do Eduardo Batista).

## Veredito

Sem pendência de código nesta frente. Se quiser encerrar de fato, a única decisão aberta é se `empresa_paga_parcelas` deve deixar de ser um Select e passar a derivar de "grade vazia = não" — mudança pequena, mas é mudança de comportamento, então fica para sua palavra.
