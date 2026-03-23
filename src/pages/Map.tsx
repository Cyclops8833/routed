export default function MapPage() {
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
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
              fill="var(--color-moss)"
              opacity="0.4"
            />
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
          Map
        </h2>
        <p style={{ color: 'var(--color-stone)', margin: 0, fontSize: '16px' }}>
          Coming in Stage 2
        </p>
      </div>
    </div>
  )
}
