import { useEffect } from 'react'

const BASE_URL = import.meta.env.VITE_PUBLIC_URL || ''

function upsertMeta(selector, attrName, attrValue, content) {
  let el = document.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attrName, attrValue)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
  return el
}

function upsertLink(rel, href) {
  let el = document.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
  return el
}

export function usePageMeta({ title, description, path, ogType = 'website' }) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    const origin = BASE_URL || window.location.origin
    const url = origin + (path || window.location.pathname)

    upsertMeta('meta[name="description"]', 'name', 'description', description)
    upsertLink('canonical', url)

    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title)
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description)
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url)
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', ogType)
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', 'Q2R2')
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'es_CO')

    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary')
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title)
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description)

    return () => {
      document.title = prevTitle
    }
  }, [title, description, path, ogType])
}
