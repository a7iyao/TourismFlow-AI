export interface KpiCardData {
  id: string
  label: string
  value: string
  caption: string
  tone: 'pressure' | 'concentration' | 'economic' | 'alternative'
  pending: boolean
}