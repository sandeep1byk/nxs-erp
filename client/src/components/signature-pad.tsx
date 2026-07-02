import { useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";

export function SignatureCapture({ value, onChange }: { value?: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    const pad = new SignaturePad(canvas, { penColor: "#0c1125", backgroundColor: "#ffffff" });
    padRef.current = pad;
    if (value) pad.fromDataURL(value);
    pad.addEventListener("endStroke", () => onChange(pad.toDataURL()));
    return () => pad.off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => { padRef.current?.clear(); onChange(""); };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Signature</div>
      <canvas ref={canvasRef} className="w-full h-40 rounded-md border border-input bg-white" />
      <Button type="button" size="sm" variant="outline" onClick={clear}>Clear signature</Button>
    </div>
  );
}
