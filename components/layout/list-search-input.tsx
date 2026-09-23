import { TextInput } from "@/components/catalog/fields";

export function ListSearchInput({
  value,
  onChange,
  placeholder = "Ara",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}
