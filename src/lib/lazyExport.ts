/**
 * Lazy loaders for heavy export libraries (xlsx, jspdf, jspdf-autotable).
 * These are only fetched the first time the user triggers an export,
 * keeping them out of the initial JS bundle.
 */
export const loadXLSX = () => import('xlsx');

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