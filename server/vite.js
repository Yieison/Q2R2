import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const SPA_ROUTES = new Set(['/', '/auth', '/app', '/apoyo/resultado'])

const ROUTE_META = {
  '/': {
    title: 'Q2R2 — Generador de códigos QR gratis',
    description: 'Crea, personaliza y descarga códigos QR PNG gratis en tu navegador. Una cuenta es opcional y solo sirve para guardarlos.',
    jsonLd: true,
  },
  '/auth': {
    title: 'Iniciar sesión o crear cuenta | Q2R2',
    description: 'Usa una cuenta opcional para guardar y volver a editar tus códigos QR.',
  },
  '/app': {
    title: 'Generador QR gratis | Q2R2',
    description: 'Crea y descarga códigos QR PNG gratis, sin cuenta.',
  },
  '/apoyo/resultado': {
    title: 'Resultado de aporte | Q2R2',
    description: 'Consulta el estado de tu aporte a Q2R2.',
  },
}

function isSpaRoute(pathname) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  return SPA_ROUTES.has(clean)
}

function escAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function safeOrigin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
  const rawHost = req.headers['x-forwarded-host'] || req.headers.host || ''
  const host = /^[a-zA-Z0-9.\-:]+(:[0-9]+)?$/.test(rawHost) ? rawHost : 'localhost'
  return `${proto}://${host}`
}

function buildJsonLd(origin) {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: 'Q2R2',
        url: `${origin}/`,
        logo: { '@type': 'ImageObject', url: `${origin}/qr-icon.svg` },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'Q2R2',
        url: `${origin}/`,
        inLanguage: 'es-CO',
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Q2R2 — Generador de códigos QR',
        url: `${origin}/app`,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        description: 'Generador gratuito de códigos QR personalizados en el navegador.',
        featureList: ['QR para URL, texto, WiFi, email y teléfono', 'Colores, degradados y logo', 'Exportación PNG en alta calidad', 'Cuenta opcional para guardar'],
        inLanguage: 'es-CO',
      },
    ],
  }
  return `<script type="application/ld+json">\n    ${JSON.stringify(data, null, 2).split('\n').join('\n    ')}\n    </script>`
}

function buildSeoHead(pathname, origin) {
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/'
  const meta = ROUTE_META[clean] || ROUTE_META['/']
  const pageUrl = `${origin}${clean === '/' ? '/' : clean}`
  return `
    <title>${escAttr(meta.title)}</title>
    <meta name="description" content="${escAttr(meta.description)}" />
    <link rel="canonical" href="${escAttr(pageUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Q2R2" />
    <meta property="og:locale" content="es_CO" />
    <meta property="og:url" content="${escAttr(pageUrl)}" />
    <meta property="og:title" content="${escAttr(meta.title)}" />
    <meta property="og:description" content="${escAttr(meta.description)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escAttr(meta.title)}" />
    <meta name="twitter:description" content="${escAttr(meta.description)}" />
    ${meta.jsonLd ? buildJsonLd(origin) : ''}`
}

function injectSeoHead(html, pathname, req) {
  return html
    .replace('<!-- SEO_HEAD -->', buildSeoHead(pathname, safeOrigin(req)))
    .replace('<!-- STATIC_BODY -->', '')
}

export function setupSeoFiles(app) {
  app.get('/robots.txt', (req, res) => {
    const origin = safeOrigin(req)
    res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /apoyo/\n\nSitemap: ${origin}/sitemap.xml\n`)
  })
  app.get('/sitemap.xml', (req, res) => {
    const origin = safeOrigin(req)
    const urls = ['/', '/app', '/auth']
      .map((path) => `  <url><loc>${escAttr(origin + path)}</loc></url>`)
      .join('\n')
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  })
}

export async function setupVite(app, server) {
  const { createServer: createViteServer } = await import('vite')
  const vite = await createViteServer({
    root: rootDir,
    appType: 'custom',
    server: { middlewareMode: true, hmr: { server }, host: '0.0.0.0', allowedHosts: true },
  })
  app.use(vite.middlewares)
  app.use(async (req, res, next) => {
    const url = req.originalUrl
    if (!isSpaRoute(url.split('?')[0])) {
      res.status(404).set({ 'Content-Type': 'text/plain' }).end('404 Not Found')
      return
    }
    try {
      let template = await fs.promises.readFile(path.resolve(rootDir, 'index.html'), 'utf-8')
      template = await vite.transformIndexHtml(url, template)
      res.status(200).set({ 'Content-Type': 'text/html' }).end(injectSeoHead(template, url, req))
    } catch (err) {
      vite.ssrFixStacktrace(err)
      next(err)
    }
  })
}

export function serveStatic(app) {
  const distPath = path.resolve(rootDir, 'dist')
  if (!fs.existsSync(distPath)) throw new Error(`Could not find the build directory: ${distPath}. Run "npm run build" first.`)
  app.use(express.static(distPath, { index: false }))
  app.use((req, res, next) => {
    if (!isSpaRoute(req.path)) {
      res.status(404).set({ 'Content-Type': 'text/plain' }).end('404 Not Found')
      return
    }
    try {
      const html = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8')
      res.status(200).set({ 'Content-Type': 'text/html' }).end(injectSeoHead(html, req.path, req))
    } catch (err) {
      next(err)
    }
  })
}