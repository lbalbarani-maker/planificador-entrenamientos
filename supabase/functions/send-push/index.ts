import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PushPayload {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  team_ids?: string[]
  club_id?: string
  exclude_user_id?: string
  sponsor_id?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, club_id')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'staff'].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin or staff role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const payload: PushPayload = await req.json()
    const { type, title, body, data, team_ids, club_id, exclude_user_id, sponsor_id } = payload

    if (!title || !body) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let query = supabase
      .from('push_subscriptions')
      .select('*')
      .eq('is_active', true)

    if (club_id || profile.club_id) {
      query = query.eq('club_id', club_id || profile.club_id)
    }

    if (team_ids && team_ids.length > 0) {
      query = query.overlaps('team_ids', team_ids)
    }

    if (exclude_user_id) {
      query = query.neq('user_id', exclude_user_id)
    }

    const { data: subscriptions } = await query

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: 'No subscribers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      tag: type,
      data: {
        ...data,
        matchId: data?.match_id || data?.matchId,
        type
      }
    })

    let sentCount = 0
    const failedEndpoints: string[] = []

    for (const sub of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        }

        await sendPushNotification(
          vapidPublicKey,
          vapidPrivateKey,
          pushSubscription,
          notificationPayload
        )
        sentCount++
      } catch (err: any) {
        console.error('Push error:', err.message)
        if (err.statusCode === 404 || err.statusCode === 410) {
          failedEndpoints.push(sub.endpoint)
        }
      }
    }

    if (failedEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', failedEndpoints)
    }

    const { error: logError } = await supabase
      .from('notifications_log')
      .insert({
        type,
        title,
        body,
        data,
        club_id: club_id || profile.club_id,
        team_ids: team_ids || [],
        sent_count: sentCount,
        sponsor_id: sponsor_id || null,
        created_by: user.id
      })

    if (logError) {
      console.error('Log error:', logError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedEndpoints.length,
        total: subscriptions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Server error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function sendPushNotification(
  publicKey: string,
  privateKey: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
) {
  const pushData = new TextEncoder().encode(payload)
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'high',
      'Authorization': `vapid t=${publicKey}, k=${privateKey}`
    },
    body: pushData
  })

  if (!response.ok) {
    const errorText = await response.text()
    const err = new Error(`Push failed: ${response.status} ${errorText}`)
    ;(err as any).statusCode = response.status
    throw err
  }
}
