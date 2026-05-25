## Visão geral

Substituir a regra única atual por um modelo de **3 camadas**:

1. **Faixa por tipo de produto** (distância vs % de lance) — define se a cota é candidata e qual lance sugerir
2. **Histórico de assembleias do grupo** (registrado manualmente) — fornece quantos contemplados esperar na próxima
3. **Recomendação final** = cruzamento das duas camadas

## Camada 1 — Faixas por tipo de produto

Tabela de regras editável (começa com seus padrões):

| Produto | Distância | Lance sugerido |
|---|---|---|
| Imóvel | 0 a 50 | 25% |
| Imóvel | 51 a 100 | 50% |
| Imóvel | > 100 | Não compensa |
| Auto / Moto | 0 a 150 | 25% |
| Auto / Moto | > 150 | 50% |
| Serviços (padrão) | mesma do auto, configurável | — |

Essas faixas ficam editáveis numa tela de configuração simples (admin), para você ajustar sem precisar mexer em código.

## Camada 2 — Histórico de assembleias

Cadastro **manual** por assembleia do grupo, com:
- Data da assembleia
- Nº sorteado da Loteria Federal aplicado
- Quantidade total de contemplados (ex: 3, 2, 3)
- Lista de cotas contempladas, cada uma com: cota, motivo (sorteio/lance livre/lance fixo) e % de lance

A partir desse histórico o sistema calcula:
- **Média de contemplados por assembleia** → é o número de vagas estimadas da próxima (no seu exemplo: (3+2+3)/3 ≈ **2,67 → arredonda para 2 ou 3**)
- Mostra resumo: "Grupo 7272 — 3 assembleias registradas, média 2,67 contemplados/assembleia"

Se o grupo ainda não tem histórico (caso 7272 hoje, primeira assembleia), usa um **fallback configurável por grupo** (`vagas_padrao`, default 2).

## Camada 3 — Recomendação final por cota

```text
distancia = |cota - numero_aplicado|
faixa = faixa_do_produto(tipo_produto, distancia)
vagas = media_historica_grupo OU vagas_padrao_grupo

posicao = ranking_da_cota_por_distancia_dentro_do_grupo

SE faixa = "não compensa":
    recomenda "Esperar próxima assembleia"
SENÃO SE posicao <= vagas:
    recomenda lance da faixa (25% ou 50%)
    chance = Alta
SENÃO SE posicao <= vagas * 2:
    recomenda lance da faixa
    chance = Média ("disputado")
SENÃO:
    recomenda "Lance arriscado — fora das vagas prováveis"
```

## Mudanças concretas no produto

### Nova tela / seção: **Configuração de Faixas por Produto**
Local: dentro da aba Contemplação (botão "⚙️ Faixas") ou em `/admin/consorcio-faixas`. Edita a tabela da Camada 1.

### Nova seção: **Histórico de Assembleias do Grupo**
Local: dentro da aba Contemplação, expansível por grupo selecionado. Botão **"+ Registrar assembleia anterior"** abre modal para cadastrar uma assembleia passada com seus contemplados.

### Aba Contemplação atualizada
Quando você roda "Calcular possibilidades", a tabela passa a mostrar:

| Cota | Tipo | Distância | Faixa aplicada | Posição/Vagas | Lance recomendado | Chance |
|---|---|---|---|---|---|---|
| 102 | Imóvel | 48 | ±50 | 2º / 2 vagas | **25%** | Alta |
| 1111 | Imóvel | 489 | >100 | — | Esperar | — |
| 1614 | Imóvel | 14 | ±50 | 1º / 2 vagas | Sem lance (sorteio) | Muito alta |

Resumo no topo: "Grupo 7272 — média histórica 2,67 vagas/assembleia (3 assembleias registradas)"

## Detalhes técnicos

**Tabelas novas (Supabase):**

1. `consorcio_faixas_recomendacao`
   - `tipo_produto` (text)
   - `distancia_min` (int)
   - `distancia_max` (int, null = infinito)
   - `percentual_lance` (int, null = não compensa)
   - `ordem` (int)
   - Seed inicial com Imóvel (0–50→25, 51–100→50, >100→null) e Auto (0–150→25, >150→50)

2. `consorcio_assembleias_historico`
   - `grupo` (text)
   - `data_assembleia` (date)
   - `numero_loteria_aplicado` (text)
   - `qtd_contemplados` (int)
   - `observacao` (text, opcional)

3. `consorcio_assembleia_contemplados`
   - `assembleia_id` (FK)
   - `cota` (text)
   - `motivo` (sorteio | lance_livre | lance_fixo)
   - `percentual_lance` (numeric, null se sorteio)
   - `card_id` (FK opcional para `consortium_cards` se existir)

4. Em `consortium_cards`, novo campo opcional `vagas_padrao_assembleia` (int, default 2) — usado quando o grupo não tem histórico. Como hoje grupo é só uma string em cada cota, alternativa: criar `consorcio_grupos_config (grupo text PK, vagas_padrao int, observacao text)`.

**RLS:** todas as tabelas com `enable row level security` e policies permitindo SELECT/INSERT/UPDATE/DELETE para usuários autenticados (alinhado às outras tabelas de consórcio).

**Código:**
- `src/lib/contemplacao.ts` — refatorar `recomendarLanceParaCota` para receber `faixas` + `mediaContemplados` ao invés de constantes; remover heurística atual de lance.
- Novos hooks: `useFaixasRecomendacao`, `useHistoricoAssembleiasGrupo(grupo)`, `useRegistrarAssembleia`.
- Novos componentes:
  - `FaixasConfigDialog.tsx` — edita Camada 1
  - `HistoricoAssembleiaPanel.tsx` — lista + cadastra assembleias do grupo selecionado
  - `RegistrarAssembleiaModal.tsx` — formulário com lista dinâmica de contemplados
- `ContemplationTab.tsx` — integra os novos componentes e usa nova lógica.

## Sequência de implementação

1. Migração das 4 tabelas + seed das faixas iniciais
2. Hooks e componentes de configuração de faixas (Camada 1)
3. Hooks e componentes de histórico de assembleias (Camada 2)
4. Refatorar `recomendarLanceParaCota` e tabela de resultados (Camada 3)
5. Memory note: `mem://business-logic/consorcio-contemplacao-recomendacao-engine`

Posso seguir com a migração quando você aprovar.
