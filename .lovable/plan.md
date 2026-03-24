

## Plano: Exportação avançada do CRM com seleção de stages e campos

### O que será construído

Um dialog de exportação acessível via botão "Exportar" na toolbar da página Negócios, permitindo ao usuário escolher:
1. **Quais stages** exportar (checkboxes com todos os stages da pipeline atual)
2. **Quais campos** incluir na planilha (nome, contato, email, telefone, valor, tags, owner, origem, data de criação, etc.)
3. Formato: **XLSX** (padrão já usado no projeto via biblioteca `xlsx`)

### Componentes

| Arquivo | Ação |
|---------|------|
| `src/components/crm/ExportDealsDialog.tsx` | **Novo** — Dialog com checkboxes de stages e campos, botão "Exportar Excel" |
| `src/pages/crm/Negocios.tsx` | Adicionar botão "Exportar" na toolbar (ao lado de "Importar Planilha") e abrir o dialog |

### Detalhes técnicos

**ExportDealsDialog** receberá:
- `deals` — array de deals já carregados no Kanban (evita re-fetch)
- `stages` — lista de stages da pipeline atual (do hook `useCRMStages`)
- `open` / `onOpenChange` — controle do dialog

**Campos selecionáveis** (com checkbox, todos marcados por padrão):
- Nome do Negócio
- Nome do Contato
- Email
- Telefone
- Estágio atual
- Valor
- Tags
- Responsável (owner)
- Origem
- Data de Criação
- Data de Movimentação (stage_moved_at)
- Produto (product_name)
- SDR Original
- Closer R1 / R2

**Fluxo**:
1. Usuário clica "Exportar" → abre dialog
2. Seleciona stages desejados (ex: só "R1 Realizada" e "Contrato Pago")
3. Marca/desmarca campos
4. Clica "Exportar Excel"
5. Sistema filtra deals pelas stages selecionadas, monta planilha com colunas escolhidas, e faz download via `XLSX.writeFile`

**Padrão de export**: Segue o mesmo padrão já usado em `CarrinhoReportPanel`, `CrossBUReportPanel`, etc. (`import * as XLSX from 'xlsx'`).

### Acesso
Visível apenas para `admin` e `manager` (mesmo controle do botão "Importar Planilha").

