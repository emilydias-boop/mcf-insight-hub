import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import closer1 from "@/assets/campanha/closer1.asset.json";
import closer2 from "@/assets/campanha/closer2.asset.json";
import sdr1 from "@/assets/campanha/sdr1.asset.json";
import sdr2 from "@/assets/campanha/sdr2.asset.json";

interface Person { name?: string; url: string }

const FALLBACK_CLOSERS: Person[] = [
  { name: "André Duarte", url: closer1.url },
  { name: "Closer", url: closer2.url },
];
const FALLBACK_SDRS: Person[] = [
  { name: "SDR", url: sdr1.url },
  { name: "SDR", url: sdr2.url },
];

// Duração total ~20s por bloco. Cada foto ~2s.
const PHOTO_MS = 2000;
const BLOCK_MS = 20000;

interface Props {
  onClose: () => void;
}

export function CampaignCarousel({ onClose }: Props) {
  const [phase, setPhase] = useState<"closer" | "sdr">("closer");
  const [idx, setIdx] = useState(0);

  const { data } = useQuery({
    queryKey: ["campaign-carousel"],
    queryFn: async () => {
      const { data: c } = await supabase
        .from("campaigns")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!c) return null;
      const { data: parts } = await supabase
        .from("campaign_participants")
        .select("*")
        .eq("campaign_id", c.id)
        .order("sort_order");
      return { campaign: c, participants: parts ?? [] };
    },
  });

  const { closers, sdrs, closerPrize, sdrPrize, closerQ, sdrQ } = useMemo(() => {
    if (!data?.campaign) {
      return {
        closers: FALLBACK_CLOSERS,
        sdrs: FALLBACK_SDRS,
        closerPrize: "R$ 5.000,00",
        sdrPrize: "R$ 3.000,00",
        closerQ: "Quem vai levar",
        sdrQ: "Quem vai levar",
      };
    }
    const toPerson = (p: any): Person => ({
      name: p.name,
      url: p.photo_path
        ? supabase.storage.from("campaign-photos").getPublicUrl(p.photo_path).data.publicUrl
        : "",
    });
    const cl = data.participants.filter((p: any) => p.role === "closer").map(toPerson).filter((p: Person) => p.url);
    const sd = data.participants.filter((p: any) => p.role === "sdr").map(toPerson).filter((p: Person) => p.url);
    return {
      closers: cl.length ? cl : FALLBACK_CLOSERS,
      sdrs: sd.length ? sd : FALLBACK_SDRS,
      closerPrize: data.campaign.closer_prize || "R$ 5.000,00",
      sdrPrize: data.campaign.sdr_prize || "R$ 3.000,00",
      closerQ: data.campaign.closer_question || "Quem vai levar",
      sdrQ: data.campaign.sdr_question || "Quem vai levar",
    };
  }, [data]);

  const list = phase === "closer" ? closers : sdrs;
  const prize = phase === "closer" ? closerPrize : sdrPrize;
  const role = phase === "closer" ? "Closer" : "SDR";
  const question = phase === "closer" ? closerQ : sdrQ;

  // ciclo de fotos
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), PHOTO_MS);
    return () => clearInterval(t);
  }, [list.length]);

  // troca fase closer -> sdr
  useEffect(() => {
    const t = setTimeout(() => {
      setIdx(0);
      setPhase("sdr");
    }, BLOCK_MS);
    return () => clearTimeout(t);
  }, []);

  // encerra após bloco de SDR
  useEffect(() => {
    if (phase !== "sdr") return;
    const t = setTimeout(onClose, BLOCK_MS);
    return () => clearTimeout(t);
  }, [phase, onClose]);

  const person = list[idx % Math.max(1, list.length)];
  if (!person) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#050505]/95 backdrop-blur-xl animate-fade-in">
      {/* glow bg */}
      <div className="absolute inset-0 opacity-60 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#bfff00] blur-[200px] animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-fuchsia-600 blur-[220px] animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Header campanha */}
      <div className="relative z-10 text-center mb-10 px-8">
        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-[#bfff00]/20 border border-[#bfff00]/40 mb-6">
          <Sparkles className="w-5 h-5 text-[#bfff00]" />
          <span className="text-[#bfff00] font-bold tracking-widest uppercase text-sm">
            Campanha do Mês
          </span>
          <Sparkles className="w-5 h-5 text-[#bfff00]" />
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white leading-none">
          {question}
        </h1>
        <div className="mt-4 text-7xl md:text-9xl font-black text-[#bfff00] drop-shadow-[0_0_40px_rgba(191,255,0,0.6)]">
          {prize}
        </div>
        <div className="mt-2 text-2xl md:text-3xl text-white/70 font-semibold">
          para o melhor <span className="text-[#bfff00]">{role}</span> do mês?
        </div>
      </div>

      {/* Carrossel de foto */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-[#bfff00] via-emerald-400 to-fuchsia-500 blur-2xl opacity-70 animate-pulse" />
          <div
            key={`${phase}-${idx}`}
            className="relative w-[420px] h-[420px] md:w-[520px] md:h-[520px] rounded-full overflow-hidden border-[6px] border-[#bfff00] shadow-[0_0_80px_rgba(191,255,0,0.6)] animate-scale-in"
          >
            <img
              src={person.url}
              alt={person.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -top-4 -right-4 bg-[#bfff00] text-black rounded-full p-4 shadow-2xl animate-pulse">
            <Trophy className="w-10 h-10" />
          </div>
        </div>
      </div>

      {/* dots */}
      <div className="relative z-10 mt-8 flex gap-3">
        {list.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === idx ? "w-10 bg-[#bfff00]" : "w-2 bg-white/30"
            }`}
          />
        ))}
      </div>

      <button
        onClick={onClose}
        className="absolute bottom-8 right-8 z-20 text-white/50 hover:text-white text-sm underline"
      >
        fechar
      </button>
    </div>
  );
}