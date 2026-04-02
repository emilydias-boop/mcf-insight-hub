

## Remover abas "Financeiro" e "Integrações" das Configurações

### Alterações em `src/pages/Configuracoes.tsx`

1. **Remover TabsTriggers** (linhas 250-261) — os dois blocos `{isAdmin && (...)}` das abas Financeiro e Integrações
2. **Remover TabsContents** (linhas 448-532) — os dois blocos `{isAdmin && (...)}` com o conteúdo de Financeiro e Integrações
3. **Limpar imports não utilizados** — remover `DollarSign`, `OperationalCostsConfig`, `Badge`, e quaisquer outros imports que fiquem órfãos (como `integrationItems`, `integrationsLoading`)
4. **Ajustar largura do TabsList** — a classe condicional `isAdmin ? 'md:w-[720px]'` pode ser simplificada já que não há mais abas admin-only

