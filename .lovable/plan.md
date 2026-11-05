# Jornada Pós-Venda por CPF e fases calculadas

## Resultado
Localizar clientes pelas compras, mostrar a fase real a partir dos registros do CRM e permitir configurar a relação entre estágios e fases, sem alterar outras BUs.

## 1. Vínculo e preenchimento auditado
- Usar `hubla_transactions.customer_document`, `customer_email`, `customer_phone` e `customer_name`; normalizar CPF para 11 dígitos e e-mail para minúsculas. Procurar contato por e-mail; somente na ausência de correspondência, comparar os últimos 11 dígitos do telefone, exigindo 11 dígitos disponíveis.
- Restringir negócios a Pós-Venda, não arquivados. Havendo vários negócios da mesma identidade, selecionar o mais recente, com desempate determinístico, e registrar os candidatos no relatório.
- Antes do preenchimento, conferir candidatos, CPFs já existentes e conflitos. Preencher apenas CPF vazio com correspondência confirmada; não sobrescrever CPF existente nem resolver identidades com CPFs conflitantes.
- **Nome divergente com identidade única por e-mail:** preencher o CPF e sinalizar, conforme sua resposta; não modificar o nome da compra, do contato ou do negócio. O caso Nívia × Nivia Rocha será relatado.
- Fazer o preenchimento único dos negócios elegíveis e entregar contagens de preenchidos, já preenchidos, sem correspondência e pendências, com os casos de múltiplos candidatos e nomes divergentes.
- Automatizar a mesma regra para entrada/movimentação de negócio na Pós-Venda sem CPF e recebimento de compra nova; falhas não bloqueiam compra nem entrada no CRM.

## 2. Fases e mapeamento
Manter `jornada_etapas` e sua tela, adicionando código da trilha e estas fases:

| Código | Ordem | Nome |
|---|---:|---|
| f3 | 1 | Onboarding & Boas-vindas |
| f4 | 2 | Acesso ao HARVEY |
| f5 | 3 | Gerentes de Conta |
| f6 | 4 | Projeto Imobiliário |
| f7 | 5 | Crédito & Levantamento de Recursos |
| f8 | 6 | MCF ALAVANCAGEM |

- Preservar IDs e registros antigos; Compra passa a ser informação de data, não uma fase f3–f8. Reaproveitar Boas-vindas e Cadastro no HARVEY sem apagar histórico.
- Criar `jornada_mapa_estagios` e uma tela no menu Pós-Venda com todos os estágios da pipeline e seletor de fase. Vários estágios podem usar a mesma fase.
- Não inventar a relação dos quatro estágios existentes com f5–f8: começam sem mapeamento e são configurados nessa tela. Sem mapeamento e sem anamnese, a fase é f3.
- Preservar acesso de leitura da jornada pelos usuários autorizados; configuração restrita a administradores, como a tela EtapasJornada atual.

## 3. Cálculo único para consulta e ficha
- Fase atual = mais avançada entre a fase mapeada do estágio atual e f4 quando houver registro específico de anamnese recebida do HARVEY; sem ambos, f3.
- Identificar o registro exato de anamnese no código e nos dados antes de implementá-lo; não considerar qualquer nota/importação HARVEY como anamnese.
- Histórico por código de fase com a data mais recente registrada: mudanças de estágio mapeadas, entrada em Pós-Venda para f3 e anamnese para f4. Fases sem registro ficam sem data; não inferir conclusão das fases intermediárias.
- Resolver destino de `stage_change` por ID em metadata, depois UUID, depois nome do estágio dentro da mesma pipeline.
- `JornadaClienteCard` mostra esse mesmo cálculo e histórico, somente leitura, sem seleção manual.
- Desativar apenas a automação antiga da jornada e deixar de ler/escrever `jornada_etapa_atual_id` e `jornada_eventos`; preservar coluna, tabela e dados. Não remover os controles de entregáveis/contato do Pós-Venda.

## 4. Consulta pública
- `consultar-jornada` consulta diretamente as tabelas com service role, sem `vw_cliente_consolidado`.
- Procurar por `crm_deals.cpf`; sem resultado, resolver compra → contato → negócio pela mesma regra. Preferir negócio mais recente.
- Primeiro nome do comprador, com inicial maiúscula; contato só quando a compra não tiver nome. `data_compra` usa `sale_date` da primeira compra aprovada do CPF, após confirmar os valores reais de `sale_status`.
- Retornar `{ primeiro_nome, data_compra, etapa_atual, historico }`, com códigos f3–f8, não IDs internos. Histórico indexado por código, com data registrada ou nula.
- Preservar 404 `{erro}` para CPF não encontrado e validação do CPF; falhas de leitura não devem ser disfarçadas como ausência. Não expor contatos, candidatos ou detalhes cadastrais na resposta pública.
- **Compatibilidade:** a função atual retorna `{primeiro_nome, etapas}`, diferente do contrato solicitado. A nova resposta seguirá o documento; o consumidor da trilha precisa aceitar esse formato. Não alterar outro site sem autorização.

## Detalhes técnicos e segurança
- Compartilhar o cálculo e resolução entre a consulta pública e a leitura autenticada da ficha, com validação de acesso nesta última.
- Migrações via ferramenta própria; incluir permissões explícitas, RLS e validação de mapeamentos restritos à origem Pós-Venda. Chave de serviço somente dentro da função.
- Não editar webhooks de Hubla/Kiwify/MCFPay nem as regras de ingestão/distribuição existentes; adicionar automação isolada de preenchimento de CPF.
- Registrar a substituição da arquitetura antiga em AGENTS.md.

## Validação e entrega
- Testar e-mail prioritário, telefone com 11 dígitos, múltiplos negócios, CPF conflitante, nome divergente, ausência de correspondência e isolamento de BU.
- Testar precedência de fases, anamnese específica, datas mais recentes do histórico e ausência de datas inventadas.
- Conferir o caso Nívia na consulta pública depois do preenchimento e testar CPF inexistente; verificar a ficha e o mapeamento quando houver sessão autenticada disponível.
- Conferir compilação e checagem de tipos disponibilizadas pelo ambiente; relatar limites de verificação.
- Entregar relatório real do preenchimento e lista de alterações. Não publicar o site; a atualização da função será necessária para corrigir a URL pública.