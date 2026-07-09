import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BIConsorcioPublic from "./BIConsorcioPublic";
import BIIncorporadorPublic from "./BIIncorporadorPublic";

const ROTATION_MS = 20000;

export default function BITVRotativo() {
  const [sp] = useSearchParams();
  const kConsorcio = sp.get("kc") || sp.get("k") || "";
  const kIncorporador = sp.get("ki") || "";
  const intervalMs = Number(sp.get("intervalo")) * 1000 || ROTATION_MS;

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % 2), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  if (!kConsorcio || !kIncorporador) {
    return (
      <div className="fixed inset-0 bg-[#050505] text-white flex flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="text-4xl font-black text-[#bfff00]">Chaves ausentes</div>
        <div className="text-white/70">
          Use ?kc=CHAVE_CONSORCIO&amp;ki=CHAVE_INCORPORADOR
        </div>
      </div>
    );
  }

  return idx === 0 ? (
    <BIConsorcioPublic key="consorcio" tokenOverride={kConsorcio} />
  ) : (
    <BIIncorporadorPublic key="incorporador" tokenOverride={kIncorporador} />
  );
}
