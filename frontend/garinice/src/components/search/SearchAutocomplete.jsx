import { useQuery } from '@tanstack/react-query'
import { Building2, Car, Hash, Layers, Search, Tag } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { useDebounce, useOnClickOutside } from '../../hooks/useUtils'
import { cn } from '../../lib/format'

const ICONS = { make: Tag, model: Car, body: Layers, dealer: Building2, vehicle: Hash }
const TYPE_LABEL = { make: 'Make', model: 'Model', body: 'Body type', dealer: 'Dealer', vehicle: 'Listing' }

/**
 * ARIA 1.2 combobox: type-ahead suggestions for makes, models, body types, dealers
 * and listing reference IDs. Enter without a highlighted option runs a keyword search.
 */
export function SearchAutocomplete({ placeholder = 'Try Toyota Prado, Harrier, Mazda CX-5…', className, inputClassName, size = 'md', onSubmitted, autoFocus, defaultValue = '', onSearch, value: valueProp, onValueChange }) {
  const [inner, setInner] = useState(defaultValue)
  const value = valueProp ?? inner
  const setValue = (v) => {
    setInner(v)
    onValueChange?.(v)
  }
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const navigate = useNavigate()
  const listId = useId()
  const wrap = useRef(null)
  const q = useDebounce(value.trim(), 180)
  const { data } = useQuery({ queryKey: ['suggest', q], queryFn: () => api.catalog.suggest(q), enabled: q.length >= 2, staleTime: 60_000 })
  const items = q.length >= 2 ? data?.items || [] : []
  useOnClickOutside(wrap, () => setOpen(false), open)

  const go = (href) => {
    setOpen(false)
    setActive(-1)
    navigate(href)
    onSubmitted?.()
  }
  const submit = (e) => {
    e?.preventDefault()
    if (active >= 0 && items[active]) return go(items[active].href)
    const term = value.trim()
    if (onSearch) {
      setOpen(false)
      onSearch(term)
      return
    }
    go(term ? `/cars?q=${encodeURIComponent(term)}` : '/cars')
  }
  const onKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(-1, a - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    }
  }
  const showList = open && items.length > 0

  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)} ref={wrap}>
      <label htmlFor={`${listId}-input`} className="sr-only">Search cars by make, model, keyword, dealer or reference</label>
      <Search className={cn('pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400', size === 'lg' ? 'size-5' : 'size-4.5')} aria-hidden="true" />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        className={cn(
          'w-full rounded-lg border border-line bg-white pr-4 text-ink placeholder:text-slate-400 focus:border-teal-600 focus:ring-3 focus:ring-teal-600/15 focus:outline-none',
          size === 'lg' ? 'h-13 pl-11 text-base' : size === 'sm' ? 'h-10 pl-10 text-sm' : 'h-11 pl-10 text-[15px]',
          inputClassName,
        )}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-xl border border-line bg-white p-1.5 shadow-lift">
          {items.map((item, i) => {
            const Icon = ICONS[item.type] || Search
            return (
              <li
                key={`${item.type}-${item.href}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(item.href)}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm', i === active ? 'bg-slate-100' : '')}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{item.label}</span>
                  <span className="block text-xs text-muted">{TYPE_LABEL[item.type]}{item.sub ? ` · ${item.sub}` : ''}</span>
                </span>
              </li>
            )
          })}
          <li role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => submit()} className="mt-1 flex cursor-pointer items-center gap-2 border-t border-line px-3 pt-2.5 pb-1.5 text-sm text-teal-700 hover:underline">
            <Search className="size-4" aria-hidden="true" /> Search all cars for “{value.trim()}”
          </li>
        </ul>
      )}
    </form>
  )
}
