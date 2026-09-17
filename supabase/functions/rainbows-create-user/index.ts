import { createClient } from 'npm:@supabase/supabase-js@2.110.6'

const origin = 'https://demianstagnaro.github.io'
const appUrl = `${origin}/Rainbows-Cultivo-appx/`
const headers = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
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
  if (!url || !publishable || !serviceKey) return reply(500, { error: 'Falta configurar la función de usuarios.' })

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
    return reply(403, { error: 'Solo un administrador activo puede crear cuentas.' })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return reply(400, { error: 'Datos inválidos.' }) }
  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const rol = body.rol
  if (!nombre || nombre.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      !['administrador', 'cultivo', 'medrano'].includes(String(rol)))
    return reply(400, { error: 'Revisá el nombre, correo y rol.' })

  // The existing auth trigger creates an inactive profile by default.
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nombre }, redirectTo: appUrl,
  })
  if (inviteError) return reply(400, { error: inviteError.message })
  const userId = invited.user?.id
  if (!userId) return reply(500, { error: 'La invitación no devolvió un usuario. Revisá Auth Users.' })
  const { data: updated, error: updateError } = await admin.from('perfiles').update({ rol, nombre, activo: true })
    .eq('id', userId).eq('activo', false).select('id').single()
  if (updateError || !updated) return reply(500, { error: 'Invitación enviada, pero no se pudo asignar el rol. Revisá la cuenta en Config.' })
  return reply(200, { ok: true })
})
