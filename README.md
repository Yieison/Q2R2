# Q2R2

Generador gratuito de códigos QR para enlaces, texto, WiFi, correo y teléfono. Personaliza colores, degradados, formas y logos, y descarga el PNG directamente desde el navegador, sin cuenta ni marcas de agua.

Las cuentas son opcionales: sirven para guardar, editar y recuperar QRs en una biblioteca privada cifrada.

## Desarrollo

Requisitos: Node.js 20.19+ o 22.12+, npm y PostgreSQL.

1. `npm ci`
2. Copia `.env.example` a `.env` y define `DATABASE_URL` y un `SESSION_SECRET` aleatorio (mínimo 32 bytes).
3. `npm run db:push` para crear el esquema.
4. `npm run dev` — la aplicación escucha en el puerto 5000.

Producción:

```sh
npm run build
npm start
```

Usa HTTPS en producción: las cookies de sesión son seguras y no funcionan sobre HTTP.

| Comando | Uso |
| --- | --- |
| `npm run dev` | Express y Vite en desarrollo |
| `npm run build` | Compilación del cliente |
| `npm start` | Servidor de producción |
| `npm test` | Pruebas de cifrado y validación |
| `npm run db:push` | Aplicar el esquema PostgreSQL |

## Datos y privacidad

- Crear y descargar un QR ocurre en el navegador; el contenido solo se envía al servidor si eliges guardarlo.
- Los QRs guardados (nombre, contenido, estilo y logo) se cifran con AES-256-GCM. Es cifrado en el servidor, no de extremo a extremo.
- Las contraseñas se protegen con scrypt y salt individual.
- La clave de cifrado se deriva de `SESSION_SECRET`; opcionalmente puedes definir `QR_ENCRYPTION_KEY` (64 caracteres hexadecimales). No cambies una clave en uso sin volver a cifrar los registros existentes.
- Un QR descargado es legible por cualquiera que lo escanee; borrarlo de la biblioteca no desactiva las copias descargadas.

## Apoyo voluntario

Opcionalmente puedes aceptar aportes únicos a través de Wompi configurando las variables `WOMPI_*` de `.env.example` con las credenciales de tu propia cuenta. Si no están definidas, la sección de apoyo se muestra como no disponible y el resto de la aplicación funciona igual. El apoyo no desbloquea funciones ni guarda datos de pago.

## Estructura

- `src/`: interfaz React, generador, autenticación y biblioteca.
- `server/`: Express, sesiones y almacenamiento cifrado.
- `shared/`: esquema y opciones de QR compartidas.
- `tests/`: pruebas con datos sintéticos.

## Contribuir

Abre un issue para proponer cambios importantes. Antes de enviar cambios, ejecuta `npm test` y `npm run build`.

## Licencia

MIT. Consulta [LICENSE](LICENSE).
