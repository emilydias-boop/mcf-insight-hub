# Texto para pedir ao HARVEY o recebimento do gerente de relacionamento

Nada será alterado no sistema. Copie o texto abaixo e envie ao time/projeto do HARVEY.

```text
Precisamos que o HARVEY receba e exiba, para cada cliente, o nome e o telefone do gerente de relacionamento definido pelo MCF Gestão.

1. Criar um NOVO endereço de webhook, exclusivo para essa informação (não usar o webhook do Relatório da Cota). Nos passar:
   - a URL desse endpoint (método POST, JSON);
   - um segredo compartilhado para validar a assinatura.

2. Validação: cada envio traz o cabeçalho X-MCF-Signature = HMAC-SHA256 (hex) do corpo bruto da requisição, usando o segredo compartilhado. Se a assinatura não conferir, responder 401 e não gravar nada.

3. Formato do corpo recebido:
{
  "tipo": "pos_venda.gerente_relacionamento.v1",
  "enviado_em": "2026-11-16T19:37:00.000Z",
  "cliente": { "cpf": "00000000000", "email": "cliente@exemplo.com", "telefone": "5511999999999", "nome": "Nome do Cliente" },
  "gerente": { "nome": "Nome do Gerente", "telefone": "5511999999999" }
}
Qualquer campo do cliente pode vir nulo.

4. Localizar o usuário no HARVEY nesta ordem: CPF; se não achar, e-mail; se não achar, telefone (comparar os últimos 9 dígitos).

5. Gravar o nome e o telefone do gerente DIRETO no cadastro desse usuário, e exibir para o cliente como "Seu gerente de relacionamento" (nome + telefone, com link de WhatsApp).
   - Essa informação tem prioridade sobre qualquer distribuição/atribuição de gerentes feita pelo próprio HARVEY. Não recalcular nem sobrescrever por regra interna.
   - Sempre que chegar um envio novo para o mesmo cliente, ele substitui o anterior (o mais recente vale).

6. Respostas esperadas:
   - 200: gravado com sucesso;
   - 404: usuário não encontrado no HARVEY;
   - 401: assinatura inválida;
   - 400: corpo inválido.
   Responder em até 10 segundos.

7. Quando o endpoint estiver pronto, faremos uma carga inicial com todos os clientes que já têm gerente; depois, os envios acontecem automaticamente quando o gerente do cliente muda.
```

## Depois que o HARVEY responder

Quando receber a URL e o segredo, me envie e eu cadastro, faço o envio inicial e confiro os retornos.
