import { CircleDollarSign, Ellipsis, Globe2, Landmark, Send, Smartphone, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type TransferField = {
  name: string
  label: string
  placeholder: string
  maxLength: number
  type?: 'text' | 'email'
  inputMode?: 'text' | 'numeric' | 'email'
  options?: string[]
}

export type TransferMethod = {
  name: string
  description: string
  icon: LucideIcon
  fields: TransferField[]
  makeDestination: (values: Record<string, string>) => string
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return '•••'
  return `${name.slice(0, 1)}•••@${domain}`
}

function maskIdentifier(value: string) {
  return `••••${value.slice(-4)}`
}

export const transferMethods: TransferMethod[] = [
  {
    name: 'Local transfer',
    description: 'Bank transfer',
    icon: Landmark,
    fields: [
      { name: 'recipient', label: 'Recipient name', placeholder: 'Fictional recipient', maxLength: 24 },
      { name: 'bank', label: 'Bank name', placeholder: 'Fictional bank', maxLength: 18 },
      { name: 'account', label: 'Account number', placeholder: 'Fictional account number', maxLength: 20, inputMode: 'numeric' },
      { name: 'routing', label: 'Routing / sort code', placeholder: 'Fictional routing code', maxLength: 12, inputMode: 'numeric' },
      { name: 'country', label: 'Recipient country code', placeholder: 'US', maxLength: 2 },
    ],
    makeDestination: (values) => `${values.recipient}|${values.bank}|••${values.account.slice(-4)}|••${values.routing.slice(-2)}|${values.country.toUpperCase()}`,
  },
  {
    name: 'Cash App',
    description: 'Mobile wallet',
    icon: Smartphone,
    fields: [
      { name: 'cashtag', label: 'Cash App $Cashtag', placeholder: '$fictionalname', maxLength: 30 },
      { name: 'recipient', label: 'Recipient name', placeholder: 'Fictional recipient', maxLength: 30 },
    ],
    makeDestination: (values) => `${maskIdentifier(values.cashtag)} | ${values.recipient}`,
  },
  {
    name: 'PayPal',
    description: 'Digital wallet',
    icon: WalletCards,
    fields: [
      { name: 'email', label: 'PayPal recipient email', placeholder: 'recipient@example.test', maxLength: 70, type: 'email', inputMode: 'email' },
      { name: 'recipient', label: 'Recipient name', placeholder: 'Fictional recipient', maxLength: 24 },
    ],
    makeDestination: (values) => `${maskEmail(values.email)} | ${values.recipient}`,
  },
  {
    name: 'USDT',
    description: 'Stablecoin route',
    icon: CircleDollarSign,
    fields: [
      { name: 'network', label: 'Network', placeholder: 'Select a network', maxLength: 8, options: ['TRC20', 'ERC20', 'BEP20'] },
      { name: 'wallet', label: 'Wallet address', placeholder: 'Fictional wallet address', maxLength: 88 },
    ],
    makeDestination: (values) => `${values.network} | ${maskIdentifier(values.wallet)}`,
  },
  {
    name: 'Wise',
    description: 'International',
    icon: Globe2,
    fields: [
      { name: 'recipient', label: 'Recipient name', placeholder: 'Fictional recipient', maxLength: 25 },
      { name: 'email', label: 'Recipient email', placeholder: 'recipient@example.test', maxLength: 65, type: 'email', inputMode: 'email' },
      { name: 'country', label: 'Recipient country code', placeholder: 'GB', maxLength: 2 },
    ],
    makeDestination: (values) => `${values.recipient} | ${maskEmail(values.email)} | ${values.country.toUpperCase()}`,
  },
  {
    name: 'Venmo',
    description: 'Peer-to-peer',
    icon: Send,
    fields: [
      { name: 'username', label: 'Venmo username', placeholder: '@fictionalname', maxLength: 35 },
      { name: 'recipient', label: 'Recipient name', placeholder: 'Fictional recipient', maxLength: 25 },
    ],
    makeDestination: (values) => `${maskIdentifier(values.username)} | ${values.recipient}`,
  },
  {
    name: 'Other',
    description: 'Other options',
    icon: Ellipsis,
    fields: [
      { name: 'recipient', label: 'Recipient name or reference', placeholder: 'Fictional recipient', maxLength: 30 },
      { name: 'details', label: 'Route details', placeholder: 'Describe the illustrative route', maxLength: 60 },
    ],
    makeDestination: (values) => `${values.recipient} | ${values.details}`,
  },
]

export const depositMethods = ['Cash deposit', ...transferMethods.map(({ name }) => name)]

export function getTransferMethod(name: string | null | undefined) {
  return transferMethods.find((method) => method.name === name) ?? transferMethods[0]
}
