'use client'

import { useState } from 'react'
import type { TokenInfo } from '@stela/core'
import { findTokenByAddress } from '@stela/core'

/** Generate a deterministic color from a string */
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return `hsl(${hue}, 55%, 45%)`
}

/** Token avatar: logo image with colored-letter fallback */
export function TokenAvatar({
  token,
  size = 20,
}: {
  token: TokenInfo
  size?: number
}) {
  const [imgError, setImgError] = useState(false)
  const bgColor = stringToColor(token.symbol)

  if (token.logoUrl && !imgError) {
    return (
      <div
        className="relative shrink-0 rounded-full overflow-hidden bg-surface"
        style={{ width: size, height: size }}
      >
        <img
          src={token.logoUrl}
          alt={token.symbol}
          width={size}
          height={size}
          className="rounded-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: bgColor,
        fontSize: size * 0.4,
      }}
    >
      {token.symbol.charAt(0).toUpperCase()}
    </div>
  )
}

/** Resolve a contract address into a TokenAvatar (returns null if not found) */
export function TokenAvatarByAddress({
  address,
  size = 20,
}: {
  address: string
  size?: number
}) {
  const token = findTokenByAddress(address)
  if (!token) return null
  return <TokenAvatar token={token} size={size} />
}
