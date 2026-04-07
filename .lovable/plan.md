
# Compactar Tabela de Resultados da Planilha

## Problema
A tabela de resultados mostra todas as colunas extras da planilha (Estado, Cidade, Bairro, Rua, Numero, Complemento, CEP) como colunas separadas, forçando scroll horizontal. O usuario precisa arrastar para ver Nome/Tel do Sistema e Pipeline/Estagio.

## Solucao
Remover as colunas extras da tabela principal e mostrar em uma linha expansivel (accordion row). Clicar na linha expande uma sub-row com os dados extras em grid compacto.

### Mudancas em `SpreadsheetCompareDialog.tsx`

**Tabela principal** — colunas fixas apenas:
- Status | Nome (Planilha) | Tel (Planilha) | Nome (Sistema) | Tel (Sistema) | Pipeline/Estagio

**Linha expansivel** — ao clicar numa linha:
- Expande sub-row abaixo com grid 3-4 colunas mostrando as colunas extras (Cliente, Estado, Cidade, Bairro, Rua, etc.)
- Icone de chevron na primeira coluna indica que a linha e expansivel (so aparece se tem extras)

**Busca** — continua buscando nas colunas extras normalmente (ja funciona)

**Exportar** — continua exportando todas as colunas (sem mudanca)

### Arquivo
| Arquivo | Acao |
|---------|------|
| `src/components/crm/SpreadsheetCompareDialog.tsx` | Colapsar extras em row expansivel |
