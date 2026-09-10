export function VoiceLevel({
  level,
  active,
}: {
  level: number;
  active: boolean;
}) {
  const weights = [0.45, 0.75, 1, 0.75, 0.45];
  return (
    <div
      className="voice-level flex h-8 items-end justify-center gap-1"
      data-active={active ? "true" : "false"}
      aria-hidden
    >
      {weights.map((weight, index) => {
        const height = active
          ? Math.max(0.18, Math.min(1, 0.18 + level * weight * 1.25))
          : 0.18;
        return (
          <span
            key={index}
            className="voice-level-bar inline-block w-1 origin-bottom bg-[var(--heat)]"
            style={{
              height: `${Math.round(height * 32)}px`,
              animationDelay: `${index * 90}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
