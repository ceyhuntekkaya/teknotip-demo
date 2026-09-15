"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { ActionButton } from "@/components/catalog/fields";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { VoiceLevel } from "@/components/teklif/voice-level";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  chatWithQuote,
  createQuote,
  getQuoteById,
  updateQuote,
} from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  ProductResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { quoteToRequest } from "@/lib/api/map";
import {
  clearQuoteWorkspace,
  loadQuoteWorkspace,
  saveQuoteWorkspace,
} from "@/lib/quote/workspace";
import type { ChatMessage } from "@/lib/quote/types";
import { recordingFilename, transcribeAudio } from "@/lib/stt/client";
import {
  beginUtterance,
  createListenSession,
  destroyListenSession,
  listenSessionLive,
  type ListenSession,
  type UtteranceHandle,
  type UtteranceResult,
} from "@/lib/stt/listen";
import { voiceSettings } from "@/lib/stt/settings";
import { isUsableTranscript } from "@/lib/stt/vad";

export function QuoteBench({
  products,
  customers,
}: {
  products: ProductResponse[];
  customers: CustomerResponse[];
}) {
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceSession, setVoiceSession] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [speechHeard, setSpeechHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipSave = useRef(true);
  const aliveRef = useRef(true);
  const voiceSessionRef = useRef(false);
  const recordingRef = useRef(false);
  const loadingRef = useRef(false);
  const listenSessionRef = useRef<ListenSession | null>(null);
  const utteranceRef = useRef<UtteranceHandle | null>(null);
  const messagesRef = useRef(messages);
  const quoteRef = useRef(quote);
  const persistTimer = useRef<number | null>(null);
  const persistInFlight = useRef<Promise<void>>(Promise.resolve());
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const finishUtteranceRef = useRef<(result: UtteranceResult) => void>(() => {});

  messagesRef.current = messages;
  quoteRef.current = quote;

  const setSessionOpen = (open: boolean) => {
    voiceSessionRef.current = open;
    setVoiceSession(open);
  };

  const destroyListen = () => {
    utteranceRef.current = null;
    destroyListenSession(listenSessionRef.current);
    listenSessionRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    setSpeechHeard(false);
  };

  const shouldResumeVoice = () => {
    if (!aliveRef.current || !voiceSessionRef.current) return false;
    const field = inputRef.current;
    if (field?.value.trim()) return false;
    if (field && typeof window !== "undefined" && window.document.activeElement === field) {
      return false;
    }
    return true;
  };

  const persistQuote = useCallback(async (next: QuoteResponse) => {
    if (!next.id) return;
    const run = async () => {
      setSaving(true);
      try {
        const response = await updateQuote(next.id, quoteToRequest(next));
        if (response.status !== 200) {
          setError(apiErrorMessage(response.data, "Teklif kaydedilemedi."));
          return;
        }
        setQuote(response.data);
      } catch {
        setError("Teklif kaydedilemedi.");
      } finally {
        setSaving(false);
      }
    };
    persistInFlight.current = run();
    await persistInFlight.current;
  }, []);

  const flushPersist = useCallback(async () => {
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current);
      persistTimer.current = null;
      const current = quoteRef.current;
      if (current) {
        await persistQuote(current);
        return;
      }
    }
    await persistInFlight.current;
  }, [persistQuote]);

  const schedulePersist = (next: QuoteResponse) => {
    setQuote(next);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistQuote(next);
    }, 600);
  };

  useEffect(() => {
    const workspace = loadQuoteWorkspace();
    setMessages(workspace.messages);
    void (async () => {
      if (workspace.quoteId) {
        const existing = await getQuoteById(workspace.quoteId);
        if (existing.status === 200) {
          setQuote(existing.data);
          return;
        }
      }
      const created = await createQuote({});
      if (created.status === 201) {
        setQuote(created.data);
        saveQuoteWorkspace({
          version: 3,
          quoteId: created.data.id ?? null,
          messages: workspace.messages,
        });
      } else {
        setError(apiErrorMessage(created.data, "Teklif açılamadı."));
      }
    })();
  }, []);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveQuoteWorkspace({
      version: 3,
      quoteId: quote?.id ?? null,
      messages,
    });
  }, [quote?.id, messages]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      voiceSessionRef.current = false;
      utteranceRef.current?.stopManual();
      destroyListenSession(listenSessionRef.current);
      listenSessionRef.current = null;
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  const resetQuote = async () => {
    setMessages([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
    setSessionOpen(false);
    utteranceRef.current?.stopManual();
    destroyListen();
    clearQuoteWorkspace();
    const created = await createQuote({});
    if (created.status === 201) {
      setQuote(created.data);
      saveQuoteWorkspace({
        version: 3,
        quoteId: created.data.id ?? null,
        messages: [],
      });
    } else {
      setError(apiErrorMessage(created.data, "Yeni teklif açılamadı."));
    }
  };

  const send = async (override?: string, source: "typed" | "voice" = "typed") => {
    const text = (override ?? inputRef.current?.value ?? "").trim();
    if (!text) return;
    if (loadingRef.current) return;
    if (source === "typed" && (recordingRef.current || transcribing)) return;

    if (source === "typed") {
      setSessionOpen(false);
      utteranceRef.current?.stopManual();
      destroyListen();
      if (inputRef.current) inputRef.current.value = "";
    }

    const nextMessages: ChatMessage[] = [
      ...messagesRef.current,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      await flushPersist();
      const quoteId = quoteRef.current?.id;
      if (!quoteId) {
        setError("Teklif henüz açılmadı.");
        return;
      }
      const response = await chatWithQuote({ quoteId, message: text });
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "İstek başarısız."));
        return;
      }
      if (response.data.quote) {
        setQuote(response.data.quote);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.assistantMessage ?? "",
        },
      ]);
    } catch {
      setError("Bağlantı kurulamadı.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (source === "voice" && shouldResumeVoice()) {
        void startListeningRef.current();
      }
    }
  };

  const startListening = async () => {
    if (!aliveRef.current || !voiceSessionRef.current || recordingRef.current) return;
    try {
      let session = listenSessionRef.current;
      if (!session || !listenSessionLive(session)) {
        destroyListenSession(session);
        listenSessionRef.current = null;
        session = await createListenSession();
        listenSessionRef.current = session;
      } else {
        if (session.context.state !== "running") {
          await session.context.resume();
        }
        if (session.context.state !== "running") {
          destroyListenSession(session);
          listenSessionRef.current = null;
          session = await createListenSession();
          listenSessionRef.current = session;
        } else {
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 40);
          });
        }
      }
      if (!aliveRef.current || !voiceSessionRef.current) {
        destroyListen();
        return;
      }
      recordingRef.current = true;
      setRecording(true);
      setVoiceLevel(0);
      setSpeechHeard(false);
      utteranceRef.current = beginUtterance(
        session,
        (level, heard) => {
          if (!aliveRef.current) return;
          setVoiceLevel(level);
          if (heard) setSpeechHeard(true);
        },
        (result) => finishUtteranceRef.current(result),
      );
    } catch {
      setSessionOpen(false);
      destroyListen();
      setError("Mikrofona erişilemedi.");
    }
  };
  startListeningRef.current = startListening;

  const finishUtterance = (result: UtteranceResult) => {
    utteranceRef.current = null;
    recordingRef.current = false;
    setRecording(false);
    setVoiceLevel(0);
    if (!aliveRef.current) return;

    if (result.reason === "manual") {
      setSessionOpen(false);
      destroyListen();
    }

    if (!result.speechSeen || result.blob.size === 0) {
      if (result.speechSeen && result.blob.size === 0) {
        setError("Ses kaydı boş.");
      }
      if (shouldResumeVoice()) void startListening();
      return;
    }

    void (async () => {
      setTranscribing(true);
      setError(null);
      try {
        const text = await transcribeAudio(
          result.blob,
          recordingFilename(result.mimeType),
        );
        if (!aliveRef.current) return;
        if (!isUsableTranscript(text)) {
          setError("Ses anlaşılamadı. Tekrar deneyin.");
          setTranscribing(false);
          if (shouldResumeVoice()) void startListening();
          return;
        }
        setTranscribing(false);
        await send(text, "voice");
      } catch (caught) {
        if (!aliveRef.current) return;
        setError(
          caught instanceof Error ? caught.message : "STT servisine bağlanılamadı.",
        );
        if (shouldResumeVoice()) void startListening();
      } finally {
        setTranscribing(false);
      }
    })();
  };
  finishUtteranceRef.current = finishUtterance;

  const toggleSpeak = async () => {
    if (recordingRef.current) {
      setSessionOpen(false);
      utteranceRef.current?.stopManual();
      return;
    }
    if (voiceSessionRef.current && (loading || transcribing)) {
      setSessionOpen(false);
      return;
    }
    if (loading || transcribing) return;
    setError(null);
    setSessionOpen(true);
    await startListening();
  };

  const speakDisabled = (loading || transcribing) && !voiceSession && !recording;
  const speakOpen = recording || voiceSession;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Genixo
          </p>
          <h1 className="font-display text-3xl leading-none tracking-wide">Teklif</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/products"
            className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Katalog
          </Link>
          <Link
            href="/musteriler"
            className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Müşteriler
          </Link>
          <Link
            href="/quotes"
            className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Teklifler
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[minmax(0,22rem)_1fr] lg:overflow-hidden xl:grid-cols-[minmax(0,28rem)_1fr]">
        <section className="flex h-[min(70dvh,40rem)] min-h-0 flex-col overflow-hidden border border-[var(--rule)] bg-[var(--paper)] lg:h-full">
          <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
                Sohbet
              </p>
              <h2 className="font-display text-2xl leading-none tracking-wide">İstek</h2>
            </div>
            <ActionButton
              type="button"
              disabled={loading || recording || transcribing}
              onClick={() => void resetQuote()}
            >
              Yeni teklif
            </ActionButton>
          </header>
          <div
            ref={scroller}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
          >
            {messages.length === 0 ? (
              <p className="text-sm text-[var(--steel)]">
                Örnek: “CVD fırın olsun, sıcaklık 1400, çap 60 mm.”
              </p>
            ) : (
              messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`grid gap-1.5 text-sm ${
                    message.role === "user" ? "text-[var(--charcoal)]" : ""
                  }`}
                >
                  <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
                    {message.role === "user" ? "Siz" : "Asistan"}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </article>
              ))
            )}
            {loading ? (
              <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--heat)]">
                Yanıt bekleniyor
              </p>
            ) : null}
          </div>
          <form
            className="grid shrink-0 gap-2 border-t border-[var(--rule)] p-3"
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            {error ? <p className="text-xs text-[#8f2d1f]">{error}</p> : null}
            {speakOpen ? (
              <VoiceLevel level={voiceLevel} active={recording} />
            ) : null}
            <textarea
              ref={inputRef}
              rows={3}
              placeholder="Ürün, özellik veya değişiklik yazın"
              disabled={recording || transcribing}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="w-full resize-none border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--heat)] disabled:opacity-60"
            />
            <p className="text-xs text-[var(--steel)]">
              {recording
                ? speechHeard
                  ? `Konuşma alındı. ${voiceSettings.silenceSeconds} sn sessizlikte gönderilir; Durdur oturumu kapatır.`
                  : `Dinleniyor. Konuşunca ${voiceSettings.silenceSeconds} sn sessizlikte gönderilir; Durdur oturumu kapatır.`
                : transcribing
                  ? "Ses yazıya çevriliyor…"
                  : loading && voiceSession
                    ? "Yanıt bekleniyor — dinleme yanıtta sürecek"
                    : "Yazabilir veya konuşabilirsiniz. Ses kaydı saklanmaz."}
            </p>
            <div className="flex items-center justify-between gap-2">
              <ActionButton
                tone={speakOpen ? "danger" : "default"}
                disabled={speakDisabled}
                type="button"
                onClick={() => void toggleSpeak()}
              >
                {speakOpen ? "Durdur" : "Konuş"}
              </ActionButton>
              <ActionButton
                tone="heat"
                disabled={loading || recording || transcribing}
                type="button"
                onClick={() => void send()}
              >
                Gönder
              </ActionButton>
            </div>
          </form>
        </section>

        <QuoteDocumentPanel
          quote={quote}
          products={products}
          customers={customers}
          saving={saving}
          emptyHint="Düzenlemeden ürün ekleyin veya soldan bir istek yazın."
          onChange={schedulePersist}
        />
      </div>
    </div>
  );
}
