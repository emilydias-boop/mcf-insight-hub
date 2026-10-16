import fluxoHtml from "@/content/fluxo-pos-venda.html?raw";

/**
 * Tela só de exibição: mostra o HTML do fluxo do Pós-venda dentro de um iframe.
 * Quem rola é o conteúdo do iframe (o html interno cuida do scroll).
 * Altura = janela menos o cabeçalho do app (h-14 = 56px) menos o padding da área útil.
 */
export default function FluxoPosVenda() {
  return (
    <iframe
      title="Fluxo do Pós-venda"
      srcDoc={fluxoHtml}
      sandbox="allow-scripts"
      className="w-full border-0"
      style={{ height: "calc(100vh - 96px)" }}
    />
  );
}
