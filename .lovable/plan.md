

## Plano: Remover aba "Duplicatas" da Auditoria

A aba "Duplicatas" dentro da página de Auditoria (`DuplicatesTab`) trata de duplicatas de atividades de deals e é redundante. A página standalone "Contatos Duplicados" (`ContatosDuplicados.tsx`) tem mais funcionalidades e deve ser mantida.

### Alterações

| Arquivo | Ação |
|---------|------|
| **`src/components/audit/DuplicatesTab.tsx`** | Deletar arquivo |
| **`src/pages/crm/AuditoriaAgendamentos.tsx`** | Remover import de `DuplicatesTab`, remover a tab "Duplicatas" do `TabsList` e o `TabsContent` correspondente. A página ficará apenas com a aba "Mudanças de Status" (sem necessidade de Tabs, pode simplificar) |

A página de Contatos Duplicados (`ContatosDuplicados.tsx`) permanece intacta com todas as suas funcionalidades de merge por email/telefone.

