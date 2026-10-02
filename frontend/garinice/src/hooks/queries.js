import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { api } from '../api'
import { useToast } from '../components/ui/Toast'
import { useAuth } from './useAuth'

export function useTaxonomy() {
  return useQuery({ queryKey: ['taxonomy'], queryFn: api.catalog.taxonomy, staleTime: 10 * 60_000 })
}

export function useVehicleSearch(filters, { facets = true, track = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ['vehicles', filters, facets],
    queryFn: () => api.vehicles.search({ ...filters, facets: facets ? '1' : undefined, track: track ? '1' : undefined }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled,
  })
}

export function useFavouriteIds() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['favourites', 'ids', user?.id],
    queryFn: api.favourites.ids,
    enabled: !!user,
    staleTime: 60_000,
    select: (d) => new Set(d.ids),
  })
}

/** Toggle favourite with optimistic update; prompts for sign-in when needed. */
export function useToggleFavourite() {
  const qc = useQueryClient()
  const toast = useToast()
  const { user, requireAuth } = useAuth()
  const mutation = useMutation({
    mutationFn: ({ id, saved }) => (saved ? api.favourites.remove(id) : api.favourites.add(id)),
    onMutate: async ({ id, saved, userId }) => {
      const key = ['favourites', 'ids', userId]
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (d) => ({ ids: saved ? (d?.ids || []).filter((x) => x !== id) : [...(d?.ids || []), id] }))
      return { prev, key }
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev)
      toast.error('Couldn’t update saved cars', { description: err.message })
    },
    onSuccess: (_d, { saved }) => {
      if (!saved) toast.success('Saved to your list', { description: 'Find it anytime under Saved cars.' })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['favourites'] }),
  })
  return useCallback(
    (id, saved) =>
      requireAuth('Sign in to save cars and get back to them anytime.', async (u) => {
        let isSaved = saved
        if (u.id !== user?.id) {
          // Just signed in from the prompt: check the server before toggling.
          const { ids } = await qc.fetchQuery({ queryKey: ['favourites', 'ids', u.id], queryFn: api.favourites.ids })
          if (ids.includes(id)) {
            toast.info('Already in your saved cars')
            return
          }
          isSaved = false
        }
        mutation.mutate({ id, saved: isSaved, userId: u.id })
      }),
    [mutation, qc, requireAuth, user, toast],
  )
}

export function useUnreadCounts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['unread', user?.id],
    queryFn: api.conversations.unread,
    enabled: !!user,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  })
}
