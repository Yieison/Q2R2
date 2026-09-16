const DRAFT_KEY = 'q2r2-save-draft'
const MAX_AGE_MS = 15 * 60 * 1000

export function stripTransientStyle(style) {
  const logo = { ...(style?.logo || {}) }
  delete logo.renderSrc
  return { ...style, logo }
}

export function saveQrDraft(draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      ...draft,
      style: stripTransientStyle(draft.style),
      createdAt: Date.now(),
    }))
    return true
  } catch {
    return false
  }
}

export function getQrDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw)
    const age = Date.now() - Number(draft?.createdAt)
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      sessionStorage.removeItem(DRAFT_KEY)
      return null
    }
    return draft
  } catch {
    return null
  }
}

export function clearQrDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // Session storage is optional; an unavailable store must not block QR creation.
  }
}