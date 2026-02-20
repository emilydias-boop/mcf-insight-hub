import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface AssetQRCodeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetId: string;
  numeroPatrimonio: string;
}

export const AssetQRCode = ({ open, onOpenChange, assetId, numeroPatrimonio }: AssetQRCodeProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const url = `${window.location.origin}/patrimonio/${assetId}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const svgData = new XMLSerializer().serializeToString(svg);
    const base64 = btoa(unescape(encodeURIComponent(svgData)));
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 350;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 25, 25, 250, 250);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(numeroPatrimonio, 150, 310);
      }

      const a = document.createElement('a');
      a.download = `qr-${numeroPatrimonio}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = `data:image/svg+xml;base64,${base64}`;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);

    printWindow.document.write(`
      <html>
        <head><title>QR Code - ${numeroPatrimonio}</title></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;">
          ${svgData}
          <p style="font-size:18px;font-weight:bold;margin-top:16px;">${numeroPatrimonio}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>QR Code - {numeroPatrimonio}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div ref={qrRef} className="p-4 bg-white rounded-lg">
            <QRCodeSVG value={url} size={200} level="H" />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Escaneie para acessar os detalhes do equipamento
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
