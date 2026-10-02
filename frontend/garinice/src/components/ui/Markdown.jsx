// Tiny, safe Markdown subset renderer for CMS content (## h2, ### h3, - lists, **bold**,
// *italic*, [links](/path)). Produces React elements — never injects HTML.
import { Fragment } from 'react'
import { Link } from 'react-router-dom'

function inline(text, keyPrefix) {
  const out = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('[')) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (href.startsWith('/')) out.push(<Link key={key} to={href}>{label}</Link>)
      else if (/^https?:\/\//.test(href)) out.push(<a key={key} href={href} target="_blank" rel="noopener noreferrer">{label}</a>)
      else out.push(label)
    } else out.push(<em key={key}>{tok.slice(1, -1)}</em>)
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source = '', className = 'prose-gn' }) {
  const blocks = source.replace(/\r/g, '').split(/\n{2,}/)
  return (
    <div className={className}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n')
        if (block.startsWith('### ')) {
          return (
            <Fragment key={bi}>
              <h3>{inline(lines[0].slice(4), `h${bi}`)}</h3>
              {lines.length > 1 && <p>{inline(lines.slice(1).join(' '), `p${bi}`)}</p>}
            </Fragment>
          )
        }
        if (block.startsWith('## ')) {
          return (
            <Fragment key={bi}>
              <h2>{inline(lines[0].slice(3), `h${bi}`)}</h2>
              {lines.length > 1 && (lines[1].startsWith('- ') ? <ul>{lines.slice(1).map((l, li) => <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>)}</ul> : <p>{inline(lines.slice(1).join(' '), `p${bi}`)}</p>)}
            </Fragment>
          )
        }
        if (lines.every((l) => l.startsWith('- '))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.slice(2), `l${bi}-${li}`)}</li>)}</ul>
        }
        return <p key={bi}>{inline(lines.join(' '), `p${bi}`)}</p>
      })}
    </div>
  )
}
