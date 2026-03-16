# Spec: URL Normalization for scored_items Dedup

## Problem
The `INSERT OR IGNORE` dedup on `scored_items.url` fails when the same article arrives with trivially different URLs across fetch runs:
- Trailing slash variants: `/benefits/` vs `/benefits`
- Fragment variants: `/post#atom` vs `/post`
- Mixed case domains: `BleepingComputer.com` vs `bleepingcomputer.com`

This causes duplicate items in the DB, wasting Reeves' eval slots and producing repetitive intel digests.

## Solution
Add a `normalizeUrl()` helper and apply it in the POST handler before insert.

### Normalization rules (in order):
1. Strip URL fragment (everything after `#`, inclusive)
2. Strip trailing slash(es) from path (but keep root `/`)
3. Lowercase the hostname/domain portion only (preserve path case)
4. Remove default ports (`:80` for http, `:443` for https)
5. Remove common tracking params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` (strip from query string; if query string becomes empty, remove the `?` too)

### Where to apply:
- File: `src/app/api/scored-items/route.ts`
- In the POST handler, normalize `item.url` before passing to the INSERT statement
- The stored URL in DB should be the normalized form

### Helper location:
- Create `src/lib/url-normalize.ts` with the `normalizeUrl(url: string): string` function
- Add tests in `src/lib/__tests__/url-normalize.test.ts`

### Test cases (must pass):
```
https://example.com/post#atom → https://example.com/post
https://example.com/post/ → https://example.com/post
https://Example.COM/Post → https://example.com/Post
https://example.com/post?utm_source=rss&key=val → https://example.com/post?key=val
https://example.com/post?utm_source=rss → https://example.com/post
https://example.com/ → https://example.com/
https://example.com:443/path → https://example.com/path
taskandpurpose.com/news/benefits/ → taskandpurpose.com/news/benefits (handle missing scheme gracefully)
```

### Important:
- Do NOT change the GET or PATCH handlers
- Do NOT change the DB schema
- Keep the existing `String(item.url).slice(0, 2000)` — apply normalize BEFORE the slice
- Run `pnpm build` to verify no type errors after changes
