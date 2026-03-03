

## Plano: Upload de Planilha na página Negócios com comparação e classificação (Aberto/Ganho/Perdido)

### Problema
O usuário quer subir uma planilha do Clint direto na página Negócios, comparar com os deals existentes na pipeline ativa, e ver quais leads já existem (com status aberto/ganho/perdido) e quais são novos. Os encontrados devem receber a tag `base clint`.

### Solução

#### 1. Novo componente `SpreadsheetCompareDialog.tsx`
Dialog modal com 3 steps, reutilizando a lógica do Limbo:

- **Upload**: Aceitar `.xlsx`, parsear com `xlsx`
- **Mapeamento**: Auto-mapear colunas (nome, email, telefone) com heurísticas existentes do Limbo
- **Resultados**: Tabela com cada linha da planilha mostrando:
  - Status do match: **Encontrado** ou **Não encontrado**
  - Se encontrado: status do deal local (Aberto/Ganho/Perdido) usando `getDealStatusFromStage`
  - Nome, telefone, email, estágio atual no sistema
  - Filtros: Todos, Encontrados (Aberto/Ganho/Perdido), Não encontrados
  - Contadores por status no topo (badges)
  - Botão **"Aplicar tag 'base clint'"** nos deals encontrados
  - Botão **Exportar Excel** com resultados

#### 2. Lógica de comparação (deduplicação multi-fator)
Reutilizar o padrão existente no sistema (memory de deduplicação):
1. Email (match primário, case-insensitive)
2. Telefone normalizado (últimos 9 dígitos)
3. Nome (fallback, case-insensitive)

Buscar deals da pipeline ativa (`effectiveOriginId`) com joins em `crm_contacts` e `crm_stages` para ter email, telefone, nome e estágio.

#### 3. Mutation de tag `base clint`
Update em batch nos `crm_deals` encontrados, fazendo append da tag ao array `tags` (evitando duplicar se já existir).

#### 4. Persistência via `limbo_uploads`
Salvar resultado no Supabase (tabela `limbo_uploads` já existente) com `origin_id` para associar à pipeline. Ao reabrir o dialog, carregar último resultado salvo.

#### 5. Integração no `Negocios.tsx`
Adicionar botão `FileSpreadsheet` ("Importar Planilha") ao lado de "Sincronizar", passando `effectiveOriginId` e os `dealsData` já carregados.

### Arquivos
- **Criar** `src/components/crm/SpreadsheetCompareDialog.tsx`
- **Criar** `src/hooks/useSpreadsheetCompare.ts` (comparação + mutation de tag)
- **Modificar** `src/pages/crm/Negocios.tsx` (botão + state do dialog)

### Classificação de status dos deals encontrados
Reutilizar `getDealStatusFromStage(stageName)` que já retorna `'open' | 'won' | 'lost'` com base em keywords do estágio.

