import { Link } from 'react-router'

export function CairnMark({ light = false }: { light?: boolean }) {
  return (
    <svg className="cairn-mark" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" className={light ? 'mark-ring light' : 'mark-ring'} />
      <rect x="11" y="29" width="26" height="6" rx="3" className="mark-cream" />
      <rect x="15" y="20" width="18" height="6" rx="3" className="mark-taupe" />
      <rect x="20" y="11" width="9" height="5" rx="2.5" className="mark-orange" />
    </svg>
  )
}

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label="Cairn Bank home">
      <CairnMark light={light} />
      <span>CAIRN<small>BANK</small></span>
    </Link>
  )
}
