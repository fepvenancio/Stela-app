import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Stela Protocol — P2P Lending on StarkNet'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #0a0a0e 0%, #121216 50%, #0a0a0e 100%)',
          position: 'relative',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'linear-gradient(rgba(232,168,37,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,168,37,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Stela icon */}
        <div style={{ display: 'flex', marginBottom: 40 }}>
          <svg viewBox="0 0 512 512" width="140" height="140" fill="none">
            <path d="M176 160C176 93.7 210.7 40 256 40C301.3 40 336 93.7 336 160V432H176V160Z" fill="#e8a825" />
            <rect x="208" y="160" width="96" height="10" rx="5" fill="#0a0a0e" fillOpacity="0.2" />
            <rect x="208" y="192" width="96" height="10" rx="5" fill="#0a0a0e" fillOpacity="0.2" />
            <rect x="208" y="224" width="64" height="10" rx="5" fill="#0a0a0e" fillOpacity="0.2" />
            <rect x="208" y="256" width="80" height="10" rx="5" fill="#0a0a0e" fillOpacity="0.2" />
            <rect x="152" y="432" width="208" height="40" rx="6" fill="#e8a825" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#e8a825',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              fontFamily: 'serif',
            }}
          >
            STELA
          </span>
          <span
            style={{
              fontSize: 24,
              color: '#7a7a85',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            P2P Lending Protocol on StarkNet
          </span>
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, transparent, #e8a825, transparent)',
          }}
        />
      </div>
    ),
    { ...size },
  )
}
