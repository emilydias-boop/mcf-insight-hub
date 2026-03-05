

## Plano: Adicionar Exportar Excel nas abas Propostas e Sem Sucesso

### Alterações em `src/pages/crm/PosReuniao.tsx`

**Aba Propostas (PropostasTab)**
- Adicionar botao "Exportar Excel" no header do Card (ao lado do titulo)
- Exportar campos: Contato, Valor Credito, Prazo, Produto, Status
- Nome do arquivo: `propostas-consorcio-{data}.xlsx`

**Aba Sem Sucesso (SemSucessoTab)**
- Adicionar botao "Exportar Excel" no header do Card (ao lado do titulo)
- Exportar campos: Contato, Telefone, Pipeline, Motivo, Data
- Nome do arquivo: `sem-sucesso-consorcio-{data}.xlsx`

Ambos seguem o mesmo padrao ja usado em RealizadasTab: `XLSX.utils.json_to_sheet` + `XLSX.writeFile`. O XLSX ja esta importado no arquivo.

