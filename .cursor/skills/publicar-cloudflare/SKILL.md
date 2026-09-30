---
name: publicar-cloudflare
description: >-
  Publica el Worker diypando (código y assets de public/) en Cloudflare con
  Wrangler. Usar cuando el usuario pida publicar, desplegar, deploy o subir
  los cambios a Cloudflare. No desplegar si no está logueado en Wrangler.
---

# Publicar diypando en Cloudflare

Solo ejecutar este flujo cuando el usuario pida publicar o desplegar. No desplegar al terminar otro cambio.

Trabajar en la raíz del repo, donde está `wrangler.jsonc`. El Worker se llama `diypando`. El entry es `src/index.js` y los estáticos salen de `public/`. Usar el Wrangler del proyecto (`npx wrangler`). No instalar paquetes.

## 1. Sesión

```bash
npx wrangler whoami
```

Si no hay cuenta logueada, parar. Decir que hace falta `npx wrangler login` y no desplegar. No lanzar el login solo: es interactivo.

## 2. Configuración

```bash
npx wrangler check
```

Si falla, corregir el error y volver a correr el check. No desplegar con el check en rojo.

## 3. Deploy

```bash
npx wrangler deploy
```

Al terminar, informar la URL que imprime Wrangler (suele ser `https://diypando.<subdominio>.workers.dev`) y si el deploy salió bien. No cambiar `wrangler.jsonc`, secrets ni el nombre del Worker salvo que el usuario lo pida.
