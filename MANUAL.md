# Decisiones · NyPE, UTDT

Actividades anónimas de juicio y decisión para la clase 21. Sigue la arquitectura y el estilo de [two-armed-bandit](https://github.com/gsolovey-utdt/two-armed-bandit) y [pilas-emociones](https://github.com/gsolovey-utdt/pilas-emociones): HTML/CSS/JS sin compilación, GitHub Pages desde `main` y el mismo Supabase (`irryksaoygdklwtsjsru`). No modifica datos de otras apps. Los gráficos son SVG propios, sin dependencias de ejecución.

## Enlaces

- Estudiantes: https://gsolovey-utdt.github.io/decisiones/index.html?s=clase21
- QR PNG: [entregables/clase21-qr.png](entregables/clase21-qr.png).
- Docente: https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&v=panel — ingresá la clave privada. El enlace completo con clave está en `entregables/ACCESO-DOCENTE-clase21.txt`, **solo en la copia local**.
- Demo docente: https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&demo=1. Genera 40 casos en el navegador, señalados como **DATOS SIMULADOS**, sin escribir en Supabase. Podés recorrer las 22 pantallas agregando `&demo=1` al enlace del estudiante.

## Manejo en clase

1. Abrí el panel privado y desplegá **Administrar la sesión → Abrir recepción**. Empieza cerrada.
2. Proyectá el QR del panel. Cada celular conserva su identificador aleatorio, asignación y avance; recargar continúa en la pantalla pendiente. Cada respuesta se confirma en el servidor antes de avanzar. Si falla la conexión, queda pendiente en ese celular y aparece **Reintentar envío**.
3. Cada enlace de la barra docente es una URL propia. Podés guardarlos como favoritos o abrirlos en pestañas. **Proyectar** adapta la vista a 16:9; **Esc** sale. Los datos se consultan cada cuatro segundos, sin superponer consultas. Una consulta lenta suma su demora al intervalo. **Mostrar respuesta** revela soluciones o valores reales solo en la vista actual; al recargar vuelven a estar ocultos.
4. **Cerrar recepción** bloquea tanto el ingreso como los nuevos envíos. El celular muestra «La actividad ya cerró». Podés reabrir para continuar.
5. **Exportar CSV** descarga las respuestas de la sesión en UTF-8 con BOM: identificador anónimo, bloque/ítem, condición/ancla, orden de pantalla/opciones, texto original y valor interpretado, clasificación y tiempos del dispositivo y del servidor. Se protegen textos que podrían ejecutarse como fórmulas en una planilla. No se exportan claves ni tokens.
6. Para limpiar pruebas: **Borrar respuestas de esta sesión**, escribí `clase21` para confirmar. Borra solo esta app y sesión, cierra la recepción y reinicia el avance de los celulares al volver a abrir. Los envíos pendientes de la versión anterior se rechazan. No hay recuperación de ese borrado.

El demo guarda todo en `localStorage`; borrarlo o usar otro navegador no afecta la clase. La recepción del demo es independiente. Para volver a los 40 ejemplos después de borrarlos, eliminá únicamente la entrada `nype_decisiones_demo_v1` del almacenamiento del sitio.

## Supabase y clave

La instalación inicial usa el SQL privado `entregables/activar-clase21.sql`, que incluye [schema.sql](schema.sql) y la configuración de la sesión. Ya fue ejecutada en el proyecto compartido. Para actualizar funciones, ejecutá **solo `schema.sql`**, que conserva las sesiones y las claves existentes. No vuelvas a insertar una sesión que ya existe.

Las tablas `nype_dec_sessions`, `nype_dec_participants` y `nype_dec_answers` tienen RLS y ningún acceso directo para `anon`/`authenticated`. Las funciones RPC verifican la clave docente o el token de cada dispositivo, el orden, los duplicados y la recepción. La condición y la ruleta se asignan en el servidor. La versión de enfermedad usa bloques aleatorios de dos, independientes del sorteo de dos anclas altas y dos bajas. El cierre y el reinicio se sincronizan con las escrituras mediante bloqueos de base de datos.

La clave docente se guarda en Supabase como SHA-256. El enlace privado la lleva después de `#`, fuera del pedido HTTP de la página, y usa `no-referrer`. No compartas ese enlace con estudiantes. La clave y el SQL de activación están excluidos de Git. La clave pública de Supabase en `config/backend.js` es publicable, no es una clave de administración.

Un dispositivo significa un perfil de navegador con su almacenamiento: borrar ese almacenamiento o usar otro navegador permite un nuevo identificador. No se usan nombres, correos, legajos, huellas digitales ni direcciones IP en las tablas de la app. Supabase y GitHub pueden mantener sus registros técnicos habituales de infraestructura.

## Agregar una sesión sin cambiar código

1. Copiá `config/clase21.json` como `config/clase22.json`, cambiá `id` a `clase22` y editá bloques/ítems. Se pueden retirar bloques. Para anclas fijas usá una cantidad par de ítems, cada uno con `low`, `high`, `real`, `domain`, `prompt`, `compare` y `unit`. `domain` solo limita el dibujo: los análisis incluyen todos los valores.
2. Desde esta carpeta ejecutá `node scripts/prepare-session.mjs config/clase22.json`. Genera un SQL y un acceso docente **privados**, con una clave nueva; no sobrescribe archivos existentes.
3. Ejecutá `entregables/activar-clase22.sql` en Supabase. La sesión empieza cerrada. Publicá la configuración junto con los archivos estáticos y generá el nuevo QR con la URL `index.html?s=clase22`.
4. Usá el enlace docente generado para esa sesión. La configuración se copia a Supabase en la activación: editar solo el JSON después no cambia una sesión ya activada. Para revisar ítems antes de activar, usá el demo. Conservá las configuraciones usadas para interpretar los datos.

Tipos actuales: `anchors` (ruleta opcional), `choice`, `framing`, `intervals`, `decile`, `problems`. Las etiquetas de bloque solo se muestran al docente. La futura opción por defecto no está implementada: requerirá un tipo nuevo, sin alterar el modelo de sesiones/respuestas.

## Pruebas y alcance

Al 05/11/2026: nueve pruebas automáticas de diseño, números, estadísticas, CSV y configuración; migración y RPC probadas en PostgreSQL local (PGlite), incluyendo RLS y permisos. Se verificó en **Supabase real** una ola de 40 participantes: **880 respuestas**, 40 recorridos completos, enfermedad **20/20**, sin duplicados. Mediana de envío 171 ms; percentil 95: 272 ms. Los registros de esa prueba se borraron y la recepción quedó cerrada.

Se recorrieron las 22 pantallas en el navegador, con recarga, coma decimal, puntos de miles, corte de red, reintento, ruleta, validación de intervalos y cierre sin resultados. Se inspeccionaron las vistas docentes con datos simulados en 1280×720 y el recorrido a 390 px de ancho.

**Pendiente:** prueba en dispositivos físicos con iOS Safari y Android Chrome, y un piloto humano cronometrado para confirmar el máximo de ocho minutos. La prueba de carga no mide lectura ni razonamiento humano y no equivale a 40 teléfonos físicos. No hay temporizador que fuerce respuestas.

Pruebas sin instalar dependencias: `node --test --test-isolation=none tests/core.test.js`. Prueba de PostgreSQL: instalar `@electric-sql/pglite` en herramientas de desarrollo, indicar su `dist/index.js` en `PGLITE_MODULE` y ejecutar `node tests/postgres.mjs`. Usa una base temporal, sin conexión a Supabase.

Prueba real opcional: `node scripts/load.mjs entregables/ACCESO-DOCENTE-clase21.txt`. **Solo acepta una sesión vacía y cerrada**, crea 40 participantes, verifica conteos y borra sus propios registros. Si aparece cualquier participante ajeno, no borra nada. No usar durante la clase. El generador local de datos es `simulate()` en `demo.js`.

Vista local: `node scripts/serve.mjs`, luego `http://127.0.0.1:4175/admin.html?s=clase21&demo=1`. Publicación: push de los archivos a `main`; Pages sirve la raíz. No se necesita build.
