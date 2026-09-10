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

export async function transcribeAudio(blob: Blob, filename: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, filename);
  const response = await fetch("/api/teklif/transcribe", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as { error?: string; text?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Ses çevrilemedi.");
  }
  return (payload.text ?? "").trim();
}
