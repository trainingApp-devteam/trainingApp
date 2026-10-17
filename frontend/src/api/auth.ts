import { apiRequest } from './client'
import { notifyAuthChanged } from './authEvents'

export type Account = { id: number; username: string; displayName: string; role: 'USER' | 'ADMIN'; heightCm?: number | null }

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

// 指定した項目（表示名・身長）だけを変更し、ヘッダー等の表示にも即時反映する
export async function updateAccount(changes: { displayName?: string; heightCm?: number }): Promise<Account> {
  const account = await apiRequest<Account>('/auth/me', { method: 'PATCH', body: JSON.stringify(changes) })
  notifyAuthChanged(account)
  return account
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiRequest<void>('/auth/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) })
}
