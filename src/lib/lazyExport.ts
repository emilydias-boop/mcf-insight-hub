/**
 * Lazy loaders for heavy export libraries (xlsx, jspdf, jspdf-autotable).
 * These are only fetched the first time the user triggers an export,
 * keeping them out of the initial JS bundle.
 */
export const loadXLSX = () => import('xlsx');

/**
 * Baixa um workbook de forma robusta.
 * XLSX.writeFile depende de um clique em <a download>, que é bloqueado quando a
 * aplicação roda dentro de um iframe sem permissão de download (ex.: preview).
 * Aqui geramos o Blob e, se o clique não resultar em download, abrimos o arquivo
 * numa nova aba como fallback.
 */
export async function downloadWorkbook(XLSX: any, wb: any, filename: string) {
  const data: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (!inIframe) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    // Dentro de iframe: abrir em nova aba (o navegador faz o download de lá)
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const loadJsPDF = async () => {
  const [jsPDFModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return {
    jsPDF: jsPDFModule.default,
    autoTable: autoTableModule.default,
  };
};