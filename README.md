# Vacunadores Bajo Cauca · Ciclo II 2026

Dos apps (PWA) que comparten la misma información:

- **App de vacunadores** (`/`): cada vacunador se registra con su cédula y una clave, pide inyectores, repuestos e insumos, ve en qué va su pedido y qué equipos tiene a cargo. Trae el calendario del ciclo en el Bajo Cauca (27 oct – 16 dic 2026, Resolución ICA 00019881) y los avisos de la coordinación.
- **App admin** (`/admin.html`): la coordinación aprueba vacunadores, maneja el inventario (entradas, salidas, ajustes, kárdex), aprueba y despacha pedidos (descuenta inventario), controla los equipos prestados y su devolución, publica avisos y exporta todo a Excel (CSV).

Ambas en español e inglés, con fotos reales.

## Cómo funciona por dentro
- Páginas en HTML, CSS y JavaScript sin frameworks.
- Servidor: una función de Netlify (`netlify/functions/api.mjs`) que guarda los datos en **Netlify Blobs**. No hay que configurar base de datos.
- **Debe publicarse en Netlify** (GitHub Pages no corre la función).
- El robot `.github/workflows/fotos.yml` baja las fotos de Wikimedia Commons a `img/` y arma la imagen para compartir (`img/og.jpg`) y los íconos.

## Clave del administrador
La primera vez que se abre `/admin.html`, la clave que se escriba (6 a 10 números) queda guardada como clave del administrador. Si se quiere fijar desde Netlify, se crea la variable de entorno `ADMIN_PIN`.

## Probar en el computador
```
npm install
npm run dev   # http://localhost:8888
```

---
Desarrollada por **Vibras Positivas HM** · Caucasia, Antioquia · WhatsApp 311 770 0431 · Derechos reservados.
