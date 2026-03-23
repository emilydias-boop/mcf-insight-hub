

## Plano: Melhorar página de Permissões por Cargo

### Mudanças

#### 1. Filtro de cargos
- Multiselect no topo para escolher quais cargos exibir na tabela
- Por padrão mostra todos, mas permite focar em 1-3 cargos
- Admin removido da tabela por padrão (toggle "Mostrar Admin")

#### 2. Resumo por cargo (cards)
- Linha de cards acima da tabela: cada cargo mostra "X de Y recursos com acesso"
- Clicável para filtrar só aquele cargo
- Cor do card reflete cobertura (vermelho = poucos, verde = muitos)

#### 3. Busca de recurso
- Input acima da tabela para filtrar linhas por nome do recurso
- Facilita encontrar "CRM" ou "Financeiro" rapidamente

#### 4. Copiar permissões de outro cargo
- Botão "Copiar de..." abre modal com select de cargo fonte
- Copia todas as permissões da aba ativa para o cargo destino como changes locais (ainda precisa salvar)

#### 5. Indicador de override por BU
- Na aba Global, ao lado de cada recurso que também existe em alguma BU, mostrar ícone discreto indicando que há permissões específicas por BU configuradas

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/Permissoes.tsx` | Adicionar filtro de cargos, busca de recurso, cards de resumo, botão copiar, indicador de override |
| `src/hooks/useRolePermissions.ts` | Adicionar query opcional para buscar todas as BUs (para indicador de override) |

### O que NÃO muda
- Tabela `role_permissions` no banco permanece igual
- Lógica de save/upsert permanece igual
- Hooks consumidores (`useMyPermissions`, `ResourceGuard`) continuam funcionando
- Tabs de BU continuam existindo

