import { QRCodeSVG } from "qrcode.react";

/**
 * QRCodeDisplay renders the bag code as a scannable QR. Scanning performs a
 * *lookup only* — it never triggers custody or weighing actions.
 */
export function QRDisplay({ value, size = 132 }: { value: string; size?: number }) {
  return (
    <div className="rounded-lg border bg-white p-3" title={`Bag QR: ${value}`}>
      <QRCodeSVG value={value} size={size} level="M" />
      <p className="mt-2 text-center id-mono text-foreground/80">{value}</p>
    </div>
  );
}
