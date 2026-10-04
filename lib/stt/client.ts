export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function recordingFilename(mimeType: string): string {
  if (mimeType.includes("mp4")) return "recording.m4a";
  if (mimeType.includes("ogg")) return "recording.ogg";
  return "recording.webm";
}

/** Longer than the server-side STT timeout, so its message wins when both fire. */
const TRANSCRIBE_TIMEOUT_MS = 30_000;

export async function transcribeAudio(blob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, filename);
  let response: Response;
  try {
    response = await fetch("/api/teklif/transcribe", {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error("Ses çevirme zaman aşımına uğradı. Tekrar deneyin.");
    }
    throw new Error("STT servisine bağlanılamadı.");
  }
  let payload: { error?: string; text?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    throw new Error(payload.error ?? "Ses çevrilemedi.");
  }
  return (payload.text ?? "").trim();
}
