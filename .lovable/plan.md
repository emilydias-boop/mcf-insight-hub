

## Configuração do Carrinho R2

### Resumo
Criar um sistema de configuração persistente para o Carrinho R2, permitindo definir quantos carrinhos existem na semana, quais dias cada um cobre, e o horário de corte. Os KPIs e listas serão separados por carrinho.

### Modelo de Dados

Usar a tabela `settings` existente com a key `carrinho_config`, armazenando um JSON:

```json
{
  "carrinhos": [
    {
      "id": 1,
      "label": "Carrinho 1",
      "dias": [1, 2, 3],          // 0=Dom, 1=Seg, ..., 6=Sáb
      "horario_corte": "12:00",    // Leads com R2 agendada antes desse horário entram neste carrinho
      "horario_reuniao": "12:00"   // Horário da reunião do carrinho
    },
    {
      "id": 2,
      "label": "Carrinho 2", 
      "dias": [4, 5],
      "horario_corte": "12:00",
      "horario_reuniao": "12:00"
    }
  ]
}
```

### Mudanças

#### 1. Novo hook: `src/hooks/useCarrinhoConfig.ts`
- Query para buscar `settings` com `key = 'carrinho_config'`
- Mutation para salvar configuração
- Tipo `CarrinhoConfig` com array de carrinhos
- Função helper `getCarrinhoForDate(config, date, scheduledTime)` que retorna qual carrinho um lead pertence baseado no dia da semana e horário

#### 2. Novo componente: `src/components/crm/CarrinhoConfigDialog.tsx`
- Dialog acessível pelo botão de engrenagem existente (ou novo botão "Configurações")
- Select: quantos carrinhos na semana (1 ou 2)
- Para cada carrinho:
  - Checkboxes para dias da semana (Seg-Sex)
  - Input de horário de corte (ex: 12:00)
  - Input de horário da reunião (ex: 12:00)
  - Label customizável
- Botão salvar persiste na tabela `settings`

#### 3. Atualizar `src/pages/crm/R2Carrinho.tsx`
- Adicionar seletor de carrinho no header (tabs ou dropdown): "Carrinho 1", "Carrinho 2", "Todos"
- Quando um carrinho específico é selecionado, filtrar weekStart/weekEnd apenas para os dias daquele carrinho
- Quando "Todos" selecionado, mostrar semana completa (comportamento atual)
- Passar filtro de horário de corte para os hooks de dados

#### 4. Atualizar hooks de dados para filtrar por carrinho
- `useR2CarrinhoKPIs`: Receber parâmetro opcional `carrinhoConfig` + `selectedCarrinho`. Filtrar meetings cujo `scheduled_at` cai nos dias + horário do carrinho selecionado
- `useR2CarrinhoData`: Mesmo filtro — adicionar condição WHERE para dia da semana e horário
- `useR2ForaDoCarrinhoData`: Mesmo padrão
- `useR2CarrinhoVendas`: Mesmo padrão

A lógica de filtro: para cada meeting/lead, verificar se o `scheduled_at`:
1. Cai em um dos dias do carrinho selecionado
2. Se o horário de corte está definido, verificar se `scheduled_at` é antes do horário de corte

#### 5. Substituir override atual
- O `CarrinhoWeekOverrideDialog` continua existindo para exceções de datas
- Adicionar botão separado "⚙️ Configurar Carrinhos" ao lado do botão de override no header

### Fluxo do Usuário
1. ⚙️ Configurar Carrinhos → Define 1 ou 2 carrinhos, dias e horários
2. Na tela principal, seleciona qual carrinho visualizar
3. KPIs, listas e métricas refletem apenas os leads daquele carrinho
4. Override de semana continua funcionando para exceções

