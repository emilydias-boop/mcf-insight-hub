
Objetivo: corrigir o bloco “Intermediações de Contrato” no formulário **Editar KPIs** (SDR), para exibir a meta com a mesma lógica já usada nos indicadores: **% das Reuniões Realizadas**.  
No exemplo da tela: **30% de 93 realiz. = 28**.

1) Diagnóstico confirmado
- O indicador já está correto (meta dinâmica de contratos).
- O problema está no formulário `KpiEditForm`: no bloco de SDR, “Intermediações de Contrato” renderiza apenas o valor (`intermediacoes`) e não mostra o cálculo da meta.
- Arquivo afetado: `src/components/sdr-fechamento/KpiEditForm.tsx` (bloco SDR, campo “Intermediações de Contrato”).

2) Implementação proposta (1 arquivo)
- Em `KpiEditForm.tsx`, criar valores derivados para meta de contratos no contexto SDR:
  - base = `formData.reunioes_realizadas`
  - percentual = `metaContratosPercentual` quando vier configurado; senão fallback SDR = `30`
  - meta calculada = `Math.round(base * (percentual / 100))`
- No bloco visual de “Intermediações de Contrato” (SDR), inserir linha de descrição de meta acima do valor:
  - formato esperado: `Meta: 28 (30% de 93 realiz.)`
  - ou equivalente com mesmo conteúdo numérico.
- Manter o campo como read-only e manter `intermediacoes` como realizado (valor vindo da integração já corrigida).

3) Detalhes técnicos (consistência)
- Usar `formData.reunioes_realizadas` (não `kpi` direto) para a meta atualizar imediatamente quando o usuário sincronizar/editar.
- Preservar arredondamento com `Math.round` (já adotado no restante da lógica).
- Não alterar cálculo de payout/indicadores (já corretos); apenas alinhar apresentação no formulário.

4) Validação após implementar
- Abrir o mesmo registro do print e confirmar:
  - Reuniões Realizadas = 93
  - Intermediações de Contrato mostra meta `28` com texto `30% de 93 realiz.`
- Teste rápido de reatividade:
  - alterar “Reuniões Realizadas” no formulário e verificar que a meta de intermediações atualiza em tempo real.
- Confirmar que os indicadores continuam com os mesmos números (sem regressão visual nem de cálculo).
