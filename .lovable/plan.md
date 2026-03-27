

## Converter Drawer do Colaborador em Pagina Dedicada

### Problema
O drawer lateral com 10 abas fica apertado e dificulta a visualizacao dos dados. Uma pagina dedicada aproveita toda a largura da tela.

### Solucao

Criar uma rota `/rh/colaboradores/:id` que renderiza uma pagina completa com o perfil 360 do colaborador.

### Arquivos

**Novo: `src/pages/rh/ColaboradorProfile.tsx`**
- Pagina full-width que recebe o `id` via `useParams()`
- Busca o employee pelo id usando `useEmployees()`
- Header com avatar, nome, cargo, status, badges (squad, gestor, datas) — mesmo conteudo do drawer mas com mais espaco
- Botao "Voltar" para `/rh/colaboradores`
- Botao "Editar" abrindo o `EmployeeFormDialog` existente
- Layout de 2 colunas no header: info esquerda + acoes direita
- Abas horizontais com labels completos (sem abreviar) usando toda a largura
- Mesmo conteudo das 10 abas existentes (reutiliza todos os tab components)
- Compliance condicional por role (mesma logica atual)

**Editado: `src/App.tsx`**
- Adicionar rota: `<Route path="rh/colaboradores/:id" element={<ResourceGuard ...><ColaboradorProfile /></ResourceGuard>} />`

**Editado: `src/pages/rh/Colaboradores.tsx`**
- Remover `EmployeeDrawer` e estado `drawerOpen`/`selectedEmployee`
- `handleRowClick` agora faz `navigate(/rh/colaboradores/${emp.id})`
- `useEffect` com searchParam `?employee=` tambem redireciona para a rota
- Manter `EmployeeFormDialog` e `AlertDialog` de delete

**Editado: `src/components/hr/ColaboradoresTable.tsx`**
- Acao "Abrir ficha" no dropdown tambem navega para `/rh/colaboradores/:id`

**Removido/Deprecado: `src/components/hr/EmployeeDrawer.tsx`**
- Nao sera mais importado (pode manter arquivo para referencia, mas sem uso)

### Layout da pagina

```text
┌─────────────────────────────────────────────────────┐
│ ← Voltar    Colaborador: Evellyn Vieira dos Santos  │
├─────────────────────────────────────────────────────┤
│ [Avatar]  Nome Completo                    [Editar] │
│           SDR · Desligado                           │
│           Admissao: 02/02/2026 · Desl: 19/03/2026  │
│           Inside Sales Produto · Gestor: Jessica    │
├─────────────────────────────────────────────────────┤
│ Geral│Remuneracao│NFSe│Documentos│Desempenho│Tempo │
│      │Compliance│Notas│Permissoes│Avaliacoes        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Conteudo da aba selecionada — full width]          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### O que NAO muda
- Todos os tab components existentes (reutilizados intactos)
- `EmployeeFormDialog` (continua como dialog)
- `AlertDialog` de exclusao
- Logica de filtros e tabela na listagem
- Nenhuma tabela do banco alterada

