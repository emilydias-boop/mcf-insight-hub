

## Adicionar busca de lead na Agenda R1

### O que sera feito

Adicionar um campo de busca "Buscar lead..." na area de filtros da Agenda R1 (`src/pages/crm/Agenda.tsx`), identico ao que ja existe na Agenda R2, permitindo localizar reunioes por nome, telefone ou email do participante.

### Alteracoes

**`src/pages/crm/Agenda.tsx`**

1. Importar `Search` do `lucide-react` e `Input` do `@/components/ui/input`
2. Adicionar estado `searchTerm` (string, inicialmente vazio)
3. Na area de filtros (linha ~313, ao lado dos selects de closer e status), adicionar o campo de busca:
   - Input com icone de lupa, placeholder "Buscar lead...", largura 200px
4. No `filteredMeetings` useMemo (linhas 96-119), adicionar filtro por `searchTerm`:
   - Se `searchTerm` tiver 2+ caracteres, filtrar reunioes onde algum attendee tenha nome, telefone ou email correspondente (mesma logica da R2)

### Logica de busca (igual a R2)

```
if (searchTerm.length >= 2) {
  const search = searchTerm.toLowerCase();
  const searchDigits = searchTerm.replace(/\D/g, '');
  result = result.filter(m =>
    m.attendees?.some(att => {
      const name = (att.attendee_name || '').toLowerCase();
      const phone = (att.attendee_phone || '').replace(/\D/g, '');
      return name.includes(search) || 
             (searchDigits.length >= 2 && phone.includes(searchDigits));
    })
  );
}
```

### Resultado

O usuario podera digitar o nome ou telefone de um lead na Agenda R1 e ver apenas as reunioes correspondentes no calendario, lista ou visao por closer.
