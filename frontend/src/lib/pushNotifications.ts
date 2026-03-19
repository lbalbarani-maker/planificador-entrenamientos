import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

export interface PushSubscriptionData {
  userId: string
  clubId?: string
  teamIds?: string[]
  notificationTypes?: string[]
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)))
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported')
    return 'denied'
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported')
    return 'denied'
  }
  
  const permission = await Notification.requestPermission()
  return permission
}

export async function isPushSupported(): Promise<boolean> {
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_PUBLIC_KEY
  )
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  
  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch (error) {
    console.error('Error getting subscription:', error)
    return null
  }
}

export async function subscribeToPush(data: PushSubscriptionData): Promise<boolean> {
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID public key not configured')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    
    const existingSubscription = await registration.pushManager.getSubscription()
    if (existingSubscription) {
      await existingSubscription.unsubscribe()
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    const p256dhKey = subscription.getKey('p256dh')
    const authKey = subscription.getKey('auth')
    
    const pushSubscription = {
      user_id: data.userId,
      endpoint: subscription.endpoint,
      p256dh: p256dhKey ? arrayBufferToBase64(p256dhKey) : '',
      auth: authKey ? arrayBufferToBase64(authKey) : '',
      club_id: data.clubId,
      team_ids: data.teamIds || [],
      notification_types: data.notificationTypes || ['goals', 'convocations', 'training', 'match_changes'],
      is_active: true
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(pushSubscription, { onConflict: 'user_id,endpoint' })

    if (error) {
      console.error('Error saving subscription:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Error subscribing to push:', error)
    return false
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    
    if (subscription) {
      await subscription.unsubscribe()
      
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', subscription.endpoint)
    }
    
    return true
  } catch (error) {
    console.error('Error unsubscribing:', error)
    return false
  }
}

export async function updatePushPreferences(
  endpoint: string,
  teamIds: string[],
  notificationTypes: string[]
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({
        team_ids: teamIds,
        notification_types: notificationTypes
      })
      .eq('endpoint', endpoint)
      .eq('is_active', true)

    return !error
  } catch (error) {
    console.error('Error updating preferences:', error)
    return false
  }
}

export async function checkSubscriptionStatus(userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('push_subscriptions')
      .select('endpoint, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()
    
    return !!data
  } catch {
    return false
  }
}

export interface NotificationPayload {
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  teamIds?: string[]
  sponsorId?: string
}

export async function sendPushNotification(payload: NotificationPayload): Promise<{ success: boolean; sent?: number }> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return { success: false }
    }

    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        ...payload,
        exclude_user_id: session.user.id
      }
    })

    if (error) {
      console.error('Error sending push:', error)
      return { success: false }
    }

    return { success: true, sent: data?.sent || 0 }
  } catch (error) {
    console.error('Error invoking push function:', error)
    return { success: false }
  }
}
