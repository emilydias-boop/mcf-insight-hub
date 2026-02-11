
# Corrigir filtros, adicionar paginacao e contador na aba Realizadas

## Problemas encontrados

### 1. Filtros de pipeline nao funcionam
Os valores no Select estao hardcoded como "Viver de Aluguel" e "Efeito Alavanca", mas os nomes reais no banco sao:
- `PIPELINE - INSIDE SALES - VIVER DE ALUGUEL`
- `Efeito Alavanca + Clube`

O filtro compara `r.origin_name !== pipelineFilter` que nunca bate.

### 2. Quantidade de leads (~21) esta correta
Os dados do banco confirmam: existem 237 deals no stage R1 Realizada, porem:
- 108 nao tem owner (owner_id nulo)
- 44 pertencem a Jessica Bellini (nao e closer de consorcio)
- 40 pertencem a Cleiton (nao e closer de consorcio)
- Apenas 21 pertencem a Thobson (unico closer de consorcio com deals)
- Apos excluir deals com proposta, restam exatamente 21

Isso esta correto dado o filtro por closers do consorcio. Se quiser ver todos os deals independente do closer, precisaria remover esse filtro (decidido na implementacao anterior).

### 3. Falta paginacao e contador

## O que sera feito

### Arquivo: `src/pages/crm/PosReuniao.tsx`

1. **Corrigir valores do filtro de pipeline**: Usar os nomes reais do banco:
   - "PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"
   - "Efeito Alavanca + Clube"

2. **Adicionar contador**: Mostrar no titulo "Reunioes Realizadas -- Aguardando Acao (21)" com o total de deals filtrados

3. **Adicionar paginacao**: Seguindo o mesmo padrao usado em `/consorcio` (Index.tsx):
   - Estado `currentPage` e `itemsPerPage` (default 20)
   - `totalPages = Math.ceil(filtered.length / itemsPerPage)`
   - `paginatedData = filtered.slice(start, start + itemsPerPage)`
   - Componente de paginacao com Previous/Next e numeros de pagina
   - Select para trocar items por pagina (10, 20, 50)
   - Texto "Mostrando X-Y de Z resultados"
   - Reset de pagina para 1 ao mudar filtros

1 arquivo modificado.
