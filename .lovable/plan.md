

# Corrigir Nomes dos 5 Leads com CPF

## Problema
5 contatos e deals foram salvos com CPF no lugar do nome durante importacao por planilha.

## Correcao
Usar o insert tool (UPDATE) para corrigir tanto `crm_contacts.name` quanto `crm_deals.name` dos 5 registros.

Nomes derivados dos emails:
- 82778485520 → **Hernani Costa**
- 05910937405 → **Marcia** (confirmar sobrenome com usuario)
- 40923895825 → **Flavia Rodrigues**
- 01414776446 → **Lidyana Wanessa**
- 84181966100 → **Ronaldo Forasteiro**

### Execucao
2 UPDATEs por registro (contato + deal), total 10 statements.

### Confirmacao necessaria
O nome "Marcia" (email smarcia01@hotmail.com) esta incompleto — voce sabe o nome completo dela?

