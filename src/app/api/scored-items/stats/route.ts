import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'

/**
 * GET /api/scored-items/stats
 * Pipeline health overview: counts by classification, domain, action status.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1

    const total = (db.prepare(
      `SELECT COUNT(*) as count FROM scored_items WHERE workspace_id = ?`
    ).get(workspaceId) as any)?.count || 0

    const unactioned = (db.prepare(
      `SELECT COUNT(*) as count FROM scored_items WHERE workspace_id = ? AND actioned = 0 AND final_score >= 0.5`
    ).get(workspaceId) as any)?.count || 0

    const byClassification = db.prepare(`
      SELECT classification, COUNT(*) as count
      FROM scored_items WHERE workspace_id = ?
      GROUP BY classification ORDER BY count DESC
    `).all(workspaceId)

    const byDomain = db.prepare(`
      SELECT domain, COUNT(*) as count, ROUND(AVG(final_score), 3) as avg_score
      FROM scored_items WHERE workspace_id = ?
      GROUP BY domain ORDER BY count DESC
    `).all(workspaceId)

    const lastFetch = (db.prepare(
      `SELECT MAX(fetched_at) as ts FROM scored_items WHERE workspace_id = ?`
    ).get(workspaceId) as any)?.ts || null

    const last24h = (db.prepare(
      `SELECT COUNT(*) as count FROM scored_items WHERE workspace_id = ? AND fetched_at >= unixepoch() - 86400`
    ).get(workspaceId) as any)?.count || 0

    return NextResponse.json({
      total,
      unactioned,
      last24h,
      lastFetch,
      byClassification,
      byDomain
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/scored-items/stats error')
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
