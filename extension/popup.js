const TV_URL = "https://mcfgestao.com/bi/consorcio?k=c6009ecc80511bdf3cec8ec7f8debc1308c0";

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("openBtn");
  const copyBtn = document.getElementById("copyBtn");
  const msg = document.getElementById("msg");

  openBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: TV_URL, active: true });
    window.close();
  });

  copyBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(TV_URL);
      if (msg) msg.textContent = "Link copiado!";
      setTimeout(() => { if (msg) msg.textContent = ""; }, 2000);
    } catch (err) {
      if (msg) msg.textContent = "Não foi possível copiar.";
    }
  });
});
