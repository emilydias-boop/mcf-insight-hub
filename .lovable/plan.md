
# Adicionar Seção "Minhas Avaliações" na Página MeuRH

## Objetivo
Permitir que os colaboradores visualizem suas próprias notas de avaliações diretamente na página **Meu RH** (`/meu-rh`), sem precisar de acesso ao módulo de RH.

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/meu-rh/MeuRHAvaliacoesSection.tsx` | **Criar** - Nova seção de avaliações |
| `src/pages/MeuRH.tsx` | **Modificar** - Importar e renderizar a nova seção |

---

## Nova Seção: MeuRHAvaliacoesSection

Componente que exibe:
1. **Card de Resumo** - Média geral e total de avaliações realizadas
2. **Histórico de Notas** - Lista das avaliações com:
   - Título da prova
   - Data de aplicação
   - Nota (com badge colorido por faixa)
   - Observação do avaliador (se houver)

Seguirá o mesmo padrão visual das outras seções (Documentos, Histórico, etc).

---

## Estrutura do Componente

```
MeuRHAvaliacoesSection
├── Card Header: "Avaliações" com ícone ClipboardList
├── Card Resumo (se houver notas)
│   ├── Média Geral com badge colorido
│   └── Total de avaliações
└── Lista de Avaliações
    └── Para cada nota:
        ├── Título da prova
        ├── Data de aplicação
        ├── Nota com badge (verde ≥7, cinza ≥5, vermelho <5)
        └── Observação (opcional)
```

---

## Integração na Página MeuRH

Adicionar a seção entre **Documentos** e **Histórico**:

```
1. Header
2. Resumo do vínculo
3. Dados pessoais
4. Remuneração
5. NFSe (PJ only)
6. Documentos
7. Avaliações ← NOVA SEÇÃO
8. Histórico
```

---

## Detalhes Técnicos

O componente utilizará o hook existente `useEmployeeExamHistory` do arquivo `src/hooks/useExams.ts`, que já busca o histórico de notas por `employee_id`.

### Estados Visuais
- **Loading**: Skeleton de carregamento
- **Sem avaliações**: Mensagem "Nenhuma avaliação registrada"
- **Com avaliações**: Card resumo + lista de notas

### Cores dos Badges de Nota
- Verde (default): nota ≥ 7.0
- Cinza (secondary): nota entre 5.0 e 6.9
- Vermelho (destructive): nota < 5.0
