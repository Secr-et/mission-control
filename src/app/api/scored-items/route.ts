import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

/**
 * GET /api/scored-items
 * Query scored intelligence items. Supports filters:
 *   ?actioned=false — unprocessed items only
 *   ?min_score=0.5  — minimum final_score
 *   ?domain=security — filter by domain
 *   ?classification=high_signal — filter by classification
 *   ?limit=20       — max results (default 50, max 200)
 *   ?order=desc     — sort by final_score (default desc)
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const url = new URL(request.url)

    const conditions: string[] = ['workspace_id = ?']
    const params: Array<string | number> = [workspaceId]

    const actioned = url.searchParams.get('actioned')
    if (actioned === 'false') {
      conditions.push('actioned = 0')
    } else if (actioned === 'true') {
      conditions.push('actioned = 1')
    }

    const minScore = parseFloat(url.searchParams.get('min_score') || '')
    if (!isNaN(minScore)) {
      conditions.push('final_score >= ?')
      params.push(minScore)
    }

    const domain = url.searchParams.get('domain')
    if (domain) {
      conditions.push('domain = ?')
      params.push(domain)
    }

    const classification = url.searchParams.get('classification')
    if (classification) {
      conditions.push('classification = ?')
      params.push(classification)
    }

    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC'

    const rows = db.prepare(`
      SELECT * FROM scored_items
      WHERE ${conditions.join(' AND ')}
      ORDER BY final_score ${order}
      LIMIT ?
    `).all(...params, limit)

    return NextResponse.json({ items: rows, count: rows.length })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/scored-items error')
    return NextResponse.json({ error: 'Failed to fetch scored items' }, { status: 500 })
  }
}

/**
 * POST /api/scored-items
 * Insert one or more scored items. Deduplicates by URL (ignore on conflict).
 * Body: { items: [...] } or single item { source, domain, title, url, ... }
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const body = await request.json()

    const items = Array.isArray(body?.items) ? body.items : [body]

    if (items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 })
    }

    if (items.length > 100) {
      return NextResponse.json({ error: 'Max 100 items per request' }, { status: 400 })
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO scored_items (
        workspace_id, source, domain, title, url, summary,
        relevance_score, actionability_score, urgency_score,
        final_score, domain_weight, analysis, classification,
        fetched_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    `)

    let inserted = 0
    const insertMany = db.transaction((items: any[]) => {
      for (const item of items) {
        if (!item.source || !item.domain || !item.title || !item.url) continue

        const result = insert.run(
          workspaceId,
          String(item.source).slice(0, 500),
          String(item.domain).slice(0, 100),
          String(item.title).slice(0, 1000),
          String(item.url).slice(0, 2000),
          item.summary ? String(item.summary).slice(0, 5000) : null,
          Number(item.relevance_score) || 0,
          Number(item.actionability_score) || 0,
          Number(item.urgency_score) || 0,
          Number(item.final_score) || 0,
          Number(item.domain_weight) || 1.0,
          item.analysis ? String(item.analysis).slice(0, 5000) : null,
          String(item.classification || 'noise').slice(0, 50)
        )
        if (result.changes > 0) inserted++
      }
    })

    insertMany(items)

    return NextResponse.json({
      ok: true,
      inserted,
      skipped: items.length - inserted,
      total: items.length
    }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/scored-items error')
    return NextResponse.json({ error: 'Failed to insert scored items' }, { status: 500 })
  }
}

/**
 * PATCH /api/scored-items
 * Mark items as actioned. Body: { ids: [1,2,3], action_type: "task"|"brief"|"alert"|"skip" }
 */
export async function PATCH(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const body = await request.json()

    const ids = body?.ids
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids array required' }, { status: 400 })
    }

    const actionType = String(body?.action_type || 'skip').slice(0, 50)
    const actionRef = body?.action_ref ? String(body.action_ref).slice(0, 500) : null

    const placeholders = ids.map(() => '?').join(',')
    const result = db.prepare(`
      UPDATE scored_items
      SET actioned = 1, action_type = ?, action_ref = ?, processed_at = unixepoch()
      WHERE workspace_id = ? AND id IN (${placeholders})
    `).run(actionType, actionRef, workspaceId, ...ids)

    return NextResponse.json({ ok: true, updated: result.changes })
  } catch (error) {
    logger.error({ err: error }, 'PATCH /api/scored-items error')
    return NextResponse.json({ error: 'Failed to update scored items' }, { status: 500 })
  }
}
