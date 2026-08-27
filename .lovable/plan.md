# Auditoria: a lista marcada na proposta é a única verdade

Resposta às três perguntas, com trechos reais e dados crus. Nada foi alterado.

---

## 1) Caminho de EDIÇÃO da proposta — ele NÃO propaga as parcelas marcadas

`src/components/consorcio/EditProposalModal.tsx` não trata parcelas: só passa os drafts adiante (`handleSubmit`, linha ~140) para `useEditarProposta`. Cartas já vinculadas a cadastro/cota aparecem como `travada` (linha 76), mas isso trava remoção — não o desenho das parcelas.

Quem grava é `useEditarProposta` em `src/hooks/useConsorcioPostMeeting.ts:1214`. Ele **atualiza os cadastros existentes** (não recria, não ignora), e grava `parcelas_mcf` na carta:

`src/hooks/useConsorcioPostMeeting.ts:1304-1319` — carta:
```ts
.from('consorcio_proposal_cartas')
.update({
  ordem,
  valor_credito: c.valor_credito,
  prazo_meses: c.prazo_meses,
  tipo_produto: c.tipo_produto,
  parcelas_mcf: (c.parcelas_mcf && c.parcelas_mcf.length > 0) ? c.parcelas_mcf : null,
  parcela_1a_12a: c.parcela_1a_12a ?? null,
  ...
})
.eq('id', c.id);
```

`src/hooks/useConsorcioPostMeeting.ts:1356-1369` — propagação para o cadastro:
```ts
.from('consorcio_pending_registrations')
.update({
  valor_credito: c.valor_credito,
  prazo_meses: c.prazo_meses,
  tipo_produto: c.tipo_produto,
  parcela_1a_12a: c.parcela_1a_12a ?? null,
  parcela_demais: c.parcela_demais ?? null,
  condicao_pagamento: c.condicao_pagamento ?? null,
  objetivo: c.objetivo ?? null,
  categoria: c.categoria ?? null,
} as any)
.eq('id', r.id);
```

Conclusão dura: **a lista marcada morre na carta.** Não há `parcelas_mcf_numeros`, nem `tipo_contrato`, nem `parcelas_pagas_empresa`, nem `empresa_paga_parcelas` nesse update. Pior: o gatilho da propagação é a lista de diferenças montada em `1331-1355`, que também não compara parcelas — então mudar SÓ as parcelas marcadas produz `difs.length === 0` e **nenhum** update no cadastro. O termo reemitido sai com as parcelas antigas. Este é exatamente o caminho que o dono está usando.

---

## 2) Portas que editam parcelas do cadastro depois de criado

UPDATE em `consorcio_pending_registrations` tocando `parcelas_pagas_empresa` / `tipo_contrato` / `empresa_paga_parcelas`:

| # | Arquivo:linha | O que faz |
|---|---|---|
| 1 | `src/hooks/useConsorcioPendingRegistrations.ts:1011-1017` (`useUpdatePendingRegistration`) | patch genérico; o tipo do patch aceita `empresa_paga_parcelas`, `tipo_contrato`, `parcelas_pagas_empresa` (linhas 967-969) e **não** aceita `parcelas_mcf_numeros` |
| 2 | `src/hooks/useConsorcioPendingRegistrations.ts:1277-1299` (abertura de cota) | reescreve `empresa_paga_parcelas` / `tipo_contrato` / `parcelas_pagas_empresa` no cadastro a partir do formulário de abertura; a lista **não** é regravada aqui (só vai para o card, linhas 1141-1142) |
| 3 | `src/components/consorcio/OpenCotaModal.tsx:75-77` + `:672-684` | monta o patch (`montarPatchCadastro`) com `tipo_contrato` + quantidade e chama a porta 1 |
| 4 | `src/components/consorcio/OpenCotaModal.tsx:1216-1246` | UI que permite trocar "Tipo Contrato" e "Qtd Parcelas" à mão, já depois da proposta |
| 5 | `src/hooks/useConsorcioPostMeeting.ts:1356-1369` | edição da proposta (item 1) — atualiza o cadastro, mas ignora parcelas |

Ou seja: **duas portas gravam parcelas no cadastro por tipo+quantidade (2 e 3/4), uma porta ignora parcelas (5), e nenhuma delas grava `parcelas_mcf_numeros`.** Só a criação inicial (`AddCartaModal`, `AcceptProposalModal`, `ProposalModal`) leva a lista.

---

## 3) Peso real do "intercalado" — dados crus

Agrupamento:
```
 t       | tipo_contrato     | qtd | min_q | max_q | acima_de_12
---------+-------------------+-----+-------+-------+------------
 cards   | intercalado       | 320 |     1 |   120 |     3
 cards   | intercalado_impar | 126 |     1 |    20 |     1
 cards   | normal            | 851 |     1 |     6 |     0
 pending | intercalado       |  23 |     2 |     5 |     0
 pending | intercalado_impar |  10 |     2 |     3 |     0
 pending | normal            | 340 |     1 |     5 |     0
```

Cronograma:
```
cotas_com_cronograma_empresa_acima_12 = 431 linhas de parcela
cotas_distintas_empresa_acima_12      = 47 cotas
cards_qtd_acima_12                    = 4
cards_com_lista (parcelas_mcf_numeros not null)   = 0
pending_com_lista (parcelas_mcf_numeros not null) = 0
cartas_com_lista (parcelas_mcf not null)          = 46
max_marcadas (maior lista marcada na proposta)    = 4
```

Os 4 casos acima de 12, nominalmente:
```
grupo 7272 / cota 4839 — intercalado, qtd 120, prazo 240, empresa até a parcela 240 (114 acima de 12)
grupo 7269 / cota  913 — intercalado, qtd 120, prazo 240, empresa até a parcela 240 (114 acima de 12)
grupo 7270 / cota 4290 — intercalado, qtd 119, prazo 239, empresa até a parcela 238 (113 acima de 12)
grupo 7271 / cota  937 — intercalado, qtd  12, prazo 240, empresa até a parcela  24 (  6 acima de 12)
```

Leitura dos números:

- **Nenhum vendedor nunca marcou mais de 4 parcelas** na proposta (`max_marcadas = 4`). A capacidade "quantidade alta" nunca foi usada pela boca de entrada real.
- **Nenhuma proposta pendente passa de 5.** Todo `> 12` está apenas em cotas, e três desses quatro são exatamente o padrão "todas as pares de 240" (qtd 119/120) — que é a regra que o dono acabou de negar. É artefato, não uso.
- Os **47 cards com parcela de empresa além da 12ª** vêm em quase todos os casos do deslocamento do intercalado (qtd 8 → parcelas 2,4,…,16), não de quantidade alta.
- A coluna nova `parcelas_mcf_numeros` está **vazia nos dois lados** (0 e 0): hoje nada em produção depende dela — a janela para tratá-la como fonte única ainda está aberta.

Veredito: `intercalado` + quantidade **não é capacidade em uso — é a porta por onde o erro entra.** A grade marcada nunca passou de 4 parcelas; o modelo derivado gerou cotas com a MCF pagando até a parcela 240.

---

## Encaminhamento sugerido (para decidir, nada implementado)

1. Fechar a porta 5: fazer a edição da proposta comparar e propagar `parcelas_mcf`/`parcelas_mcf_numeros` para o cadastro pendente ainda sem cota (e incluir parcelas no gatilho de `difs`).
2. Fechar as portas 3/4: `OpenCotaModal` passa a exibir e gravar a lista marcada, com `tipo_contrato`/quantidade derivados dela — nunca digitados.
3. Manter `tipo_contrato` + quantidade apenas como campos derivados/legados de leitura, não como entrada.
4. Nada de backfill nesta etapa; os 4 casos nominais acima ficam para tratamento separado, caso a caso.
