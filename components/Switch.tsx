type SwitchProps = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
};

export function Switch({
  checked,
  disabled = false,
  label,
  onCheckedChange,
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--duration-base)] disabled:opacity-40 ${
        checked ? "bg-black" : "bg-[#d4d4d4]"
      }`}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute top-[3px] h-[22px] w-[22px] rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[left] duration-[var(--duration-base)] ${
          checked ? "left-[23px] bg-brand-strong" : "left-[3px] bg-white"
        }`}
      />
    </button>
  );
}
