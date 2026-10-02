import { useCallback, useState } from 'react'
import { issuesToErrors } from '../lib/schemas'

/**
 * Minimal form state hook driven by a Zod schema (the same schema the API enforces).
 * Server field errors (422) are merged back into `errors`.
 */
export function useForm(schema, initial) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const set = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }))
    setErrors((e) => {
      if (!e[name]) return e
      const next = { ...e }
      delete next[name]
      return next
    })
  }, [])

  const bind = useCallback(
    (name, { type } = {}) => ({
      name,
      value: type === 'checkbox' ? undefined : values[name] ?? '',
      checked: type === 'checkbox' ? !!values[name] : undefined,
      onChange: (e) => set(name, type === 'checkbox' ? e.target.checked : e?.target ? e.target.value : e),
    }),
    [values, set],
  )

  const handleSubmit = useCallback(
    (onValid) => async (e) => {
      e?.preventDefault()
      setFormError(null)
      const parsed = schema ? schema.safeParse(values) : { success: true, data: values }
      if (!parsed.success) {
        const errs = issuesToErrors(parsed.error.issues)
        setErrors(errs)
        const first = Object.keys(errs)[0]
        document.querySelector(`[name="${first}"]`)?.focus()
        return
      }
      setSubmitting(true)
      try {
        await onValid(parsed.data)
      } catch (err) {
        if (err?.fieldErrors) setErrors(err.fieldErrors)
        setFormError(err?.message || 'Something went wrong. Please try again.')
      } finally {
        setSubmitting(false)
      }
    },
    [schema, values],
  )

  return { values, setValues, set, bind, errors, setErrors, submitting, formError, setFormError, handleSubmit }
}
