import { useId } from 'react'

export function TextField({ label, hint, error, ...input }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  )
}

export function FormError({ children }) {
  if (!children) return null
  return (
    <p className="form-error" role="alert">
      {children}
    </p>
  )
}
