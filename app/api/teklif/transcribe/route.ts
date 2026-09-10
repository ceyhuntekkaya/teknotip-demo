import { NextResponse } from "next/server";
import { getSttConfig, sttTranscribeUrl } from "@/lib/stt/config";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: "Ses isteği okunamadı." }, { status: 400 });
  }

  const file = incoming.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Ses kaydı yok." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ses kaydı çok büyük." }, { status: 413 });
  }

  const filename = file instanceof File && file.name ? file.name : "recording.webm";
  const outgoing = new FormData();
  outgoing.append("file", file, filename);

  const stt = getSttConfig();
  try {
    const response = await fetch(sttTranscribeUrl(stt), {
      method: "POST",
      body: outgoing,
      signal: AbortSignal.timeout(stt.timeoutMs),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `STT yanıt vermedi (${response.status}).` },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text : "";
    return NextResponse.json({ text });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        error: timedOut
          ? "STT zaman aşımına uğradı."
          : "STT servisine bağlanılamadı. STT_URL değerini kontrol edin.",
      },
      { status: 502 },
    );
  }
}
