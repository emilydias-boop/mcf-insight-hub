# Mapa — lista de parcelas escolhidas no cadastro manual de cota

Somente leitura. Nenhum arquivo de código foi tocado.

## 1) Como o formulário manual pergunta hoje

`src/components/consorcio/ConsorcioCardForm.tsx` — não existe seletor de números. São três campos: um radio `empresa_paga_parcelas` (sim/não), um select `tipo_contrato` e um input numérico de quantidade.

Schema (linhas 129-130):

```ts
tipo_contrato: z.enum(['normal', 'intercalado', 'intercalado_impar']).optional(),
parcelas_pagas_empresa: z.number().min(0).optional(),
```

UI (linhas 1684-1730):

```tsx
{empresaPagaParcelas === 'sim' && (
  ...
  <FormField name="tipo_contrato" ... >
    <SelectItem value="normal">Normal (primeiras parcelas)</SelectItem>
    <SelectItem value="intercalado">Intercalado (parcelas pares)</SelectItem>
    <SelectItem value="intercalado_impar">Intercalado (parcelas ímpares)</SelectItem>
  ...
  <FormField name="parcelas_pagas_empresa" ... >
    <Input type="number" min={0}
      max={tipoContrato === 'intercalado' ? Math.floor(prazoMeses / 2) : prazoMeses}
```

Texto de apoio derivado da quantidade (linhas 1737-1740):

```tsx
{tipoContrato === 'intercalado'
  ? `Intercalado: empresa paga as parcelas 2, 4, 6...${parcelasPagasEmpresa * 2} (${parcelasPagasEmpresa} parcelas pares)`
  : `Normal: empresa paga as primeiras ${parcelasPagasEmpresa} parcelas`}
```

Ou seja: hoje a tela manual só sabe **quantas** e **em que padrão**, nunca **quais**.

O payload de save (linhas 1050-1061) grava exatamente isso, e não envia `parcelas_mcf_numeros`:

```ts
const calculatedParcelas = data.empresa_paga_parcelas === 'sim' ? (data.parcelas_pagas_empresa || 0) : 0;
...
tipo_contrato: data.empresa_paga_parcelas === 'sim' ? (data.tipo_contrato || 'normal') : 'normal',
parcelas_pagas_empresa: calculatedParcelas,
```

Há também um efeito que sobrescreve a quantidade quando o tipo vira `intercalado` — só para cota nova (linhas 947-955):

```ts
if (card) return;
if (tipoContrato === 'intercalado' && prazoMeses > 0) {
  const parcelasPares = Math.floor(prazoMeses / 2);
  form.setValue('parcelas_pagas_empresa', parcelasPares);
}
```

## 2) O componente do seletor de números

Está **embutido** no editor de cartas, sem componente próprio: `src/components/consorcio/CartasProposalEditor.tsx:606-653`.

```tsx
<Label className="text-xs">Parcelas que a MCF paga (intenção)</Label>
<span className="text-xs font-medium">MCF paga {c.parcelasMcf.length} de {PARCELAS_MARCAVEIS}</span>
...
{Array.from({ length: PARCELAS_MARCAVEIS }, (_, k) => k + 1).map(n => {
  const mcf = c.parcelasMcf.includes(n);
  return (
    <Button ... variant={mcf ? 'default' : 'outline'} aria-pressed={mcf}
      onClick={() => patch(c.key, {
        parcelasMcf: mcf ? c.parcelasMcf.filter(p => p !== n)
                         : [...c.parcelasMcf, n].sort((a, b) => a - b),
      })}
    >{n}</Button>
  );
})}
```

`PARCELAS_MARCAVEIS = 12` vive em `src/types/consorcioCartas.ts:68`.

O que precisaria ser extraído para reuso: um componente controlado puro (`value: number[]`, `onChange`, `max`) contendo a grade de botões + o rótulo "MCF paga N de M" + a linha "Selecionadas: 2, 3, 5, 7". A lógica de toggle depende só de `value`/`onChange`; o acoplamento atual é apenas ao `patch(c.key, …)` do editor.

## 3) Criar × editar

O mesmo componente serve para os dois, e também para duplicar:

- `src/components/consorcio/CotasTab.tsx:1106-1118` — `card={editingCard}` e `duplicateFrom={duplicatingCard}`; com `editingCard = null` é criação.
- `src/components/consorcio/ConsorcioCardDrawer.tsx:893` — `<ConsorcioCardForm open={editFormOpen} ... card={card} />` (edição a partir do drawer da cota).

Ao abrir cota existente, a hidratação (linhas 462-464) carrega:

```ts
empresa_paga_parcelas: (card.parcelas_pagas_empresa > 0 ? 'sim' : 'nao'),
tipo_contrato: card.tipo_contrato as ...,
parcelas_pagas_empresa: card.parcelas_pagas_empresa,
```

Nada de `parcelas_mcf_numeros` — a lista exata não é lida nem exibida aqui hoje.

Submit bifurca em `ConsorcioCardForm.tsx:1235` (`updateCard.mutateAsync({ id: card.id, ...alterado })`, só campos alterados) e `:1240` (`createCard.mutateAsync(input)`).

## 4) Cronograma de cota que já existe

Salvar edição **não** regenera `consortium_installments`. O único gatilho no update é `gerarCronogramaSeFaltando`, e ele é idempotente por contagem.

`src/hooks/useConsorcio.ts:583-586`:

```ts
// 2.1 Dia de vencimento acabou de ser informado ("A definir" → dia real):
if (cardData.dia_vencimento) {
  await gerarCronogramaSeFaltando(id);
}
```

`src/lib/consorcioCronograma.ts:166-171` — a trava:

```ts
const { count, error: countErr } = await supabase
  .from('consortium_installments')
  .select('id', { count: 'exact', head: true })
  .eq('card_id', cardId);
if (countErr) throw countErr;
if ((count || 0) > 0) return 0;
```

Também retorna 0 sem `dia_vencimento`/`prazo_meses`/`valor_credito` (`:164`) e sem data base (`:175`).

Conclusão: abrir e salvar cota antiga **não** reescreve cronograma já gerado. O único efeito sobre parcelas existentes no update é recálculo de comissão quando `tipo_produto` ou `valor_credito` mudam (`useConsorcio.ts:596-608`) — atualiza somente `valor_comissao`, nunca quem paga nem datas nem valores.

Consequência direta para a sua decisão: se a lista de números entrar na tela manual, em cota já cadastrada ela **não** se propaga sozinha para o cronograma existente — vira apenas dado gravado em `consortium_cards.parcelas_mcf_numeros`. Fazer o cronograma refletir a nova lista exigiria um caminho explícito de reaplicação, que hoje não existe.

## 5) Parcela já marcada como paga

Não existe trava. Mudar `tipo_contrato` / `parcelas_pagas_empresa` em cota com pagamento registrado é permitido:

- O update apenas limpa `undefined` e grava (`useConsorcio.ts:540-552`), sem consultar pagamentos.
- Nenhuma checagem de `parcela_inicial_paga_em` no fluxo de edição: as referências ao campo estão só em `src/hooks/useCotasCadastradas.ts` (`:46` `if (c.parcela_inicial_paga_em) return false;`, `:121` gravação) e em `src/components/consorcio/CotasCadastradasTab.tsx:95-186`, todas na aba Cotas Cadastradas — nada em `ConsorcioCardForm` nem em `useUpdateConsorcioCard`.
- Não há verificação de `consortium_installments.status = 'pago'` / `data_pagamento` antes do update.

Hoje o desalinhamento é silencioso: a cota passa a declarar um desenho de parcelas diferente do cronograma e dos pagamentos já lançados, sem aviso e sem log específico.

## 6) Quem usa a tela

- Rota: `/consorcio/crm/venda-consorcio` (e o alias `/consorcio/crm/pos-reuniao`) — `src/App.tsx:257-258`, ambas renderizando `PosReuniao`.
- `CotasTab` é a aba "cotas" dentro dessa página: `src/pages/crm/PosReuniao.tsx:51` e `:180-184`.
- Guarda: o layout pai em `src/App.tsx:249` — `<Route path="consorcio/crm" element={<ResourceGuard resource="crm">…}` — sem `RoleGuard` de papel específico. Quem tem permissão no recurso `crm` da BU Consórcio enxerga a aba e os botões de criar/editar/duplicar cota.

## Pergunta que o mapa deixa aberta para você decidir

Substituir os campos atuais pela lista, ou colocar a lista ao lado deles, muda o que acontece com as cotas já cadastradas (item 4) e com as que têm pagamento lançado (item 5). Assim que decidir, monto o plano de implementação.
