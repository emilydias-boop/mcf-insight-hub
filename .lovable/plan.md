

## Plano: Adicionar botão de exportar leads na Pós-Reunião (Consórcio)

### O que será feito

Adicionar um botão "Exportar Excel" na aba **Realizadas** da página Pós-Reunião, ao lado dos filtros existentes. O arquivo exportado conterá as colunas necessárias para follow-up de consórcio:

- **Nome** (contact_name)
- **Telefone** (contact_phone)
- **Email** (contact_email)
- **Pipeline** (origin_name)
- **Data Reunião** (meeting_date)
- **Região** (region)
- **Renda** (renda)
- **Closer** (closer_name)

### Alteração

**Arquivo**: `src/pages/crm/PosReuniao.tsx` — componente `RealizadasTab`

1. Importar `Download` do lucide-react e `XLSX` do pacote xlsx (já instalado)
2. Adicionar função `handleExport` que converte `filtered` (dados já filtrados) em planilha Excel usando a lib `xlsx`
3. Adicionar botão "Exportar Excel" na barra de filtros, alinhado à direita, seguindo o mesmo padrão visual já usado em `CloserLeadsTable.tsx`

A exportação respeitará os filtros ativos (busca, pipeline, closer, datas), exportando exatamente o que o usuário vê na tela.

