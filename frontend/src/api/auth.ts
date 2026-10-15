import { apiRequest } from './client'
import { notifyAuthChanged } from './authEvents'

export type Account = { id: number; username: string; displayName: string; role: 'USER' | 'ADMIN'; bodyWeightKg?: number | null }

export function getCurrentAccount(): Promise<Account> {
  return apiRequest<Account>('/auth/me')
}

export async function login(username: string, password: string): Promise<Account> {
  const account = await apiRequest<Account>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
  notifyAuthChanged(account)
  return account
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
  notifyAuthChanged(null)
}

export function acceptInvitation(input: { token: string; username: string; displayName: string; password: string }): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/invitations/accept', { method: 'POST', body: JSON.stringify(input) })
}

export function updateBodyWeight(bodyWeightKg: number): Promise<Account> {
  return apiRequest<Account>('/auth/me/profile', { method: 'PUT', body: JSON.stringify({ bodyWeightKg }) })
}
