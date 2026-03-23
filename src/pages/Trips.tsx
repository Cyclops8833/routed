export default function TripsPage() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100dvh - var(--tab-bar-height) - env(safe-area-inset-bottom))',
        backgroundColor: 'var(--color-base)',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='140' viewBox='0 0 200 140'%3E%3Cellipse cx='100' cy='70' rx='90' ry='55' fill='none' stroke='%234A6741' stroke-width='0.8'/%3E%3Cellipse cx='100' cy='70' rx='72' ry='42' fill='none' stroke='%234A6741' stroke-width='0.8'/%3E%3Cellipse cx='100' cy='70' rx='54' ry='30' fill='none' stroke='%234A6741' stroke-width='0.8'/%3E%3Cellipse cx='100' cy='70' rx='36' ry='19' fill='none' stroke='%234A6741' stroke-width='0.8'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 140px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          padding: '32px',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="6" cy="18" r="2.5" stroke="var(--color-moss)" strokeWidth="2" opacity="0.4" />
            <circle cx="18" cy="6" r="2.5" stroke="var(--color-moss)" strokeWidth="2" opacity="0.4" />
            <path d="M6 15.5C6 12 9 10.5 12 9.5" stroke="var(--color-moss)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <path d="M12 9.5C15 8.5 18 7 18 8.5" stroke="var(--color-moss)" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
          </svg>
        </div>
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--color-charcoal)',
            margin: '0 0 12px 0',
          }}
        >
          Trips
        </h2>
        <p style={{ color: 'var(--color-stone)', margin: 0, fontSize: '16px' }}>
          Coming in Stage 3
        </p>
      </div>
    </div>
  )
}
