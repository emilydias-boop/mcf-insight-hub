

## Relatório PDF: 366 Leads A010 Verdadeiramente Limpos — Março 2026

### Objetivo
Gerar um PDF final filtrado com apenas os leads que realmente precisam de distribuição, excluindo parceiros, duplicatas e leads já atendidos.

### Filtros aplicados (expandidos)
- Pipeline Inside Sales (incorporador), Março 2026, sem dono
- Tem compra A010 confirmada
- **EXCLUI** contatos com compras em QUALQUER destas categorias: `contrato`, `renovacao`, `parceria`, `ob_vitalicio`, `contrato-anticrise`, `contrato_clube_arremate`, `socios`, `incorporador`, `p2`, `imersao_socios`, `efeito_alavanca`, `clube_arremate`, `ob_construir`, `ob_construir_alugar`, `imersao`
- **EXCLUI** contatos com produtos cujo nome contém: "Contrato", "MCF Incorporador", "Parceria", "Renovação", "Sócio", "MCF P2", "Anticrise"
- **EXCLUI** contatos que já têm deal com dono na mesma pipeline (duplicatas)
- **EXCLUI** contatos que já têm deal com dono em qualquer outra pipeline (já atendidos)

### Conteúdo do PDF

1. **Resumo executivo**:
   - Total original: 632 → 265 parceiros removidos → 2 duplicatas → ~71 já atendidos em outra pipeline → **~366 limpos**
   - Distribuição por estágio atual e semana de compra

2. **Tabela principal**: Nome, Email, Telefone, Produto A010, Data Compra, Valor, Estágio Atual
   - Ordenado por data de compra (mais antigos primeiro)

3. Landscape, multi-página com reportlab

### Execução
1. Query SQL com todos os filtros expandidos
2. Gerar PDF com reportlab
3. QA visual
4. Salvar em `/mnt/documents/`

