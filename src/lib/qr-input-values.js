const WIFI_DEFAULTS = {
  ssid: '',
  password: '',
  encryption: 'WPA',
  hidden: false,
}

function unescapeWifi(value) {
  let result = ''
  let escaped = false
  for (const char of value) {
    if (escaped) {
      result += char
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else {
      result += char
    }
  }
  return escaped ? `${result}\\` : result
}

function splitUnescaped(value, delimiter) {
  const parts = []
  let part = ''
  let escaped = false
  for (const char of value) {
    if (escaped) {
      part += `\\${char}`
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === delimiter) {
      parts.push(part)
      part = ''
    } else {
      part += char
    }
  }
  if (escaped) part += '\\'
  parts.push(part)
  return parts
}

function splitWifiField(value) {
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (escaped) {
      escaped = false
    } else if (char === '\\') {
      escaped = true
    } else if (char === ':') {
      return [value.slice(0, index), value.slice(index + 1)]
    }
  }
  return [value, '']
}

export function escapeWifiValue(value = '') {
  return String(value).replace(/([\\;,:])/g, '\\$1')
}

export function generateWifiString(data) {
  return `WIFI:T:${escapeWifiValue(data.encryption)};S:${escapeWifiValue(data.ssid)};P:${escapeWifiValue(data.password)};H:${data.hidden ? 'true' : 'false'};`
}

export function parseWifiString(value) {
  if (typeof value !== 'string' || !value.toUpperCase().startsWith('WIFI:')) return { ...WIFI_DEFAULTS }
  const fields = splitUnescaped(value.slice(5), ';')
  const parsed = { ...WIFI_DEFAULTS }
  for (const field of fields) {
    if (!field) continue
    const [rawKey, rawValue] = splitWifiField(field)
    const key = rawKey.toUpperCase()
    const fieldValue = unescapeWifi(rawValue)
    if (key === 'S') parsed.ssid = fieldValue
    if (key === 'P') parsed.password = fieldValue
    if (key === 'T' && fieldValue) parsed.encryption = fieldValue
    if (key === 'H') parsed.hidden = /^(true|1)$/i.test(fieldValue)
  }
  return parsed
}

function decodeSafely(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function generateEmailString(data) {
  const params = new URLSearchParams()
  if (data.subject) params.set('subject', data.subject)
  if (data.body) params.set('body', data.body)
  const query = params.toString()
  return `mailto:${data.email || ''}${query ? `?${query}` : ''}`
}

export function parseEmailString(value) {
  const blank = { email: '', subject: '', body: '' }
  if (typeof value !== 'string') return blank
  const source = value.replace(/^mailto:/i, '')
  const queryIndex = source.indexOf('?')
  const recipient = queryIndex === -1 ? source : source.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : source.slice(queryIndex + 1)
  const params = new URLSearchParams(query)
  return {
    email: decodeSafely(recipient),
    subject: params.get('subject') || '',
    body: params.get('body') || '',
  }
}

export function generatePhoneString(phone) {
  return `tel:${phone || ''}`
}

export function parsePhoneValue(value, countries) {
  const raw = typeof value === 'string' ? value.replace(/^tel:/i, '') : ''
  const digits = raw.replace(/\D/g, '')
  const country = [...countries]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((item) => digits.startsWith(item.dialCode.replace(/\D/g, ''))) || countries[0]
  const dialDigits = country?.dialCode.replace(/\D/g, '') || ''
  return {
    country,
    digits: country && digits.startsWith(dialDigits) ? digits.slice(dialDigits.length) : digits,
  }
}