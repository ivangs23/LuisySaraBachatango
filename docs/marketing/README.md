# QR para flyers

## Destino

```
https://luisysarabachatango.com/curso-bachatango?utm_source=flyer&utm_medium=qr&utm_campaign=bachatango
```

Cae directo en el funnel de venta: hero con `Antes 150 €` tachado, `119 €` y
«Quedan 5 plazas disponibles». Verificado HTTP 200 el 2026-09-22.

## Ficheros

| Fichero | Corrección | Módulos | Cuándo usarlo |
|---|---|---|---|
| `qr-curso-bachatango.svg` / `.png` | Q (25 %) | 49 × 49 | **Por defecto.** El que mandas a imprenta. |
| `qr-curso-bachatango-con-logo.svg` / `.png` | H (30 %) | 57 × 57 | Solo si vais a superponer el logo en el centro. |

El `.svg` es vectorial: escala a cualquier tamaño sin pixelar, es lo que quiere
la imprenta. El `.png` son 2400 × 2400 px, para Canva, redes o quien no acepte
vectores.

Los dos fueron decodificados tras generarlos y devuelven la URL exacta de arriba.

## Tamaño de impresión

Mínimo **30 mm** de lado. Recomendado **35–40 mm** en un flyer A5 o A6.

La regla real no es el lado sino el módulo (el cuadradito): debe medir al menos
0,5 mm. Con 49 módulos más el margen, eso da los 30 mm. Por debajo, los móviles
viejos y las cámaras con poca luz empiezan a fallar.

Si el flyer se lee a más de medio metro de distancia (cartel, roll-up), la regla
es: **lado del QR ≥ distancia de lectura / 10**. A 2 m → 20 cm de QR.

## Zona de silencio

El margen blanco alrededor ya va incluido en los ficheros (4 módulos). **No lo
recortes** y no metas texto ni gráficos dentro. Es lo que más rompe QR impresos.

## Color

Negro sobre blanco. No lo pases al dorado de marca (`#c0a062`): sobre blanco da
una relación de contraste de ~2,3:1 y muchos lectores no lo cogen. Si lo quieres
en la línea gráfica, oscuro sobre claro y nunca al revés; el contraste mínimo
fiable es 4:1 y cuanto más, mejor.

## Medición

En GA4: **Adquisición → Adquisición de tráfico**, dimensión *Origen / medio de
la sesión* → `flyer / qr`, campaña `bachatango`.

⚠️ Solo cuenta a quien **acepta las cookies de analítica**. El banner de consentimiento
deniega por defecto ([context/ConsentContext.tsx](../../context/ConsentContext.tsx)),
así que las visitas del flyer van a estar infravaloradas. Lee la tendencia, no el
número absoluto.

## Regenerarlo

```bash
npx qrcode -e Q -t svg -m 4 -o docs/marketing/qr-curso-bachatango.svg \
  'https://luisysarabachatango.com/curso-bachatango?utm_source=flyer&utm_medium=qr&utm_campaign=bachatango'
```

Si cambias la URL, **decodifica el resultado antes de mandarlo a imprenta**. Un
QR mal generado se ve idéntico a uno bueno.
