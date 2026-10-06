# Onde ver "de onde vieram as vendas" (só leitura, nada a construir)

## Resposta
Uma tela própria de Marketing com isso existiu, mas está desligada. Hoje o que existe ativo é o modo "Canal de entrada" do Faturamento.

## Tela ativa (use esta)
- Endereço: /bu-incorporador/relatorios
- Menu: BU Incorporador > Relatórios > Vendas > tabela "Faturamento por Closer", seletor "Agrupar por" = **Canal de entrada**
- Quem vê: quem tem permissão de "Relatórios"
- Fonte: transações Hubla/Kiwify/MCF Pay do Incorporador + função do banco `canal_entrada_vendas` (canal do primeiro produto de entrada do cliente, ou etiqueta do CRM) + `canais_entrada_lista`
- Colunas: Vendas, Faturamento Bruto, A receber, Receita Líquida, Ticket Bruto/Líquido, % do Total. Filtro: período. Clique abre o detalhe.
- Também na mesma Central: "Aquisição" (vendas por canal/origem e closer).

## Tela desligada (provavelmente a que o Grimaldo lembra)
- "Aquisição A010" em /bu-marketing/aquisicao-a010, na seção "BU - Marketing" do menu (com Dashboard Ads, Campanhas, Config Links A010)
- Seção removida do menu e endereço comentado — abrir hoje não funciona
- Lia `hubla_transactions` (A010) classificado por UTM em `a010_link_mappings`

## Autor e data
O histórico só mostra o assistente como autor ("gpt-engineer-app[bot]"); não dá para confirmar que foi o Matheus. Marketing aparece em março/2026; os relatórios de aquisição mudaram em abril–agosto/2026.

## Setembro/2026 (lógica do Canal de entrada, contagem por pagamento, P2 fora)
| Canal | Pagamentos | Bruto | Líquido |
|---|---|---|---|
| A010 | 1.024 | R$ 904.771,22 | R$ 590.489,03 |
| Anamnese | 48 | R$ 143.167,11 | R$ 131.596,12 |
| Outros | 190 | R$ 280.186,00 | R$ 153.752,38 |
| Direto (sem entrada) | 28 | R$ 131.227,11 | R$ 91.274,41 |
| Total | 1.290 | R$ 1.459.351,44 | R$ 967.111,94 |

A tela conta "vendas" juntando pagamentos repetidos do mesmo cliente, então a quantidade lá pode ser um pouco menor; os valores são os mesmos.

## Se quiserem a tela de Marketing de volta
Dá para religar como item separado — basta pedir.
