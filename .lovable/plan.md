# Gerente de relacionamento na Jornada e no HARVEY

## Regra
O gerente do cliente é o **dono do cartão Pós-venda** (já passa a ser o gerente quando a Karen agenda a reunião). Nenhuma distribuição de gerentes do HARVEY é considerada.

## O que muda
1. **Telefones no RH** — preencher o telefone dos 4 gerentes no cadastro de colaboradores:
   - Kalyanne Pereira: (83) 98160-9894
   - Rebeca Carlos de Aguiar Saar: (24) 99816-5099
   - William Rangel de Barros Silva: (11) 92018-0929
   - Vitor Ferreira: (11) 98401-1224
2. **Link da Jornada (consulta por CPF)** — a resposta passa a trazer `gerente: { nome, telefone }` do dono do cartão. Se não houver dono ou ele for a Karen, volta vazio. A página trilha.mcfcapital.com.br precisa exibir esse campo (projeto externo: aviso o que mostrar).
3. **HARVEY** — sempre que o dono do cartão Pós-venda mudar para um gerente, o sistema envia ao mesmo webhook do HARVEY um aviso `pos_venda.gerente_relacionamento.v1` com CPF, e-mail e telefone do cliente + nome e telefone do gerente, para atualizar direto no usuário. Cada envio fica registrado (sucesso/erro) para reenvio.
4. **Carga inicial** — enviar ao HARVEY os clientes que já têm gerente hoje (somente após você confirmar que o time do HARVEY já trata o novo aviso).

## Pendência externa
O time do HARVEY precisa tratar o novo tipo de aviso no webhook atual; até lá os envios aparecem com erro no registro, sem afetar o sistema.

## Texto para enviar ao time do HARVEY
```text
Olá, time HARVEY. A partir de agora o MCF Gestão vai enviar, no mesmo webhook
que já recebe o Relatório da Cota, um novo aviso para definir o gerente de
relacionamento de cada cliente. Precisamos que vocês tratem esse aviso.

Como identificar: campo "tipo" = "pos_venda.gerente_relacionamento.v1".
Assinatura: cabeçalho X-MCF-Signature (HMAC-SHA256 do corpo com o mesmo
segredo já usado hoje). Rejeitem se a assinatura não conferir.

Corpo enviado (JSON):
{
  "tipo": "pos_venda.gerente_relacionamento.v1",
  "enviado_em": "2026-11-16T16:00:00-03:00",
  "cliente": { "cpf": "12345678901", "email": "cliente@exemplo.com",
               "telefone": "5511999999999", "nome": "Nome do Cliente" },
  "gerente": { "nome": "Rebeca Carlos de Aguiar Saar",
               "telefone": "5524998165099" }
}

O que fazer ao receber:
1. Localizar o usuário pelo CPF (se não achar, pelo e-mail; depois telefone).
2. Gravar nome e telefone do gerente direto no cadastro desse usuário e
   exibir para o cliente como "Seu gerente de relacionamento".
3. Esse dado tem prioridade sobre qualquer distribuição de gerentes do
   HARVEY. Não redistribuir nem sobrescrever por regra interna.
4. Se chegar outro aviso para o mesmo cliente, o mais recente substitui
   o anterior (o gerente pode mudar).
5. Responder HTTP 200 quando gravar; 404 se o usuário não existir;
   401 se a assinatura for inválida. Qualquer outro erro: 4xx/5xx com
   mensagem curta no corpo. Reenviamos os que falharem.

Faremos uma carga inicial com todos os clientes que já têm gerente,
assim que vocês confirmarem que o aviso está pronto.
```

## Detalhes técnicos
- Dados: UPDATE em `employees.telefone` (por profile_id dos gerentes).
- `consultar-jornada`: buscar `owner_profile_id` do deal → profiles.full_name + employees.telefone.
- Nova tabela `pos_venda_harvey_gerente_envios` (deal_id, gerente_id, status, http_status, erro, payload) com grants/RLS admin.
- Nova edge `harvey-gerente-sync` (HMAC com HARVEY_WEBHOOK_SECRET, igual a harvey-relatorio-cota), chamada por trigger em `crm_deals` (origem Pós-venda, quando o dono muda) via pg_net; falha nunca bloqueia a mudança do cartão.
