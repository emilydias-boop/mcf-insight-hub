---
name: Venda Consórcio — decisões do redesenho
description: Decisões do dono sobre fusão de formulários, dono da etapa 5, fonte de verdade das parcelas e renomeações de rótulos na Venda Consórcio.
type: feature
---

Decisões aprovadas pelo dono (rodada de redesenho da tela Venda Consórcio):

1. **Fusão em dois blocos, cadastral opcional.** O lançamento da venda tem bloco 1 (comercial) obrigatório e bloco 2 (cadastral) opcional. Bloco 2 incompleto **gera pendência visível**: a venda entra na etapa 4 como cadastro incompleto, com selo de dias parados.
2. **Etapa 5 tem dono: a equipe de cadastro.** Quando o cliente paga na Embracon, essa equipe confirma manualmente no sistema. Não é automática.
3. **Etapa 5 é a verdade oficial** sobre quais parcelas a MCF paga; etapa 2 é apenas intenção. Comprovante e previsão financeira leem sempre a parcela confirmada na etapa 5.
4. **No Consórcio, "R1" é chamado de "Reuniões"** — divergir do Incorporador é aceito de propósito.

Rótulos (apenas front, chaves do banco preservadas — ver `src/lib/consorcioLabels.ts`):
- R1 Agendadas → Reuniões Agendadas
- R1 Realizadas → Reuniões Realizadas
- Cartas Negociadas → Termos de Adesão Pendentes
- Cadastros Pendentes → Cotas a Fazer
- Cadastradas → Cotas Cadastradas
- Botão "Lançar Carta" → "Lançar Venda"

Fila de duas listas (`FilaDuasListas`) nas etapas 1, 2 e 4: pendentes primeiro (aberta), tratadas depois (recolhida).
Selo de dias parados (`SeloDiasParados`): âmbar de 2 a 5 dias, vermelho a partir de 6. Âncoras: etapa 1 `scheduled_at`, etapa 2 desfecho da reunião, etapa 4 `created_at` (nunca `updated_at`).
