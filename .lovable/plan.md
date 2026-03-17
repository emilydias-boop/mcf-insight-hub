

## Corrigir visibilidade do Ulysses e simplificar UI cross-pipeline

### Problema 1: Ulysses na origin errada
O deal `b65a15ba` (Ulysses Inácio da Luz) foi vinculado à origin **"PIPE LINE - INSIDE SALES"** (`57013597`, grupo `b98e3746`) em vez de **"PIPELINE INSIDE SALES"** (`e3c04f21`, grupo `a6f3cbfc`). São origins diferentes em grupos diferentes, por isso não aparece no Kanban do Inside Sales.

**Fix**: UPDATE do deal para mover para a origin correta com o estágio equivalente:
- `origin_id` → `e3c04f21` (PIPELINE INSIDE SALES)
- `stage_id` → `155f9eab` (Reunião 02 Realizada - nessa origin)

### Problema 2: Seção cross-pipeline feia
A lista expandida com cards clicáveis ocupa muito espaço e polui a visão do Kanban.

**Fix**: Substituir a seção expandida por apenas um banner informativo compacto no contador de oportunidades, tipo:
> "1 oportunidade (+ 2 em outras pipelines)"

Ao clicar no texto "em outras pipelines", abrir um toast ou tooltip listando os deals e permitir abrir o drawer. Remover toda a seção expandida `div` com a lista de cards.

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| SQL data fix | UPDATE deal `b65a15ba`: `origin_id = 'e3c04f21'`, `stage_id = '155f9eab'` |
| `src/pages/crm/Negocios.tsx` | Remover a seção expandida de cross-pipeline (linhas ~742-776). Manter apenas o texto informativo inline no contador de oportunidades (linha ~642-646), e ao clicar, abrir o drawer do primeiro deal cross-pipeline ou mostrar um popover simples com a lista |

