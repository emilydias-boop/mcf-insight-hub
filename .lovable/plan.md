

## Configuração de Carrinho por Semana

Entendi o problema: hoje a configuração é **global** — ao alterar dias/horário de corte, isso muda para todas as semanas (passadas e futuras). Cada semana pode ter uma configuração diferente (ex: semana A tem carrinho na quarta às 12h, semana B na quinta às 14h).

### Solução: Salvar config por semana

Em vez de uma única chave `carrinho_config` na tabela `settings`, cada semana terá sua própria configuração, usando a chave `carrinho_config_{weekStartDate}` (ex: `carrinho_config_2026-02-28`).

### Mudanças

**1. `src/hooks/useCarrinhoConfig.ts`**
- O hook passa a receber `weekStart: Date` como parâmetro
- A chave no banco muda de `carrinho_config` para `carrinho_config_YYYY-MM-DD` (baseada no sábado da semana)
- Ao buscar: se não existir config para a semana, usa o DEFAULT (1 carrinho, todos os dias úteis)
- Ao salvar: salva na chave específica da semana
- Query key inclui a data da semana: `['carrinho-config', weekKey]`

**2. `src/pages/crm/R2Carrinho.tsx`**
- Passa `weekStart` para `useCarrinhoConfig(weekStart)`
- O `saveConfig` já salva automaticamente para a semana sendo visualizada
- Ao navegar entre semanas, a config carrega independentemente

**3. `src/components/crm/CarrinhoConfigDialog.tsx`**
- Adicionar indicação visual de qual semana está sendo configurada (ex: "Configurar Carrinhos — Semana 28/02 - 06/03")
- Adicionar botão "Copiar da semana anterior" para facilitar quando a config é parecida

### Fluxo do usuário
1. Navega para semana X → carrega config da semana X (ou default se não existir)
2. Abre dialog → vê config daquela semana específica
3. Altera e salva → salva apenas para semana X
4. Navega para semana Y → carrega config da semana Y (independente)
5. Pode copiar config de outra semana se quiser

### Detalhes técnicos
- Chave no banco: `carrinho_config_2026-02-28` (formato `YYYY-MM-DD` do sábado)
- Não quebra configs antigas: a config global existente pode servir como fallback
- `filterByCarrinho` e `getCarrinhoForDate` não mudam — recebem o `config` já resolvido

