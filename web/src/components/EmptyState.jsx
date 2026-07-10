export default function EmptyState({ icon, children }) {
  return (
    <div className="empty-state">
      <svg className="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d={icon} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>{children}</div>
    </div>
  );
}
