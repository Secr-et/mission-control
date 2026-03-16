import { describe, expect, it } from 'vitest'
import { normalizeUrl } from '@/lib/url-normalize'

describe('normalizeUrl', () => {
  it('strips fragments', () => {
    expect(normalizeUrl('https://example.com/post#atom')).toBe('https://example.com/post')
  })

  it('strips trailing slashes from non-root paths', () => {
    expect(normalizeUrl('https://example.com/post/')).toBe('https://example.com/post')
  })

  it('lowercases only the hostname', () => {
    expect(normalizeUrl('https://Example.COM/Post')).toBe('https://example.com/Post')
  })

  it('removes tracking params while preserving other params', () => {
    expect(normalizeUrl('https://example.com/post?utm_source=rss&key=val')).toBe('https://example.com/post?key=val')
  })

  it('removes the query marker when only tracking params are present', () => {
    expect(normalizeUrl('https://example.com/post?utm_source=rss')).toBe('https://example.com/post')
  })

  it('keeps the root slash intact', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
  })

  it('removes default https ports', () => {
    expect(normalizeUrl('https://example.com:443/path')).toBe('https://example.com/path')
  })

  it('handles schemeless URLs gracefully', () => {
    expect(normalizeUrl('taskandpurpose.com/news/benefits/')).toBe('taskandpurpose.com/news/benefits')
  })
})
