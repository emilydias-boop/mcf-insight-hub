

## Plano: Remover página duplicada "Distribuição Leads" do admin

### Contexto

A página `/admin/distribuicao-leads` é redundante — a mesma configuração de distribuição de leads já está disponível dentro do modal de configuração de cada pipeline (`PipelineConfigModal` → aba "Distribuição de Dono"), acessível diretamente na página de Negócios do CRM.

### Mudanças

| Arquivo | O que muda |
|---------|-----------|
| `src/App.tsx` | Remover a rota `admin/distribuicao-leads` |
| `src/components/layout/AppSidebar.tsx` | Remover o item "Distribuição Leads" do menu Administração |

### O que NÃO muda
- `PipelineConfigModal` com a aba de distribuição continua funcionando normalmente dentro do CRM
- A página `LeadDistribution.tsx` e o componente `LeadDistributionConfig.tsx` podem ser mantidos no código (dead code) ou removidos — não afetam o funcionamento

### Resultado
- Menu de administração mais limpo, sem opção duplicada
- Configuração de distribuição continua acessível onde faz sentido: dentro de cada pipeline

