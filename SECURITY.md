# Seguridad

No publiques vulnerabilidades con instrucciones de explotación, secretos ni datos reales en un issue público. Usa el canal privado de seguridad del repositorio si está habilitado; en caso contrario, solicita un contacto privado sin incluir detalles sensibles.

## Alcance de las protecciones

- La biblioteca requiere sesión y aplica comprobaciones de propietario.
- AES-256-GCM protege el contenido almacenado; no protege un servidor comprometido que tenga acceso a las claves.
- Las claves no están en el código ni en la base de datos. Su pérdida puede hacer irrecuperables los QRs guardados.
- Los QRs públicos y descargados no están cifrados.
- Los logos nuevos se rasterizan en el navegador. El servidor limita el tamaño y los campos aceptados.
- Los límites de frecuencia se calculan por IP según `TRUST_PROXY` (por defecto un proxy inverso). Si expones la app directamente usa `TRUST_PROXY=0`; si hay varios proxies, ajusta el número; un valor incorrecto permite falsificar la IP con `X-Forwarded-For` y evadir los límites. Además, los límites son por proceso. Una instalación con varias réplicas debe añadir límites compartidos o en el proxy antes de exponerse a tráfico abusivo.

## Operación

Usa HTTPS, una base con acceso restringido y respaldos protegidos. No registres cuerpos de peticiones, credenciales, cookies, contenido de QRs ni respuestas completas del proveedor de apoyo.

Conserva por separado las claves necesarias para restaurar cada respaldo. No rotes las claves de cifrado sin un procedimiento de recifrado y recuperación verificado.

## Herramientas de desarrollo

`drizzle-kit` conserva una dependencia transitiva antigua de `esbuild` con un aviso moderado relativo a su servidor de desarrollo. No se utiliza ese servidor para servir Q2R2: la aplicación usa una versión actualizada de Vite. No expongas herramientas de administración de base de datos ni servidores auxiliares a Internet. Revisa `npm audit` al actualizar la herramienta de esquema; no apliques una degradación automática que pueda romper las migraciones.