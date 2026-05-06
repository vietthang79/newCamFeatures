'use client'
import { createContext, useContext, useState, useRef, ReactNode } from 'react'
import {
  INITIAL_COMPANIES, INITIAL_USERS,
  type CompanyRecord, type UserRecord, type Role, type Status,
  generateSlug,
} from './mock-auth-data'

interface DataContextValue {
  companies: CompanyRecord[]
  users: UserRecord[]
  addCompany: (data: { name: string; status: Status }) => CompanyRecord
  updateCompany: (id: string, data: { name: string; status: Status }) => void
  deleteCompany: (id: string) => void
  addUser: (data: { name: string; email: string; password: string; role: Role; companyId: string | null; status: Status }) => UserRecord
  updateUser: (id: string, data: { name: string; email: string; password?: string; role: Role; companyId: string | null; status: Status }) => void
  deleteUser: (id: string) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<CompanyRecord[]>(INITIAL_COMPANIES)
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS)
  const companyCounter = useRef(100)
  const userCounter = useRef(100)

  const addCompany = (data: { name: string; status: Status }): CompanyRecord => {
    const existing = companies.map(c => c.slug)
    let slug = generateSlug(data.name)
    if (existing.includes(slug)) slug = `${slug}-${Date.now().toString(36)}`
    const record: CompanyRecord = {
      id: `co${++companyCounter.current}`, name: data.name, slug,
      status: data.status, createdAt: new Date().toISOString().slice(0, 10),
    }
    setCompanies(prev => [...prev, record])
    return record
  }

  const updateCompany = (id: string, data: { name: string; status: Status }) => {
    setCompanies(prev => prev.map(c =>
      c.id === id ? { ...c, name: data.name, status: data.status, slug: generateSlug(data.name) } : c
    ))
  }

  const deleteCompany = (id: string) => {
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  const addUser = (data: { name: string; email: string; password: string; role: Role; companyId: string | null; status: Status }): UserRecord => {
    const record: UserRecord = {
      id: `u${++userCounter.current}`, ...data,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    setUsers(prev => [...prev, record])
    return record
  }

  const updateUser = (id: string, data: { name: string; email: string; password?: string; role: Role; companyId: string | null; status: Status }) => {
    setUsers(prev => prev.map(u => {
      if (u.id !== id) return u
      return { ...u, ...data, password: data.password || u.password }
    }))
  }

  const deleteUser = (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  return (
    <DataContext.Provider value={{ companies, users, addCompany, updateCompany, deleteCompany, addUser, updateUser, deleteUser }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
