"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/catalog/fields";
import {
  QuotePdfPanel,
  quotePdfFilename,
} from "@/components/pdf/quote-pdf-panel";
import { QuoteEditPane } from "@/components/quote/quote-edit-pane";
import { VoiceLevel } from "@/components/teklif/voice-level";
import { formatAddOn, formatTry } from "@/lib/catalog/price";
import type { Catalog } from "@/lib/catalog/types";
import type { MissingSlot } from "@/lib/catalog/rules";
import { emptyDraft } from "@/lib/quote/draft";
import { applyQuoteEdit } from "@/lib/quote/edit";
import { hydrateQuote } from "@/lib/quote/hydrate";
import {
  clearQuoteSession,
  emptyQuoteSession,
  loadQuoteSession,
  QUOTE_SESSION_VERSION,
  saveQuoteSession,
} from "@/lib/quote/session";
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
import type {
  ApplyWarning,
  ChatAction,
  ChatMessage,
  ConversationFocus,
  QuoteDocument,
  QuoteDraft,
} from "@/lib/quote/types";

export function QuoteBench({ catalog }: { catalog: Catalog }) {
  const [draft, setDraft] = useState<QuoteDraft>({ quoteNumber: "", items: [] });
  const [document, setDocument] = useState<QuoteDocument | null>(null);
  const [missing, setMissing] = useState<MissingSlot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [focus, setFocus] = useState<ConversationFocus>({});
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceSession, setVoiceSession] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [speechHeard, setSpeechHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfQuote, setPdfQuote] = useState<QuoteDocument | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"quote" | "edit">("quote");
  const [editWarnings, setEditWarnings] = useState<ApplyWarning[]>([]);
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
  const draftRef = useRef(draft);
  const focusRef = useRef(focus);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const finishUtteranceRef = useRef<(result: UtteranceResult) => void>(() => {});

  messagesRef.current = messages;
  draftRef.current = draft;
  focusRef.current = focus;

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

  useEffect(() => {
    const saved = loadQuoteSession();
    if (saved) {
      setDraft(saved.draft);
      setDocument(saved.document);
      setMissing(saved.missing);
      setMessages(saved.messages);
      setFocus(saved.focus ?? {});
    }
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveQuoteSession({
      version: QUOTE_SESSION_VERSION,
      draft,
      document,
      missing,
      messages,
      focus,
    });
  }, [draft, document, missing, messages, focus]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      voiceSessionRef.current = false;
      utteranceRef.current?.stopManual();
      destroyListenSession(listenSessionRef.current);
      listenSessionRef.current = null;
    };
  }, []);

  const resetQuote = () => {
    const next = emptyQuoteSession();
    setDraft(next.draft);
    setDocument(next.document);
    setMissing(next.missing);
    setMessages(next.messages);
    setFocus(next.focus);
    setError(null);
    setPdfQuote(null);
    setPdfUrl(null);
    setRightView("quote");
    setEditWarnings([]);
    if (inputRef.current) inputRef.current.value = "";
    setSessionOpen(false);
    utteranceRef.current?.stopManual();
    destroyListen();
    clearQuoteSession();
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
    const currentDraft = draftRef.current;
    const outgoingDraft: QuoteDraft = {
      quoteNumber: currentDraft.quoteNumber || emptyDraft().quoteNumber,
      items: currentDraft.items,
      quotedTo: currentDraft.quotedTo,
    };
    setMessages(nextMessages);
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/teklif/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          draft: outgoingDraft,
          focus: focusRef.current,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        reply?: string;
        draft?: QuoteDraft;
        document?: QuoteDocument;
        missing?: MissingSlot[];
        warnings?: ApplyWarning[];
        focus?: ConversationFocus;
      };
      if (!response.ok) {
        setError(payload.error ?? "İstek başarısız.");
        return;
      }
      if (payload.draft) setDraft(payload.draft);
      if (payload.document) setDocument(payload.document);
      setMissing(payload.missing ?? []);
      setFocus(payload.focus ?? {});
      setPdfQuote(null);
      setPdfUrl(null);
      setEditWarnings([]);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload.reply ?? "",
          warnings: payload.warnings,
        },
      ]);
      requestAnimationFrame(() => {
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
      });
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

  const applyEdit = (actions: ChatAction[]) => {
    const result = applyQuoteEdit(catalog, draft, actions, focus);
    setDraft(result.draft);
    setDocument(result.document);
    setMissing(result.missing);
    setFocus(result.focus);
    setEditWarnings(result.warnings);
    setPdfQuote(null);
    setPdfUrl(null);
  };

  const quote = hydrateQuote(
    catalog,
    draft,
    document?.quotedTo.date
      ? new Date(`${document.quotedTo.date}T12:00:00`)
      : new Date(),
  );
  const speakDisabled = (loading || transcribing) && !voiceSession && !recording;
  const speakOpen = recording || voiceSession;
  const showingPdf = pdfQuote !== null;
  const editing = rightView === "edit";
  const handlePdfUrl = useCallback((url: string | null) => {
    setPdfUrl(url);
  }, []);
  const closePdf = () => {
    setPdfQuote(null);
    setPdfUrl(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Genixo
          </p>
          <h1 className="font-display text-3xl leading-none tracking-wide">Teklif</h1>
        </div>
        <Link
          href="/data-json"
          className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
        >
          Katalog
        </Link>
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
              onClick={resetQuote}
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
                  {message.warnings?.length ? (
                    <ul className="grid gap-1 text-xs text-[#8f2d1f]">
                      {message.warnings.map((warning, warningIndex) => (
                        <li key={`${warning.op}-${warningIndex}`}>{warning.message}</li>
                      ))}
                    </ul>
                  ) : null}
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

        <section className="flex min-h-[24rem] flex-col overflow-hidden border border-[var(--rule)] bg-[var(--paper)] lg:h-full lg:min-h-0">
          <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
                Belge
              </p>
              <h2 className="font-display text-2xl leading-none tracking-wide">
                {editing ? "Düzenleme" : "Teklif"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <p className="font-mono text-xs text-[var(--steel)]">
                {draft.quoteNumber || "—"}
              </p>
              {showingPdf ? (
                <>
                  {pdfUrl ? (
                    <a
                      href={pdfUrl}
                      download={quotePdfFilename(pdfQuote.quotedTo.quoteNumber)}
                      className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
                    >
                      İndir
                    </a>
                  ) : null}
                  <ActionButton type="button" onClick={closePdf}>
                    Geri Dön
                  </ActionButton>
                </>
              ) : (
                <>
                  <ActionButton
                    type="button"
                    onClick={() =>
                      setRightView((current) => (current === "edit" ? "quote" : "edit"))
                    }
                  >
                    {editing ? "Teklif Görünümü" : "Düzenleme Görünümü"}
                  </ActionButton>
                  <ActionButton
                    tone="heat"
                    type="button"
                    disabled={quote.products.length === 0}
                    onClick={() => setPdfQuote(quote)}
                  >
                    PDF Yap
                  </ActionButton>
                </>
              )}
            </div>
          </header>

          {showingPdf ? (
            <QuotePdfPanel quote={pdfQuote} onUrl={handlePdfUrl} />
          ) : editing ? (
            <QuoteEditPane
              catalog={catalog}
              draft={draft}
              quote={quote}
              missing={missing}
              warnings={editWarnings}
              onActions={applyEdit}
            />
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                {missing.length ? (
                  <div className="mb-4 flex flex-wrap gap-1.5">
                    {missing.map((slot) => (
                      <span
                        key={`${slot.groupId}-${slot.propertyId ?? "group"}`}
                        className="bg-[var(--heat)]/15 px-2 py-1 font-display text-[11px] uppercase tracking-[0.12em] text-[var(--heat)]"
                      >
                        Eksik: {slot.label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {quote.products.length === 0 ? (
                  <p className="grid place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
                    Soldan bir ürün isteyin.
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {quote.products.map((product) => (
                      <article
                        key={product.lineId}
                        className="border border-[var(--rule)]"
                      >
                        <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                          <div>
                            <h3 className="font-display text-lg uppercase tracking-[0.08em]">
                              {product.name}
                            </h3>
                            <p className="text-sm text-[var(--steel)]">
                              {product.modelName} · {product.quantity} adet
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
                              Birim
                            </p>
                            <p className="font-mono text-sm text-[var(--heat)]">
                              {formatTry(product.basePrice)}
                            </p>
                            {product.lineTotal !== product.basePrice ? (
                              <p className="font-mono text-xs text-[var(--steel)]">
                                {formatTry(product.lineTotal)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        {product.propertyGroups.map((group) => (
                          <div
                            key={group.id}
                            className="border-t border-[var(--rule)] px-3 py-2"
                          >
                            <p className="mb-1.5 font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
                              {group.name}
                            </p>
                            <ul className="grid gap-1">
                              {group.properties.map((property, index) => (
                                <li
                                  key={`${property.id}-${property.choiceId ?? index}`}
                                  className="flex items-baseline justify-between gap-3 text-sm"
                                >
                                  <span>
                                    {property.name}: {property.value}
                                  </span>
                                  {property.price ? (
                                    <span className="font-mono text-[11px] text-[var(--heat)]">
                                      {formatAddOn(property.price)}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <footer className="grid shrink-0 grid-cols-[1fr_auto] items-end gap-4 bg-[var(--soot)] px-4 py-3 text-[var(--paper)]">
                <div className="grid gap-1 text-[11px] uppercase tracking-[0.16em] text-[var(--heat-soft)]">
                  <span>Ara {formatTry(quote.priceSummary.subtotal)}</span>
                  <span>
                    KDV %{quote.priceSummary.taxRatePercent}{" "}
                    {formatTry(quote.priceSummary.tax)}
                  </span>
                </div>
                <div className="text-right">
                  <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--heat-soft)]">
                    Genel toplam
                  </p>
                  <p className="kiln-readout font-mono text-3xl leading-none text-[var(--heat-soft)]">
                    {formatTry(quote.priceSummary.totalAfterTax)}
                  </p>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
