# Meta mensal de cobrança no Financeiro > A receber

## O que o usuário verá
- No topo da tela A receber, um cartão em destaque: **Meta do mês (R$ 250.000)**, quanto já foi recebido no mês, % de batimento e um gauge (meio círculo) geral.
- Logo abaixo, um gauge por cobrador: meta individual x recebido no mês, com % e valor faltante.
- Seletor de mês (padrão: mês atual) para ver meses anteriores.
- Botão "Configurar meta" visível só para admin: define a meta geral do mês e, opcionalmente, a meta de cada cobrador. Se a meta individual não for preenchida, ela é a meta geral dividida igualmente entre os cobradores ativos.
- Cores do gauge: até 69% alerta, 70–99% atenção, 100%+ meta batida (tokens do tema atual).

## Regra de "convertido"
- Soma dos pagamentos registrados no mês (data do pagamento dentro do mês, horário de São Paulo) em títulos de A receber, atribuídos ao cobrador responsável pelo título.
- Exclui reembolsos e estornos. Pagamentos sem cobrador entram só no total geral, como "Sem cobrador".

## Detalhes técnicos
- Nova tabela `ar_metas_cobranca` (mes date, cobrador_id uuid null = meta geral, valor numeric, unique(mes, cobrador_id)), com GRANTs, RLS: leitura para quem acessa A receber (`can_manage_ar`/financeiro), escrita só admin (`has_role`), trigger updated_at. Semente: meta geral de 250000 para o mês atual.
- Cálculo do realizado em `src/lib/arCobrancaCalc.ts` (função pura `batimentoPorCobrador`) a partir dos dados de `useArCarteira`, com teste unitário (meta 250k, divisão igual, exclusão de reembolso).
- Novo componente `MetaCobrancaPainel` + `MetaCobrancaDialog` em `src/components/financeiro/aReceber/`, inserido no topo de `AReceber.tsx` acima das abas; nada das abas existentes muda.

## Pergunta em aberto
Confirmar se os R$ 250 mil são a meta **total da equipe** (padrão deste plano) ou a meta **de cada cobrador**.
