'use client'

import { useState, useEffect } from 'react'

interface CountdownResult {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
  isExpired: boolean
  isUrgent: boolean
  isAtRisk: boolean
  formatted: string
}

const NEUTRAL: CountdownResult = {
  days: 0,
  hours: 0,
  minutes: 0,
  seconds: 0,
  totalSeconds: 0,
  isExpired: false,
  isUrgent: false,
  isAtRisk: false,
  formatted: '--',
}

function compute(targetTimestamp: number): CountdownResult {
  const remaining = targetTimestamp - Math.floor(Date.now() / 1000)

  if (remaining <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isExpired: true,
      isUrgent: false,
      isAtRisk: false,
      formatted: 'Expired',
    }
  }

  const days = Math.floor(remaining / 86400)
  const hours = Math.floor((remaining % 86400) / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60

  const isUrgent = remaining < 3600
  const isAtRisk = remaining < 86400

  let formatted: string
  if (remaining < 3600) {
    formatted = `${minutes}m ${seconds}s`
  } else {
    formatted = `${days}d ${hours}h ${minutes}m`
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds: remaining,
    isExpired: false,
    isUrgent,
    isAtRisk,
    formatted,
  }
}

export function useCountdown(targetTimestamp: number | bigint | null): CountdownResult {
  const target = targetTimestamp ? Number(targetTimestamp) : 0

  const [result, setResult] = useState<CountdownResult>(() =>
    target > 0 ? compute(target) : NEUTRAL,
  )

  useEffect(() => {
    if (target <= 0) {
      setResult(NEUTRAL)
      return
    }

    setResult(compute(target))

    const interval = setInterval(() => {
      setResult(compute(target))
    }, 1000)

    return () => clearInterval(interval)
  }, [target])

  return result
}
