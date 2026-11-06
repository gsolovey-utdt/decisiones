# Validación · versión 2 · 06/11/2026

- Nueve pruebas de motor, interpretación, estadísticas, configuración y CSV: aprobadas.
- PostgreSQL local (PGlite): migración repetible, archivo anterior conservado íntegro, claves y RLS, orden, reintento, cierre y reinicio: aprobados.
- Carga SQL local: 40 participantes, 760 respuestas, cuatro celdas de 10, enfermedad 20/20, condiciones estables por persona.
- Recorrido en navegador a 390 px: 19 pantallas, fotos, reanudación en el mismo objeto, precios con puntos de miles y cero, CRT en orden y cierre sin resultados: verificado.
- Proyector 1280×720: cuatro anclas juntas, resumen entre grupos y tres objetos juntos; valores reales ocultos al inicio: verificado.
- Carga HTTP en Supabase de esta versión: pendiente de activar la migración.
- Pendientes: iOS Safari y Android Chrome físicos, cuarenta teléfonos físicos y piloto humano de hasta ocho minutos.

El demo se etiqueta permanentemente como simulado y no escribe en Supabase. Las pruebas por HTTP no equivalen a una prueba en teléfonos físicos. La prueba automatizada no mide el tiempo de lectura ni razonamiento.

Antecedente de versión 1 (05/11): carga real de 40 participantes y 880 respuestas, enfermedad 20/20, p50 de envío 171 ms y p95 272 ms. Sus registros de carga se borraron. Los datos de clase posteriores se conservan al migrar, dentro de clase21-v1.
