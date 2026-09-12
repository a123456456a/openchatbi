import { httpJson } from './http'

export type UserOut = {
  id: string
  username: string
  role: string
  is_active: boolean
  created_at?: string | null
}

export type UserCreate = {
  username: string
  password: string
  role: string
}

export type UserUpdate = {
  role?: string
  is_active?: boolean
  password?: string
}

export function listUsers() {
  return httpJson<UserOut[]>('/api/users')
}

export function createUser(body: UserCreate) {
  return httpJson<UserOut>('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function patchUser(id: string, body: UserUpdate) {
  return httpJson<UserOut>(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteUser(id: string) {
  return httpJson<void>(`/api/users/${id}`, {
    method: 'DELETE',
  })
}

