const SunIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const MoonIcon = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.99 12.42A8.5 8.5 0 1 1 11.58 3a6.6 6.6 0 0 0 9.41 9.42Z" />
  </svg>
);

export default function ThemeToggle({ isDarkTheme, onToggle, className = '' }) {
  const iconClass = 'h-4 w-4';
  const Icon = isDarkTheme ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition ${className}`}
      aria-pressed={isDarkTheme}
      aria-label={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDarkTheme ? 'light' : 'dark'} theme`}
    >
      <Icon className={`${iconClass} ${isDarkTheme ? 'text-emerald-200' : 'text-amber-600'}`} />
    </button>
  );
}
