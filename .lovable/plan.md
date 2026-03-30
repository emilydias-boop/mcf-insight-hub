

## Vendas do Make desaparecem — janela de vendas ignora sexta antes das 12h

### Causa raiz

A janela `vendasParceria` em `carrinhoWeekBoundaries.ts` começa no **horário de corte** (sexta 12:00). Porém, transações vindas do Make são gravadas com `sale_date` à meia-noite (`00:00:00Z`) porque o webhook não envia horário.

Resultado: 11 vendas de parceria no dia 27/03 (todas `source = 'make'`) têm `sale_date = 2026-03-27T00:00:00Z`, que é **antes** do corte de 12:00, caindo fora da janela de vendas de qualquer semana.

### Dados confirmados no banco

```text
11 transações parceria em 2026-03-27 com time=00:00:00, todas source=make
Nomes: Samuel Figueiredo, Diogo Campinho, Lucas Travassos, Gabriel Ramos, 
       Jessica Almeida, Guilherme Almeida, Thalita Miranda, Leandro Oliveira,
       Breno Dias, Claudiane Carraro, Gilberto Machado
```

### Solução

Separar o conceito: o **corte de horário** define quais R2s pertencem a esta semana (aprovados), mas a **janela de vendas** deve capturar **toda a sexta-feira** desde 00:00.

### Mudança

#### `src/lib/carrinhoWeekBoundaries.ts` — linha 89

Trocar o início de `vendasParceria` de `friCartCutoff` para `startOfDay(friday)`:

```text
Antes:  vendasParceria.start = Sex 12:00 (cutoff)
Depois: vendasParceria.start = Sex 00:00 (startOfDay)
```

Isso é seguro porque:
- A janela de aprovados continua usando o cutoff (controla quais R2s contam)
- Vendas não dependem do cutoff — são matchadas contra os leads aprovados
- Não há sobreposição entre semanas (cada sexta-segunda é única)

### Resultado

- As 11 vendas do Make voltam a aparecer na aba Vendas
- Vendas criadas/editadas com horário 00:00 não desaparecem mais
- O corte de 12:00 continua funcionando normalmente para R2s aprovados
- Sem mudança no backend

### Arquivo alterado
1. `src/lib/carrinhoWeekBoundaries.ts` — vendasParceria.start usa startOfDay

