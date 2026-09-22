import { CircleAlert, LoaderCircle } from 'lucide-react'

interface LoadingStateProps {
  loading: boolean
  label?: string
}

export function LoadingState({ loading, label }: LoadingStateProps) {
  if (loading) {
    return (
      <div className="sd-loading">
        <LoaderCircle size={16} className="sd-spin" />
        {label ?? 'Loading analysis artifacts…'}
      </div>
    )
  }
  return null
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="sd-error">
      <CircleAlert size={16} />
      <span>Could not load analysis artifacts — {message}. The page falls back to the bundled demo dataset.</span>
    </div>
  )
}