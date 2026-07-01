export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <circle cx="10.8" cy="10.8" r="5.6" />
      <path d="m15.1 15.1 4.2 4.2" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path
        d="M7.5 10.5a4.5 4.5 0 0 1 9 0c0 3.4 1.25 4.7 2 5.5h-13c.75-.8 2-2.1 2-5.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 18.25a2.1 2.1 0 0 0 3.6 0"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path d="m14.5 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path
        d="m6.5 12.5 3.6 3.6 7.4-8.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-5 w-5"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? "1.45" : "1.55"}
    >
      <path
        d="M12 20s-6.5-3.9-6.5-9.1A4.1 4.1 0 0 1 12 7a4.1 4.1 0 0 1 6.5 3.9C18.5 16.1 12 20 12 20Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path
        d="M5 18.8h3.4L18.6 8.6a2 2 0 0 0-2.8-2.8L5.6 16 5 18.8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.6 7 2.4 2.4" strokeLinecap="round" />
    </svg>
  );
}

export function BidIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path
        d="M7 4.75h10A1.75 1.75 0 0 1 18.75 6.5v11.8l-3.15-1.55L12 18.5l-3.6-1.75-3.15 1.55V6.5A1.75 1.75 0 0 1 7 4.75Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.25 8.2h7.5M8.25 11.9h7.5M8.25 15.6h4.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path
        d="M4.5 11.2 12 5.25l7.5 5.95"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 10.2v8.55h10.5V10.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <path d="M12 6.25v11.5M6.25 12h11.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.55"
    >
      <circle cx="12" cy="8.6" r="3.15" />
      <path d="M5.75 18.8c.95-3.15 3.1-4.6 6.25-4.6s5.3 1.45 6.25 4.6" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="motion-icon h-4 w-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.2 1 5.9L12 17.1 6.8 20l1-5.9-4.3-4.2 5.9-.9L12 3.6Z" />
    </svg>
  );
}
