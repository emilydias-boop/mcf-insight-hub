---
titulo: Lógica dos índices Embracon Class — janelas 12-6 (cancelamento) e 8-2 (inadimplência)
atualizado: 2026-09-21
destino: implementação no MCF Gestão (mcfgestao.com → BU Consórcio → Pagamentos)
---

# Lógica dos índices Embracon Class

Dois índices que a Embracon usa para enquadrar a MCF no Embracon Class:
- 12-6: índice de cancelamento.
- 8-2: índice de inadimplência.
Os dois são percentuais sobre a produção de uma janela móvel de meses. O valor que conta é o VALOR DE CRÉDITO (valor do bem), e não a quantidade de cotas.
Status: ✅ Confirmado / ⚠️ A confirmar com o Guilherme ou o Power BI.

## 1. Conceitos
- Produção de um mês: soma do valor do bem de todas as cotas vendidas pela MCF naquele mês, pelo "Período Produção" do Power BI.
- Mês de apuração (M): mês em que o índice é medido.
- Janela: bloco de 6 meses de produção olhado no mês M. Muda todo mês.
- Cota cancelada: cota que a Embracon cancelou por falta de pagamento.
- Cota reativada: cota cancelada que o cliente reativou pelo canal da Embracon. Volta a ser ativa e sai do numerador.
- Cota inadimplente: cota ativa com uma ou mais parcelas vencidas e não pagas.
- Regularizada (N00): cota que estava inadimplente e ficou em dia. Sai do numerador do 8-2.

## 2. Índice 12-6 ✅
Índice 12-6 (M) = Σ valor do bem das cotas CANCELADAS produzidas na janela ÷ Σ valor do bem de TODA a produção da janela.
Janela 12-6 do mês M = produção de (M − 11) até (M − 6), 6 meses fechados. Set/2026 → out/2025 a mar/2026.
Tabela: ago/26 set/25→fev/26 R$ 123,02 mi | set/26 out/25→mar/26 R$ 129,10 mi | out/26 nov/25→abr/26 R$ 144,54 mi | nov/26 dez/25→mai/26 R$ 155,26 mi | dez/26 jan/26→jun/26 R$ 158,16 mi | jan/27 fev/26→jul/26 R$ 225,89 mi | fev/27 mar/26→ago/26 R$ 217,44 mi.
Regras: (1) o numerador só conta cotas produzidas dentro da janela; (2) a data do cancelamento não importa, o que define é o mês de produção; (3) reativada sai do numerador — é a única forma de baixar o índice de uma janela já formada; (4) pagar boleto de inadimplente não baixa o índice, só impede que suba; (5) o índice muda porque sai o mês mais antigo, entra um novo, ou cotas cancelam/reativam.
2.3 ⚠️ Cancelamento: premissa de 2 parcelas vencidas + cerca de 12 dias. Alerta: cota da janela atual ou da próxima com 2 parcelas vencidas = "cancelamento iminente".
2.4 ⚠️ Meta perseguida 25% (Grimaldo, 18/09/2026); registro antigo cita 22,5%. Bônus Class 0,60% do volume produzido no mês (R$ 29,8 mi/mês ≈ R$ 178,8 mil/mês). Bônus da produção de outubro entra em novembro/2026.

## 3. Índice 8-2 ⚠️
Índice 8-2 (M) = Σ valor do bem das cotas INADIMPLENTES + CANCELADAS produzidas na janela ÷ Σ valor do bem de toda a produção da janela. Janela = (M − 7) até (M − 2).
Set/2026: janela fev/26 a jul/26, produção de R$ 164,70 mi (derivado do Power BI de 15/09/2026, numerador oficial ÷ índice oficial).
Regras: canceladas são piso (nenhum pagamento tira); inadimplente sai quando fica em dia (N00); pagar boleto baixa o 8-2 na hora.
Em 15/09/2026: numerador R$ 68,33 mi (R$ 33,57 mi canceladas + R$ 34,76 mi ativas inadimplentes), índice ≈ 41,5%. Após pagamentos de 18 a 21/09, estimativa ≈ 32,2%.

## 4. Dados necessários
Por cota: grupo, cota, proposta/contrato (FinanceHub usa Ctr + Cota); valor_do_bem (a unidade do índice — o valor da parcela não serve); mes_producao (mesmo critério do Power BI); plano; status_embracon (ativa_em_dia, inadimplente, cancelada, reativada); data_cancelamento, data_reativacao; parcelas_pagas, parcelas_vencidas; pago_pela_mcf (s/n) + data + valor.
Apoio: producao_mensal (Power BI ou soma do valor do bem, as duas devem bater); snapshot_indices (mês, índice, numerador, denominador, qtd, fonte calculado|power_bi) — sem snapshot não se reconstrói histórico.
Tela: 12-6 do mês e dos próximos 3; quanto falta reativar (numerador − meta × denominador); lista cancelamento iminente; lista sai do 8-2 pagando 1 boleto; simulador.

## 5. Referência
Canceladas da janela de set/2026: out/25 28 cotas R$ 11,80 mi; nov/25 16 R$ 5,34 mi; dez/25 31 R$ 8,42 mi; jan/26 29 R$ 6,16 mi; fev/26 33 R$ 7,49 mi; mar/26 28 R$ 5,99 mi; total 165 cotas R$ 45,20 mi. 12-6 set ≈ 35,0%. Para 25%, numerador precisa cair para R$ 32,28 mi → reativar ≈ R$ 12,9 mi.
Origem do crédito dessas cotas: 61 exato (Power BI), 16 exato (FinanceHub), 88 deduzido da comissão da 1ª parcela (Parcelinha 0,5333% do crédito; SELECT antiga 1,2%).
Série de produção (R$ mi): abr/25 34,89; mai/25 22,48; jun/25 24,10; jul/25 52,41; ago/25 14,29; set/25 23,11; out/25 15,08; nov/25 12,26; dez/25 28,70; jan/26 15,61; fev/26 28,26; mar/26 29,19; abr/26 30,52; mai/26 22,98; jun/26 31,60; jul/26 83,34; ago/26 19,81.
⚠️ out/2025 aparece com R$ 11,8 mi cancelados sobre R$ 15,08 mi produzidos (78%) — possível deslocamento de 1 mês entre o "Período Produção" do Power BI e esta série. Usar o mesmo critério de mês nas duas pontas.

## 6. Armadilhas
1. Tirar da janela um mês que ainda está nela (out/2025 é o primeiro mês da janela de setembro). 2. Contar cotas ou usar ticket médio em vez de crédito. 3. Achar que pagar boleto baixa o 12-6. 4. Somar inadimplentes de meses fora da janela. 5. Confundir parcela paga no MCF Gestão com parcela reconhecida pela Embracon — o índice oficial é o do Power BI; o MCF Gestão é controle operacional e deve ser conferido todo mês.

## 7. Confronto com o FinanceHub
FinanceHub enxerga adimplência pelas comissões (comissão da parcela N recebida = parcela N paga). Paga aqui + comissão recebida = OK; paga aqui sem comissão no mapa seguinte = investigar; atrasada aqui + comissão recebida = cadastro desatualizado; cancelada no Power BI + projeções abertas no FinanceHub = baixar projeções. Chave: grupo-cota `007272-4634`; no FinanceHub: `[Ctr 9810512 Cota 007272-4634-00]`.

## 8. Pendências
- Critério do "Período Produção": mês da venda, da adesão ou da 1ª assembleia?
- Janela e fórmula do 8-2 (M−7 a M−2?) e se as canceladas entram.
- Regra de cancelamento (2 parcelas + quantos dias).
- Limite oficial do Class: 25% ou 22,5%.
- Rotina mensal de importação do Power BI (detalhe canceladas 12-6 e detalhe 8-2 com valor do bem por cota).
