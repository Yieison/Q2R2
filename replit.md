# Q2R2

Aplicación React/Vite y Express en JavaScript, con PostgreSQL y Drizzle. Interfaz en español. La generación y descarga de QRs ocurre en el navegador, gratis y sin registro. Las cuentas locales de usuario/contraseña son opcionales, solo para guardar una biblioteca.

## Desarrollo

- `npm run dev`: Express + Vite, puerto 5000.
- `npm run build`: cliente de producción en `dist`.
- `npm start`: Express en producción.
- `npm test`: pruebas con datos sintéticos.
- `npm run db:push`: esquema; revisar la propuesta antes de aplicar cambios.

No reinstalar herramientas de renderizado de servidor: los PNG se crean con `qr-code-styling` en el navegador. No exponer un endpoint de renderizado público.

## Contratos

- API `/api/qrcodes`: requiere sesión y propiedad. El cliente recibe datos descifrados del propietario.
- En PostgreSQL solo se guardan datos/estilos cifrados y metadatos; no el PNG. El logo compacto forma parte del contenido cifrado existente. `renderSrc` se reconstruye en el navegador.
- El borrador temporal de autenticación solo se crea al elegir guardar; no debe subirse automáticamente al iniciar sesión.
- El apoyo voluntario no tiene ningún efecto sobre los QRs ni sobre las cuentas.
- La información básica de privacidad está integrada en la aplicación y en README.

## Seguridad y datos

Antes de escuchar conexiones, el servidor valida las claves y cifra cualquier QR pendiente en lotes transaccionales. Un fallo de descifrado debe detener el inicio; no usar datos vacíos ni una clave temporal como alternativa.

La clave de QR se deriva de `SESSION_SECRET` mediante HKDF con contexto propio, o usa `QR_ENCRYPTION_KEY` cuando se configure. Los sobres identifican la fuente. Cambiar una clave sin recifrar los registros asociados puede hacerlos irrecuperables; ver README y SECURITY.

Los secretos solo se usan en el servidor. No imprimirlos ni registrar cuerpos de peticiones/respuestas que contengan QRs, contraseñas o información del proveedor.

## Repositorio público

README documenta instalación, datos y claves; LICENSE contiene MIT. Capturas, archivos internos, secretos y volcados están ignorados.