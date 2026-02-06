
# Filtro de Busca na Agenda R2 - IMPLEMENTADO ✅

## Funcionalidade
Campo de busca por nome/email/telefone na Agenda R2 para encontrar leads rapidamente.

## Localização
Barra de filtros da página `src/pages/crm/AgendaR2.tsx`, ao lado dos seletores de Closer, Status e R1 Closer.

## Comportamento
- Busca em tempo real (mínimo 2 caracteres)
- Case-insensitive para texto
- Normaliza telefones (apenas dígitos)
- Busca em: nome do attendee, email do contato, telefone do attendee/contato, nome do deal
- Funciona em conjunto com todos os outros filtros
