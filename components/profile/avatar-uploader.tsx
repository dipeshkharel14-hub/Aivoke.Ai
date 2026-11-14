"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT = 10 * 1024 * 1024; // picked photo; what is UPLOADED is a ~512px image, capped at 2 MB (enforced again on the server)
const MAX_UPLOAD = 2 * 1024 * 1024;

type Props = { url: string | null; initial: string; onChange: (url: string | null) => void };

export function AvatarUploader({ url, initial, onChange }: Props) {
  const { toast } = useToast();
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);

  function sourceRect(im: HTMLImageElement) {
    const side = Math.min(im.naturalWidth, im.naturalHeight) / zoom;
    const maxX = im.naturalWidth - side, maxY = im.naturalHeight - side;
    return { side, sx: maxX / 2 + (ox / 100) * (maxX / 2), sy: maxY / 2 + (oy / 100) * (maxY / 2) };
  }
  function draw(c: HTMLCanvasElement, size: number) {
    if (!img) return;
    const { side, sx, sy } = sourceRect(img);
    c.width = size; c.height = size;
    c.getContext("2d")?.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  }
  useEffect(() => { if (canvas.current) draw(canvas.current, 256); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [img, zoom, ox, oy]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError("Use a JPG, PNG or WebP image.");
    if (f.size > MAX_INPUT) return setError("Choose a photo under 10 MB.");
    const im = new Image();
    const objUrl = URL.createObjectURL(f);
    im.onload = () => { URL.revokeObjectURL(objUrl); setZoom(1); setOx(0); setOy(0); setImg(im); };
    im.onerror = () => { URL.revokeObjectURL(objUrl); setError("That image could not be read."); };
    im.src = objUrl;
  }

  async function upload() {
    if (!img) return;
    setBusy(true); setError(null);
    try {
      const out = document.createElement("canvas");
      draw(out, 512);
      let blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/webp", 0.85));
      if (!blob || blob.size > MAX_UPLOAD) blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.8));
      if (!blob || blob.size > MAX_UPLOAD) throw new Error("Image is still larger than 2 MB");
      const body = new FormData();
      body.append("file", blob, "avatar");
      const res = await fetch("/api/avatar", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      onChange(data.url);
      setImg(null);
      toast("Photo uploaded");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setError(null);
    const res = await fetch("/api/avatar", { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "Could not remove the photo");
    onChange(null);
    toast("Photo removed");
  }

  return (
    <div>
      <p className="text-sm font-semibold">Profile photo</p>
      {img ? (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <canvas ref={canvas} className="h-32 w-32 rounded-full border border-border" aria-label="Photo preview" />
          <div className="flex-1 space-y-2 text-sm">
            <label className="block">Zoom<input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(+e.target.value)} className="w-full" /></label>
            <label className="block">Move left or right<input type="range" min={-100} max={100} value={ox} onChange={(e) => setOx(+e.target.value)} className="w-full" /></label>
            <label className="block">Move up or down<input type="range" min={-100} max={100} value={oy} onChange={(e) => setOy(+e.target.value)} className="w-full" /></label>
            <div className="flex gap-2 pt-1">
              <button type="button" className="btn btn-primary" onClick={upload} disabled={busy}>{busy ? "Uploading" : "Upload photo"}</button>
              <button type="button" className="btn btn-secondary" onClick={() => setImg(null)} disabled={busy}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-4">
          {url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="Your current profile photo" width={80} height={80} className="h-20 w-20 rounded-full border border-border object-cover" />
            : <span aria-hidden className="grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-2xl font-bold text-accent-text">{initial}</span>}
          <div className="flex flex-wrap gap-2">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} id="avatar-file" />
            <label htmlFor="avatar-file" className="btn btn-secondary cursor-pointer">{url ? "Change photo" : "Choose photo"}</label>
            {url && <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Remove</button>}
          </div>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">JPG, PNG or WebP. We crop to a square and resize to 512 px.</p>
      {error && <p role="alert" className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
