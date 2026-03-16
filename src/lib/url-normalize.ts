const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
])

function normalizeParsedUrl(parsed: URL): string {
  parsed.hash = ''
  parsed.hostname = parsed.hostname.toLowerCase()

  if ((parsed.protocol === 'http:' && parsed.port === '80') || (parsed.protocol === 'https:' && parsed.port === '443')) {
    parsed.port = ''
  }

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key)) {
      parsed.searchParams.delete(key)
    }
  }

  if (parsed.pathname !== '/') {
    parsed.pathname = parsed.pathname.replace(/\/+$/g, '') || '/'
  }

  return parsed.toString()
}

export function normalizeUrl(url: string): string {
  const value = String(url)
  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)

  if (hasScheme) {
    return normalizeParsedUrl(new URL(value))
  }

  const parsed = new URL(`https://${value}`)
  const normalized = normalizeParsedUrl(parsed)
  return normalized.replace(/^https:\/\//, '')
}
