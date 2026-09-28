/** Remove caracteres que quebram o filtro `.or()` do PostgREST. */
export const sanitizarTermoBusca = (termo: string): string =>
  (termo || '').replace(/[,()%]/g, ' ').trim();

/**
 * Filtro `.or()` para `crm_contacts` por nome, e-mail, telefone e
 * contatos alternativos (`aliases_busca`, mantida por trigger — só leitura).
 */
export const orContatoPorTermo = (termo: string): string => {
  const t = sanitizarTermoBusca(termo);
  return `name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%,aliases_busca.ilike.%${t}%`;
};
