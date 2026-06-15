## Causa

O diálogo de importação de planilha (`SpreadsheetCompareDialog.tsx`, usado nas BUs para subir planilha) gera um `<SelectItem>` para cada cabeçalho de coluna detectado no arquivo. Quando a planilha tem **uma coluna sem cabeçalho** (cabeçalho vazio, em branco ou só espaços), o item vira `value=""`, o que viola a invariante do Radix Select e derruba a página com o erro mostrado.

## Correção (1 arquivo)

`src/components/crm/SpreadsheetCompareDialog.tsx`

1. **Sanitizar `headers` na origem** — logo após detectar/extrair headers da planilha, filtrar entradas vazias/whitespace e remover duplicatas:
   - `headers = rawHeaders.map(h => String(h ?? '').trim()).filter(Boolean)`
   - Se sobrar duplicata, sufixar com índice para garantir `key` único.
2. **Blindar o `.map` do Select de mapeamento (linha 753)** como defesa em profundidade: `headers.filter(h => h && h.trim()).map(...)`.
3. **Blindar o Select de usuário (linha 958)**: filtrar `users.filter(u => u.email && u.email.trim())` antes do `.map`, evitando o mesmo crash se algum usuário vier sem email.

## Validação

- Subir a planilha que está causando o erro hoje → o diálogo deve passar para a etapa "Mapeamento" sem cair.
- A coluna sem cabeçalho simplesmente não aparece como opção de mapeamento (comportamento esperado — não dá pra mapear uma coluna sem nome).
- Conferir no console que não há mais warning do Radix Select.

## Fora de escopo

- Não mexer no parser de planilha em si.
- Não alterar layout/UX do diálogo, só a sanitização defensiva dos dados que alimentam os Selects.
