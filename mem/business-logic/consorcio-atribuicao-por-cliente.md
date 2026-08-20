---
name: Atribuição de Cotas Contratadas por cliente (Consórcio)
description: SDR das Cotas Contratadas = último agendamento de consórcio, atribuído por CLIENTE (todas as cotas), com indicador separado de qualidade de cadastro
type: feature
---
Em `useConsorcioCotasContratadas`:
- SDR do deal = quem agendou a **ÚLTIMA** reunião conduzida por closer de BU `consorcio` (attendees `cancelled`/`invited` ignorados; `no_show` vale).
- Unidade de atribuição é o **CLIENTE** (CPF/CNPJ, fallback nome normalizado), sem teto: se qualquer cota dele tem agendamento elegível, todas as cotas e todo o crédito vão para o SDR do último agendamento entre elas.
- Linha residual "Sem agendamento de consórcio" = cliente sem nenhum agendamento elegível (entra na soma das linhas). As linhas somam o Total nas três colunas (cotas, vendas, crédito).
- Indicador SEPARADO (não soma): "N cotas com cadastro sem lead vinculado" — alerta acima da tabela, clicável, mede qualidade de cadastro. Linhas já creditadas por outra cota do mesmo cliente exibem selo "Resultado já atribuído a Fulano".
- Correção de vínculo avisa quantas cotas/crédito do mesmo cliente serão arrastados; a RPC `consorcio_corrigir_vinculo_cota` grava o impacto em `audit_logs` (action `cota_vinculo_impacto`).

Aferição ago/2026: Ithaline 21/10/R$3,39M · Cleiton 15/4/R$3,33M · João Pedro 12/7/R$2,00M · Ygor 1/1/R$0,50M · Sem agendamento 6/2/R$0,72M · Total 55/24/R$9,94M · alerta 33 cotas (R$5,11M).
