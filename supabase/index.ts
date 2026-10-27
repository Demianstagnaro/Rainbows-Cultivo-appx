import { createClient } from 'npm:@supabase/supabase-js@2.110.6'

const origin = 'https://demianstagnaro.github.io'
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
const apiVersion = '2022-11-28'

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { error: 'Método no permitido.' })
  if (request.headers.get('Origin') !== origin) return reply(403, { error: 'Origen no autorizado.' })

  const url = Deno.env.get('SUPABASE_URL')
  const publishable = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const githubToken = Deno.env.get('BACKUP_GITHUB_TOKEN')
  const repository = Deno.env.get('BACKUP_GITHUB_REPO') || 'Demianstagnaro/Rainbows-Cultivo-appx'
  const backupWorkflow = Deno.env.get('BACKUP_WORKFLOW_FILE') || 'backup-database.yml'
  const restoreWorkflow = Deno.env.get('RESTORE_WORKFLOW_FILE') || 'restore-backup.yml'
  const branch = Deno.env.get('BACKUP_GITHUB_BRANCH') || 'main'
  if (!url || !publishable || !serviceKey || !githubToken)
    return reply(500, { error: 'Falta configurar el sistema de backups.' })
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    return reply(500, { error: 'El repositorio de backups no es válido.' })

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return reply(401, { error: 'Ingresá con una cuenta administradora.' })
  const userClient = createClient(url, publishable, { auth: { persistSession: false } })
  const { data: verified, error: authError } = await userClient.auth.getUser(token)
  if (authError || !verified.user) return reply(401, { error: 'La sesión venció. Volvé a ingresar.' })

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: profile, error: profileError } = await admin.from('perfiles')
    .select('rol,activo').eq('id', verified.user.id).single()
  if (profileError) return reply(500, { error: 'No se pudo verificar el administrador.' })
  if (!profile.activo || profile.rol?.trim().toLowerCase() !== 'administrador')
    return reply(403, { error: 'Solo un administrador activo puede gestionar backups.' })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return reply(400, { error: 'Solicitud inválida.' }) }
  const action = typeof body.action === 'string' ? body.action : ''
  const artifactId = Number(body.artifact_id)

  const github = async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      ...init,
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': apiVersion,
        ...(init.headers || {}),
      },
    })
    if (!response.ok) {
      let detail = `GitHub respondió ${response.status}.`
      try { const data = await response.json(); detail = data.message || detail } catch { /* respuesta sin JSON */ }
      throw new Error(detail)
    }
    return response
  }

  const getArtifact = async () => {
    if (!Number.isSafeInteger(artifactId) || artifactId <= 0) throw new Error('Backup inválido.')
    const response = await github(`/actions/artifacts/${artifactId}`)
    const artifact = await response.json()
    if (!String(artifact.name || '').startsWith('rainbows-backup-') || artifact.expired)
      throw new Error('La copia seleccionada no está disponible.')
    return artifact
  }

  try {
    if (action === 'list') {
      const [artifactResponse, backupRunsResponse, restoreRunsResponse] = await Promise.all([
        github('/actions/artifacts?per_page=50'),
        github(`/actions/workflows/${encodeURIComponent(backupWorkflow)}/runs?per_page=10`),
        github(`/actions/workflows/${encodeURIComponent(restoreWorkflow)}/runs?per_page=10`),
      ])
      const artifactData = await artifactResponse.json()
      const backupRunData = await backupRunsResponse.json()
      const restoreRunData = await restoreRunsResponse.json()
      const backups = (artifactData.artifacts || [])
        .filter((artifact: Record<string, unknown>) => String(artifact.name || '').startsWith('rainbows-backup-') && !artifact.expired)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(b.created_at).localeCompare(String(a.created_at)))
        .map((artifact: Record<string, unknown>) => ({
          id: artifact.id,
          name: artifact.name,
          size_in_bytes: artifact.size_in_bytes,
          created_at: artifact.created_at,
          expires_at: artifact.expires_at,
        }))
      const runs = [
        ...(backupRunData.workflow_runs || []).map((run: Record<string, unknown>) => ({ ...run, name: 'backup' })),
        ...(restoreRunData.workflow_runs || []).map((run: Record<string, unknown>) => ({ ...run, name: 'restauración' })),
      ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 20)
        .map(run => ({ id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, created_at: run.created_at }))
      return reply(200, { backups, runs })
    }

    if (action === 'create') {
      await github(`/actions/workflows/${encodeURIComponent(backupWorkflow)}/dispatches`, {
        method: 'POST', body: JSON.stringify({ ref: branch }),
      })
      return reply(200, { ok: true })
    }

    if (action === 'download') {
      await getArtifact()
      const response = await fetch(`https://api.github.com/repos/${repository}/actions/artifacts/${artifactId}/zip`, {
        redirect: 'manual',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': apiVersion,
        },
      })
      const location = response.headers.get('location')
      if (response.status !== 302 || !location) throw new Error('GitHub no generó el enlace temporal de descarga.')
      return reply(200, { url: location })
    }

    if (action === 'restore') {
      if (body.confirmation !== 'RESTAURAR') return reply(400, { error: 'Falta la confirmación de restauración.' })
      await getArtifact()
      await github(`/actions/workflows/${encodeURIComponent(restoreWorkflow)}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: branch, inputs: { artifact_id: String(artifactId), confirmation: 'RESTAURAR' } }),
      })
      return reply(200, { ok: true })
    }

    return reply(400, { error: 'Acción de backup desconocida.' })
  } catch (error) {
    console.error(error)
    return reply(500, { error: error instanceof Error ? error.message : 'Falló el sistema de backups.' })
  }
})

