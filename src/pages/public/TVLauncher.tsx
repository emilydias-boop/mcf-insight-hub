import { useEffect } from "react";

const TV_URL = "/bi/consorcio?k=c6009ecc80511bdf3cec8ec7f8debc1308c0";

export default function TVLauncher() {
  useEffect(() => {
    window.location.replace(TV_URL);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-[#bfff00] border-t-transparent rounded-full mx-auto" />
        <p className="text-lg font-medium">Abrindo TV MCF Consórcio...</p>
        <p className="text-sm text-muted-foreground">
          Se não redirecionar automaticamente,{" "}
          <a href={TV_URL} className="text-[#bfff00] underline">
            clique aqui
          </a>
          .
        </p>
      </div>
    </div>
  );
}
