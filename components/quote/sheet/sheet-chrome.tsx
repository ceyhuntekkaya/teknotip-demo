"use client";

export function SheetAdd({ onClick }: { onClick: (anchor: DOMRect) => void }) {
  return (
    <button
      type="button"
      className="sheet-add"
      title="Ürün ekle"
      aria-label="Ürün ekle"
      onClick={(event) => onClick(event.currentTarget.getBoundingClientRect())}
    >
      +
    </button>
  );
}

export function SheetMove({
  canMoveUp,
  canMoveDown,
  onMove,
}: {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <span className="sheet-move">
      <button
        type="button"
        className="sheet-move-btn"
        title="Yukarı taşı"
        aria-label="Yukarı taşı"
        disabled={!canMoveUp}
        onClick={(event) => {
          event.stopPropagation();
          onMove(-1);
        }}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 6.5 5 3.5 8 6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
      <button
        type="button"
        className="sheet-move-btn"
        title="Aşağı taşı"
        aria-label="Aşağı taşı"
        disabled={!canMoveDown}
        onClick={(event) => {
          event.stopPropagation();
          onMove(1);
        }}
      >
        <svg viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>
    </span>
  );
}

export function SheetRowEnd({ onRemove }: { onRemove?: () => void }) {
  if (!onRemove) return null;
  return (
    <span className="sheet-col-end">
      <SheetRemove onClick={onRemove} />
    </span>
  );
}

export function SheetHeadEnd({ active }: { active: boolean }) {
  if (!active) return null;
  return <span className="sheet-col-end" aria-hidden="true" />;
}

export function SheetRemove({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="sheet-remove"
      title="Ürünü sil"
      aria-label="Ürünü sil"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M3.6 4.6h8.8M6.1 4.6V3.3h3.8v1.3M4.7 4.6l.55 8h5.5l.55-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function SheetHot({
  children,
  title,
  onEdit,
}: {
  children: React.ReactNode;
  title: string;
  onEdit?: () => void;
}) {
  if (!onEdit) return <>{children}</>;
  return (
    <span
      className="sheet-hot"
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onEdit();
      }}
    >
      {children}
    </span>
  );
}
