"use client";

import { useEffect, useRef, useState } from "react";

/**
 * アプリ内QRリーダー — 端末のカメラアプリだと「ログインしていないブラウザ」で開いてしまうため、
 * 名刺交換はログイン済みのアプリの中で読み取れるようにする。
 */
export function QrScanner({ onFound, onClose }: { onFound: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    stopRef.current = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();
        const jsQR = (await import("jsqr")).default;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = () => {
          if (stopRef.current || !videoRef.current || !ctx) return;
          const vw = videoRef.current.videoWidth;
          const vh = videoRef.current.videoHeight;
          if (vw && vh) {
            canvas.width = vw;
            canvas.height = vh;
            ctx.drawImage(videoRef.current, 0, 0, vw, vh);
            const img = ctx.getImageData(0, 0, vw, vh);
            const code = jsQR(img.data, vw, vh);
            if (code?.data) {
              stopRef.current = true;
              onFound(code.data);
              return;
            }
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        setErr("カメラを起動できませんでした。ブラウザのカメラ許可を確認してください");
      }
    })();
    return () => {
      stopRef.current = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[140] flex flex-col items-center justify-center bg-black/85 px-6">
      <p className="mb-3 text-[13.5px] font-extrabold text-white">相手の名刺交換QRを写してください</p>
      {err ? (
        <p className="rounded-xl bg-white px-4 py-3 text-[12.5px] font-bold text-[#c05030]">{err}</p>
      ) : (
        <video ref={videoRef} playsInline muted className="w-full max-w-[340px] rounded-2xl" style={{ aspectRatio: "1", objectFit: "cover" }} />
      )}
      <button onClick={onClose} className="mt-4 rounded-full bg-white/15 px-6 py-2.5 text-[13px] font-bold text-white">とじる</button>
    </div>
  );
}
