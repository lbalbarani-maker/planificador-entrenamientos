import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  requestPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
  checkSubscriptionStatus,
  isPushSupported
} from '../lib/pushNotifications'

export interface NotificationPreferences {
  goals: boolean
  convocations: boolean
  training: boolean
  matchChanges: boolean
  lottery: boolean
}

export interface PushNotificationState {
  permission: NotificationPermission
  isSupported: boolean
  isSubscribed: boolean
  isLoading: boolean
  subscription: PushSubscription | null
  preferences: NotificationPreferences
}

const defaultPreferences: NotificationPreferences = {
  goals: true,
  convocations: true,
  training: true,
  matchChanges: true,
  lottery: false
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSupported: false,
    isSubscribed: false,
    isLoading: true,
    subscription: null,
    preferences: defaultPreferences
  })

  const [user, setUser] = useState<{ id: string; club_id?: string } | null>(null)

  useEffect(() => {
    async function init() {
      const supported = await isPushSupported()
      const permission = Notification.permission || 'default'
      
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const isSubscribed = await checkSubscriptionStatus(session.user.id)
        setUser({ id: session.user.id, club_id: session.user.user_metadata?.club_id })
        
        if (isSubscribed && 'serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          const subscription = await registration.pushManager.getSubscription()
          setState(prev => ({ ...prev, subscription }))
        }
      }

      let isSubscribedStatus = false
      if (session?.user) {
        isSubscribedStatus = await checkSubscriptionStatus(session.user.id)
      }

      setState(prev => ({
        ...prev,
        permission,
        isSupported: supported,
        isSubscribed: isSubscribedStatus,
        isLoading: false
      }))
    }

    init()
  }, [])

  const subscribe = useCallback(async (teamIds?: string[]) => {
    if (!user) return false

    setState(prev => ({ ...prev, isLoading: true }))

    const permission = await requestPushPermission()
    if (permission !== 'granted') {
      setState(prev => ({ ...prev, permission, isLoading: false }))
      return false
    }

    const success = await subscribeToPush({
      userId: user.id,
      clubId: user.club_id,
      teamIds
    })

    if (success) {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      
      setState(prev => ({
        ...prev,
        permission: 'granted',
        isSubscribed: true,
        subscription,
        isLoading: false
      }))
    } else {
      setState(prev => ({ ...prev, isLoading: false }))
    }

    return success
  }, [user])

  const unsubscribe = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }))
    
    await unsubscribeFromPush()
    
    setState(prev => ({
      ...prev,
      isSubscribed: false,
      subscription: null,
      preferences: defaultPreferences,
      isLoading: false
    }))
  }, [])

  const updatePreferences = useCallback(async (
    newPreferences: Partial<NotificationPreferences>
  ) => {
    if (!state.subscription) return false

    const mergedPreferences = { ...state.preferences, ...newPreferences }
    
    const notificationTypes = Object.entries(mergedPreferences)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type.replace(/([A-Z])/g, '_$1').toLowerCase())

    const success = await updatePushPreferences(
      state.subscription.endpoint,
      [],
      notificationTypes
    )

    if (success) {
      setState(prev => ({ ...prev, preferences: mergedPreferences }))
    }

    return success
  }, [state.subscription, state.preferences])

  return {
    ...state,
    subscribe,
    unsubscribe,
    updatePreferences
  }
}
