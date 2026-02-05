
# Próximos Passos - Central de Patrimônio de TI

## Estado Atual (Concluído)

| Componente | Status |
|------------|--------|
| Banco de dados (tabelas + RLS) | Concluído |
| Types/Interfaces TypeScript | Concluído |
| Hooks (CRUD assets, assignments, history, terms) | Concluído |
| Listagem de equipamentos com filtros | Concluído |
| Formulário de cadastro de equipamento | Concluído |
| Dashboard de estatísticas | Concluído |

---

## Fase 2 - Detalhes e Histórico do Equipamento

### 2.1 Página de Detalhes do Equipamento
Criar `/patrimonio/:id` com:
- **Card de Informações**: dados gerais (patrimônio, tipo, marca/modelo, S/O, nº série, fornecedor)
- **Badge de Status**: status atual com cores distintas
- **Responsável Atual**: card com foto/nome do colaborador (se em uso)
- **Timeline de Histórico**: eventos ordenados (compra, liberação, devolução, manutenção, baixa)
- **Ações rápidas**: botões para Editar, Liberar, Devolver, Manutenção, Baixa

### 2.2 Componentes Necessários
- `AssetDetailsPage.tsx` - página completa de detalhes
- `AssetInfoCard.tsx` - card com dados do equipamento
- `AssetTimeline.tsx` - timeline visual do histórico
- `AssetCurrentHolder.tsx` - card do responsável atual

---

## Fase 3 - Fluxo de Liberação (Check-out)

### 3.1 Dialog de Liberação
Modal para atribuir equipamento a colaborador:
- Seletor de colaborador (busca por nome)
- Data de liberação (padrão: hoje)
- Data prevista de devolução (opcional)
- Checklist de itens entregues (mouse, carregador, headset, etc.)

### 3.2 Geração Automática do Termo
- Gerar conteúdo do termo com dados do equipamento + colaborador + itens
- Criar registro em `asset_terms` com `aceito = false`
- Atualizar status do equipamento para `em_uso`
- Registrar evento `liberado` no histórico

### 3.3 Componentes Necessários
- `AssignAssetDialog.tsx` - modal de liberação
- `EmployeeSelector.tsx` - combo de busca de colaboradores
- `ChecklistEditor.tsx` - seletor de itens com observações

---

## Fase 4 - Aceite Digital do Termo

### 4.1 Tela de Aceite (Colaborador)
Acessível via "Meu RH" ou link direto:
- Exibir conteúdo completo do termo (formatado)
- Checkbox "Li e aceito os termos"
- Área de assinatura digital (canvas touch/mouse)
- Botão "Assinar e Aceitar"

### 4.2 Lógica de Aceite
- Capturar assinatura como base64
- Atualizar `asset_terms`: `aceito = true`, `data_aceite`, `assinatura_digital`, `bloqueado = true`
- Registrar IP do aceite (via edge function ou header)

### 4.3 Seção "Meus Equipamentos" no Meu RH
Nova seção na página Meu RH mostrando:
- Lista de equipamentos atualmente atribuídos
- Status do termo (pendente/aceito)
- Link para visualizar/aceitar termo

### 4.4 Componentes Necessários
- `MeuRHPatrimonioSection.tsx` - seção para Meu RH
- `TermAcceptanceDialog.tsx` - modal de aceite
- `SignaturePad.tsx` - canvas para assinatura digital
- `TermViewer.tsx` - visualizador do termo formatado

---

## Fase 5 - Fluxo de Devolução

### 5.1 Dialog de Devolução
Modal para conferência e devolução:
- Exibir itens do checklist original
- Para cada item: checkbox "Conferido" + campo observação
- Seletor de status pós-devolução: `em_estoque` ou `em_manutencao`
- Observações gerais

### 5.2 Lógica de Devolução
- Atualizar `asset_assignment_items` com conferência
- Atualizar `asset_assignments`: `status = 'devolvido'`, `data_devolucao_real`
- Atualizar `assets`: status conforme escolha
- Registrar evento `devolucao` no histórico

### 5.3 Componentes Necessários
- `ReturnAssetDialog.tsx` - modal de devolução com checklist

---

## Fase 6 - Transferência entre Colaboradores

### 6.1 Dialog de Transferência
Quando equipamento está em uso, permitir transferir para outro colaborador:
- Finaliza assignment atual (`status = 'transferido'`)
- Cria novo assignment para novo colaborador
- Gera novo termo de responsabilidade
- Registra evento `transferido` no histórico

### 6.2 Componentes Necessários
- `TransferAssetDialog.tsx` - modal de transferência
- Reutilizar `EmployeeSelector` e `ChecklistEditor`

---

## Fase 7 - Upload de Nota Fiscal

### 7.1 Funcionalidade
- Upload de arquivo PDF/imagem da NF
- Armazenar no bucket Supabase `patrimonio-nf`
- Salvar URL em `assets.nota_fiscal_url`

### 7.2 Componentes Necessários
- `InvoiceUploader.tsx` - componente de upload
- Configurar bucket de storage (migration)

---

## Ordem de Implementação Recomendada

```text
Prioridade 1 (MVP funcional):
├── 2.1 Página de detalhes do equipamento
├── 2.2 Timeline de histórico
├── 3.1 Dialog de liberação
└── 3.2 Geração do termo

Prioridade 2 (Fluxo completo):
├── 4.1 Aceite digital do termo
├── 4.3 Seção Meu RH - Equipamentos
└── 5.1 Dialog de devolução

Prioridade 3 (Complementares):
├── 6.1 Transferência
└── 7.1 Upload de NF
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/pages/patrimonio/[id].tsx` | Criar |
| `src/components/patrimonio/AssetInfoCard.tsx` | Criar |
| `src/components/patrimonio/AssetTimeline.tsx` | Criar |
| `src/components/patrimonio/AssetCurrentHolder.tsx` | Criar |
| `src/components/patrimonio/AssignAssetDialog.tsx` | Criar |
| `src/components/patrimonio/ReturnAssetDialog.tsx` | Criar |
| `src/components/patrimonio/TransferAssetDialog.tsx` | Criar |
| `src/components/patrimonio/EmployeeSelector.tsx` | Criar |
| `src/components/patrimonio/ChecklistEditor.tsx` | Criar |
| `src/components/patrimonio/TermViewer.tsx` | Criar |
| `src/components/patrimonio/TermAcceptanceDialog.tsx` | Criar |
| `src/components/patrimonio/SignaturePad.tsx` | Criar |
| `src/components/meu-rh/MeuRHPatrimonioSection.tsx` | Criar |
| `src/pages/MeuRH.tsx` | Modificar (adicionar seção) |
| `src/App.tsx` | Modificar (adicionar rota detalhes) |
