# Decisiones · NyPE, UTDT

HTML/CSS/JavaScript sin compilación, GitHub Pages y el mismo Supabase y estilo de `two-armed-bandit` y `pilas-emociones`. Anónimo, 22 pantallas, respuestas y avance persistentes.

## Enlaces

- [Estudiantes](https://gsolovey-utdt.github.io/decisiones/index.html?s=clase21) y [QR PNG](entregables/clase21-qr.png).
- [Docente](https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&v=panel): ingresá la clave privada. El enlace completo con clave está en `entregables/ACCESO-DOCENTE-clase21.txt`, excluido de Git.
- [Demo de 40 participantes](https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&demo=1): datos simulados en el navegador, sin escribir en Supabase.

## En clase

1. Abrí el panel docente y desplegá **Administrar la sesión → Abrir recepción**. Empieza cerrada.
2. Proyectá el QR. La barra docente ofrece una URL para cada vista; podés abrirlas en pestañas o guardarlas como favoritos. **Proyectar** usa 16:9; **Esc** sale.
3. Las vistas se actualizan cada cuatro segundos y muestran n. Las soluciones y los valores reales empiezan ocultos: tocá **Mostrar respuesta** cuando corresponda.
4. **Cerrar recepción** bloquea ingresos y envíos. Los celulares muestran «La actividad ya cerró». Reabrir permite continuar.
5. **Exportar CSV** descarga respuestas originales e interpretadas, condición/ancla, orden de pantallas/opciones y tiempos. UTF-8 con BOM y protección contra fórmulas de planilla.
6. **Borrar respuestas de esta sesión** pide escribir `clase21`, vacía únicamente esa sesión, cierra la recepción e invalida envíos pendientes anteriores. El borrado es permanente.

El celular conserva su identificador y avance en localStorage. Si falla la conexión, conserva el envío para reintentar. Otro navegador o borrar el almacenamiento genera otro identificador. No se piden datos personales; al terminar solo aparece el mensaje de agradecimiento.

## Nueva sesión

1. Copiá `config/clase21.json` como `config/clase22.json` y cambiá `id`, bloques e ítems. Podés retirar bloques y reemplazar preguntas. Usá una cantidad par de anclas fijas y definí sus valores y rangos de dibujo.
2. Ejecutá `node scripts/prepare-session.mjs config/clase22.json`. Genera un SQL y una clave privados; no sobrescribe archivos existentes.
3. Ejecutá el SQL generado en el proyecto Supabase `irryksaoygdklwtsjsru`. Publicá el JSON y usá `index.html?s=clase22` y el nuevo enlace docente. La configuración queda copiada en Supabase al activar la sesión.

La pregunta futura con opción por defecto no se implementó. [Manual](MANUAL.md) explica configuración, seguridad, archivos y pruebas.

## Validación

Supabase real: **40 participantes, 880 respuestas y grupos 20/20**, sin duplicados; p95 de envío 272 ms. Datos de prueba borrados y recepción cerrada. Nueve pruebas automáticas y controles de SQL/RLS aprobados. Recorrido completo, recarga, reintento y proyector revisados en navegador.

**Pendientes:** iOS Safari y Android Chrome físicos, 40 teléfonos físicos simultáneos y piloto humano cronometrado de hasta ocho minutos. La carga por HTTP y el viewport móvil no equivalen a esas pruebas. [Detalle de validación](VALIDACION.md).

Pruebas: `node --test --test-isolation=none tests/core.test.js`. Demo local: `node scripts/serve.mjs`. Publicación: push a `main`, Pages desde la raíz, sin build. La instalación inicial usa el SQL privado generado; para actualizar funciones conservando la sesión ejecutá solo `schema.sql`.
