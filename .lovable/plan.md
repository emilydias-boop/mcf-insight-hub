

# Melhorar Dashboard de Campanhas com Dados Reais da Hubla

## Situacao Atual

Os dados da Hubla chegam com 4 campos: **anuncio**, **bloco_anuncio**, **campanha** e **canal**. Porem no banco (`hubla_transactions`) so temos 3 colunas UTM:

| Hubla (screenshot) | Coluna no banco | Exemplo |
|---|---|---|
| campanha | `utm_campaign` | `10/11/25 [CNSLTR][VENDAS]...\|120235290256460244` |
| bloco_anuncio | `utm_medium` | `00 - ARQUITETURA\|120231443473160244` |
| canal | `utm_source` | `FB` |
| anuncio | **NAO EXISTE** | `ADS 005 - Se voce ganha 50k por mes\|1202352902...` |

Alem disso, os valores vem com IDs numericos longos concatenados com `|`, poluindo a tabela.

## Melhorias Propostas

### 1. Limpar nomes na exibicao (sem alterar banco)

**Arquivo: `src/pages/bu-marketing/CampanhasDashboard.tsx`**

Criar funcao utilitaria para remover o ID do final dos valores UTM:

```typescript
// "10/11/25 [CNSLTR]...|120235290256460244" -> "10/11/25 [CNSLTR]..."
const cleanUtmValue = (val: string) => val?.replace(/\|[\d]+$/, '') || val;
```

Aplicar nas celulas de Campanha e Bloco do Anuncio na tabela.

### 2. Renomear colunas para refletir terminologia da Hubla

Atualizar os headers da tabela:

| Antes | Depois |
|---|---|
| Campanha | Campanha |
| Conjunto / Adset | Bloco do Anuncio |
| Fonte | Canal |

### 3. (Opcional futuro) Armazenar campo "anuncio"

O campo "anuncio" (nome do ad especifico) nao esta sendo capturado no banco. Para captura-lo seria necessario:
- Adicionar coluna `utm_content` (ou `ad_name`) em `hubla_transactions`
- Atualizar o webhook/importacao da Hubla para gravar esse campo

Isso ficaria como melhoria futura. Por enquanto, os 3 campos existentes ja respondem as perguntas principais.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/bu-marketing/CampanhasDashboard.tsx` | Funcao `cleanUtmValue`, renomear headers, aplicar limpeza nas celulas |

## Resultado Esperado

- Tabela mostra nomes limpos sem IDs numericos poluindo
- Colunas com nomes que o time de marketing reconhece (Bloco do Anuncio, Canal)
- Dados ficam mais legiveis e uteis para analise

