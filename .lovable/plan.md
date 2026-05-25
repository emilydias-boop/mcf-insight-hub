## Problema atual

A aba **Contemplação** já tem a lógica de cálculo (`classificarCotasPorLoteria` + fallback por redução de dígitos), mas o botão **"Calcular possibilidades"** fica desabilitado quando o número da Loteria tem menos de 5 dígitos. Na sua tela você digitou `1600` (4 dígitos) e o botão travou — daí parecer "que não funciona".

Além disso, hoje a aba só mostra a **zona** (±50 / ±100) e uma recomendação genérica de lance. Você quer ver:
- **Probabilidade real** de cada cota (não só zona)
- **Lance recomendado automaticamente** entre 25% e 50%, com justificativa
- **Posição estimada no ranking** do grupo

## O que vou mudar

### 1. Desbloquear o botão (regra de fallback automático)
A regra Embracon já é: se `6600` não existe no grupo, desce para `600`, depois `60`, depois `6` — até cair dentro do range das cotas. Vou:
- Remover a exigência de "mínimo 5 dígitos" no botão
- Aceitar de **1 a 5 dígitos** (o fallback existente já cuida do resto)
- Manter validação só de "campo não vazio + grupo + período preenchidos"
- Mostrar no resultado qual número foi efetivamente aplicado (ex: "Digitado 6600 → aplicado 600 porque grupo só tem cotas até 999")

### 2. Novo cálculo de chance e lance recomendado

Para cada cota ativa do grupo, calcular:

```text
distancia = |cota - numero_aplicado|

posicao_no_ranking = quantidade de cotas com distancia menor que esta
                     + (cotas com lance > X% também passam à frente)

chance = função(posicao, vagas_contempladas_por_assembleia)
```

**Regra de recomendação 25% vs 50%:**
- Simula posição final aplicando lance 25% e depois 50% sobre TODAS as cotas do grupo
- Se com 25% já fica entre as primeiras vagas → recomenda **25%** (economiza dinheiro)
- Se 25% não basta mas 50% coloca entre as vagas → recomenda **50%**
- Se nem 50% resolve → marca como **"Lance não compensa"** (esperar próxima assembleia)
- Se está em `match_sorteio` (distância 0) → **"Sem lance — contemplação por sorteio"**

### 3. Nova coluna na tabela
Substituo as colunas atuais "Categoria de Chance" + "Recomendação de Lance" por:

| Posição estimada | Chance | Lance recomendado | Valor do lance |
|---|---|---|---|
| 3º de 5 vagas | Alta (85%) | 25% | R$ 30.000 |
| 12º de 5 vagas | Baixa (8%) | 50% ou esperar | R$ 60.000 |
| 1º (match) | Sorteio (100%) | — | — |

### 4. Disclaimer atualizado
Esclarecer que é **estimativa matemática** baseada em distância + simulação de ranking, não previsão de assembleia real.

## Detalhes técnicos

**Arquivos editados (sem mudança de banco):**
- `src/lib/contemplacao.ts` — nova função `simularPosicaoComLance(cards, numeroAplicado, percentual)` que retorna ranking por cota; nova função `recomendarLance(cota, cardsDoGrupo, numeroAplicado, vagasAssembleia)` que testa 0% → 25% → 50% e devolve `{ percentualRecomendado, posicao, chance, valorLance, justificativa }`
- `src/components/consorcio/ContemplationTab.tsx` — relaxa `canCalculate` para `consultaNumero.length >= 1`; substitui colunas de zona pelas novas (Posição / Chance / Lance recomendado / Valor)
- Mantém `VerificarSorteioModal` e `LanceModal` existentes para registrar manualmente
- Mantém persistência em `consorcio_consulta_loteria` (só adiciono `vagas_assembleia` opcional se você confirmar quantas vagas por assembleia o grupo tem)

**Parâmetro de vagas por assembleia:** assumo padrão de **2 vagas** (1 sorteio + 1 lance) por assembleia mensal Embracon. Se for diferente por grupo, podemos adicionar campo configurável depois.

**Nenhuma migração de banco** é necessária para esta etapa.
