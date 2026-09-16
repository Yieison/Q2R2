import { useEffect, useRef, useState } from 'react'
import {
  generateEmailString,
  generatePhoneString,
  generateWifiString,
  parseEmailString,
  parsePhoneValue,
  parseWifiString,
} from '../lib/qr-input-values'

const QRInput = ({ type, value, onChange }) => {
  const [wifiData, setWifiData] = useState({
    ssid: '',
    password: '',
    encryption: 'WPA',
    hidden: false
  })

  const [emailData, setEmailData] = useState({
    email: '',
    subject: '',
    body: ''
  })

  const phoneCountries = [
    { code: 'CO', name: 'Colombia', dialCode: '+57', format: [3, 3, 4], placeholder: '313 359 8040' },
    { code: 'MX', name: 'México', dialCode: '+52', format: [3, 3, 4], placeholder: '555 123 4567' },
    { code: 'US', name: 'Estados Unidos', dialCode: '+1', format: [3, 3, 4], placeholder: '415 555 2671' },
    { code: 'CA', name: 'Canadá', dialCode: '+1', format: [3, 3, 4], placeholder: '604 555 0199' },
    { code: 'ES', name: 'España', dialCode: '+34', format: [3, 2, 2, 2], placeholder: '600 12 34 56' },
    { code: 'AR', name: 'Argentina', dialCode: '+54', format: [2, 4, 4], placeholder: '11 2345 6789' },
    { code: 'BR', name: 'Brasil', dialCode: '+55', format: [2, 5, 4], placeholder: '11 91234 5678' },
    { code: 'PE', name: 'Perú', dialCode: '+51', format: [3, 3, 3], placeholder: '912 345 678' },
    { code: 'CL', name: 'Chile', dialCode: '+56', format: [2, 4, 4], placeholder: '9 1234 5678' },
    { code: 'VE', name: 'Venezuela', dialCode: '+58', format: [3, 3, 4], placeholder: '412 123 4567' },
    { code: 'EC', name: 'Ecuador', dialCode: '+593', format: [2, 3, 4], placeholder: '99 123 4567' },
    { code: 'UY', name: 'Uruguay', dialCode: '+598', format: [1, 3, 4], placeholder: '9 123 4567' },
    { code: 'BO', name: 'Bolivia', dialCode: '+591', format: [2, 3, 4], placeholder: '7 123 4567' },
    { code: 'PY', name: 'Paraguay', dialCode: '+595', format: [3, 3, 3], placeholder: '981 123 456' },
    { code: 'CR', name: 'Costa Rica', dialCode: '+506', format: [4, 4], placeholder: '8787 1234' },
    { code: 'PA', name: 'Panamá', dialCode: '+507', format: [4, 4], placeholder: '6123 4567' },
    { code: 'DO', name: 'República Dominicana', dialCode: '+1', format: [3, 3, 4], placeholder: '829 555 1234' },
    { code: 'PR', name: 'Puerto Rico', dialCode: '+1', format: [3, 3, 4], placeholder: '787 555 7890' },
    { code: 'GT', name: 'Guatemala', dialCode: '+502', format: [4, 4], placeholder: '5123 4567' },
    { code: 'SV', name: 'El Salvador', dialCode: '+503', format: [4, 4], placeholder: '7123 4567' },
    { code: 'HN', name: 'Honduras', dialCode: '+504', format: [4, 4], placeholder: '9123 4567' },
    { code: 'NI', name: 'Nicaragua', dialCode: '+505', format: [4, 4], placeholder: '8123 4567' },
    { code: 'CU', name: 'Cuba', dialCode: '+53', format: [2, 4, 4], placeholder: '5 1234 5678' }
  ]

  const [phoneCountry, setPhoneCountry] = useState(phoneCountries[0])
  const [phoneNumber, setPhoneNumber] = useState('')
  const lastEmittedValueRef = useRef(null)
  const syncedTypeRef = useRef(null)

  const formatNationalNumber = (digits = '', groups = []) => {
    const maxLength = groups.reduce((acc, group) => acc + group, 0)
    const limited = digits.slice(0, maxLength)
    const segments = []
    let index = 0

    groups.forEach(group => {
      if (limited.length > index) {
        segments.push(limited.slice(index, index + group))
      }
      index += group
    })

    const overflow = digits.slice(maxLength)
    return [segments.join(' '), overflow].filter(Boolean).join(' ')
  }

  const updatePhoneValue = (rawDigits = '', country = phoneCountry) => {
    const formattedNational = formatNationalNumber(rawDigits, country.format)
    setPhoneNumber(formattedNational)

    const e164 = rawDigits ? `${country.dialCode}${rawDigits}` : ''
    const nextValue = generatePhoneString(e164)
    lastEmittedValueRef.current = nextValue
    onChange(nextValue)
  }

  useEffect(() => {
    const typeChanged = syncedTypeRef.current !== type
    const isExternalValue = lastEmittedValueRef.current !== value
    if (!typeChanged && !isExternalValue) return

    if (type === 'wifi') {
      setWifiData(parseWifiString(value))
    } else if (type === 'email') {
      setEmailData(parseEmailString(value))
    } else if (type === 'phone') {
      const parsed = parsePhoneValue(value, phoneCountries)
      setPhoneCountry(parsed.country)
      setPhoneNumber(formatNationalNumber(parsed.digits, parsed.country.format))
    }

    syncedTypeRef.current = type
    lastEmittedValueRef.current = value
  }, [type, value])

  const handleWifiChange = (field, val) => {
    const newData = { ...wifiData, [field]: val }
    setWifiData(newData)
    const nextValue = generateWifiString(newData)
    lastEmittedValueRef.current = nextValue
    onChange(nextValue)
  }

  const handleEmailChange = (field, val) => {
    const newData = { ...emailData, [field]: val }
    setEmailData(newData)
    const nextValue = generateEmailString(newData)
    lastEmittedValueRef.current = nextValue
    onChange(nextValue)
  }

  const handlePhoneChange = (val) => {
    const onlyDigits = val.replace(/\D/g, '')
    updatePhoneValue(onlyDigits, phoneCountry)
  }

  const handleCountryChange = (code) => {
    const selected = phoneCountries.find(country => country.code === code) ?? phoneCountries[0]
    setPhoneCountry(selected)

    const rawDigits = phoneNumber.replace(/\D/g, '')
    updatePhoneValue(rawDigits, selected)
  }

  switch (type) {
    case 'url':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL del sitio web
          </label>
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://ejemplo.com"
            className="input-field"
          />
          <p className="text-xs text-gray-500 mt-2">
            Ingresa la URL completa incluyendo https://
          </p>
        </div>
      )

    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Texto libre
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Escribe tu mensaje aquí..."
            rows="5"
            className="input-field resize-none"
          />
          <p className="text-xs text-gray-500 mt-2">
            Puede ser cualquier texto, mensaje o información
          </p>
        </div>
      )

    case 'wifi':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de Red (SSID)
            </label>
            <input
              type="text"
              value={wifiData.ssid}
              onChange={(e) => handleWifiChange('ssid', e.target.value)}
              placeholder="Mi Red WiFi"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="text"
              value={wifiData.password}
              onChange={(e) => handleWifiChange('password', e.target.value)}
              placeholder="contraseña123"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Seguridad
            </label>
            <select
              value={wifiData.encryption}
              onChange={(e) => handleWifiChange('encryption', e.target.value)}
              className="input-field"
            >
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">Sin contraseña</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hidden"
              checked={wifiData.hidden}
              onChange={(e) => handleWifiChange('hidden', e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
            />
            <label htmlFor="hidden" className="text-sm text-gray-700">
              Red oculta
            </label>
          </div>

          <p className="text-xs text-gray-500">
            Al escanear este QR, el dispositivo se conectará automáticamente a la red WiFi
          </p>
        </div>
      )

    case 'email':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dirección de Email
            </label>
            <input
              type="email"
              value={emailData.email}
              onChange={(e) => handleEmailChange('email', e.target.value)}
              placeholder="ejemplo@correo.com"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asunto (opcional)
            </label>
            <input
              type="text"
              value={emailData.subject}
              onChange={(e) => handleEmailChange('subject', e.target.value)}
              placeholder="Asunto del correo"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mensaje (opcional)
            </label>
            <textarea
              value={emailData.body}
              onChange={(e) => handleEmailChange('body', e.target.value)}
              placeholder="Contenido del mensaje..."
              rows="4"
              className="input-field resize-none"
            />
          </div>

          <p className="text-xs text-gray-500">
            Al escanear, se abrirá el cliente de email con estos datos prellenados
          </p>
        </div>
      )

    case 'phone':
      return (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              País
            </label>
            <select
              value={phoneCountry.code}
              onChange={(e) => handleCountryChange(e.target.value)}
              className="input-field"
            >
              {phoneCountries.map(country => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.dialCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número móvil
            </label>
            <div className="flex gap-2">
              <div className="dial-code-pill">{phoneCountry.dialCode}</div>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder={phoneCountry.placeholder}
                className="input-field flex-1"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              El QR generará el número completo en formato internacional {phoneCountry.dialCode}.
            </p>
          </div>
        </div>
      )

    default:
      return null
  }
}

export default QRInput
