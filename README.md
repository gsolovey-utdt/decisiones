# Decisiones · NyPE, UTDT

App anónima en HTML/CSS/JavaScript, GitHub Pages y el Supabase compartido de la materia. Versión 2: **19 pantallas**, sin decil ni intervalos, con fotos y efecto de dotación.

## Enlaces

- [Estudiantes](https://gsolovey-utdt.github.io/decisiones/index.html?s=clase21) · [QR PNG](entregables/clase21-qr.png).
- [Docente](https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&v=panel). La clave y el enlace completo están en el archivo local privado `entregables/ACCESO-DOCENTE-clase21.txt`.
- [Demo de anclaje](https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&v=anclaje&demo=1) · [Demo de dotación](https://gsolovey-utdt.github.io/decisiones/admin.html?s=clase21&v=dotacion&demo=1). Generan 40 casos simulados sin escribir en Supabase.

## Manejo en clase

1. En el panel, **Administrar la sesión → Abrir recepción** o **Cerrar recepción**. El cierre bloquea ingresos y envíos; reabrir permite continuar.
2. Proyectá el QR. Cada celular conserva identificador, grupo, orden y avance. Si falla la red, conserva el envío y permite reintentarlo.
3. **Anclaje** reúne las cuatro preguntas, el resumen entre grupos y la ruleta. **Dotación** reúne los tres objetos, medianas, puntos individuales y cociente venta/compra. **Mostrar respuesta** revela los valores reales; el bloque de dotación no tiene una respuesta correcta.
   En Dotación, **Ampliar** abre cada objeto con las dos medianas grandes, una comparación en palabras y un gráfico rotulado «Cada punto es una persona». Los enlaces por objeto se pueden guardar como favoritos y conservan el modo proyección. La frase se calcula con las medianas observadas y contempla ceros, grupos vacíos o diferencias en ambas direcciones.
4. **Proyectar** usa 16:9; **Esc** sale. Los datos se actualizan cada cuatro segundos. Cada vista tiene su URL, que podés guardar como favorito.
5. **Exportar CSV** descarga respuestas originales e interpretadas, versión del diseño, grupos, condición/ancla, orden y tiempos. No incluye claves ni tokens.
6. **Borrar respuestas de esta sesión** pide escribir el código de sesión, borra solo esa sesión y cierra la recepción. El borrado es permanente. El archivo histórico es una sesión distinta y se conserva.

## Diseño entre participantes

Se sortean bloques de cuatro: baja/compra, baja/venta, alta/compra y alta/venta. Cada persona recibe las cuatro anclas fijas del mismo tipo y conserva su rol para los tres objetos. Los órdenes de preguntas y objetos se sortean. La versión de enfermedad usa un sorteo independiente y balanceado. CRT fijo: **máquinas → lago → pelota**, rotulada al docente «(ya vista en la clase 1)».

Compra: máximo que pagaría por un objeto ajeno. Venta: mínimo que aceptaría por un objeto propio. Es una situación hipotética en pesos argentinos, con la misma foto y descripción para ambos grupos. Las fotos no incluyen marcas ni precios. [Fotos y prompts](assets/PROCEDENCIA.md).

El resumen de anclaje compara grupos distintos mediante el promedio por persona de ln(estimación / real). Solo incluye los cuatro ítems completos y positivos. Los valores fuera de escala se excluyen del dibujo, pero se cuentan y se incluyen en medianas y análisis.

## Actualizar o agregar una sesión

Para pasar la instalación anterior a esta versión, ejecutá **una vez el archivo completo** [migrations/20261106_entre_grupos.sql](migrations/20261106_entre_grupos.sql). Incluye las funciones nuevas, conserva la URL, la clave y la recepción, y archiva el diseño y los datos anteriores como `clase21-v1`. Esa sesión se consulta con la misma clave usando `?s=clase21-v1`. Repetir la migración no duplica ni borra datos.

Para una sesión nueva, copiá `config/clase21.json`, cambiá `id` e ítems y ejecutá `node scripts/prepare-session.mjs config/clase22.json`. Ejecutá el SQL privado generado, publicá el JSON y usá el enlace con el nuevo código. La configuración se copia a Supabase al activar; editar solo el archivo no cambia una sesión activada. La futura opción por defecto sigue sin implementarse.

## Verificación

`node --test --test-isolation=none tests/core.test.js` ejecuta las pruebas del motor. `node tests/postgres.mjs` prueba las funciones SQL, la conservación del archivo histórico y 40 participantes (requiere PGlite de desarrollo). El generador HTTP admite una sesión de QA vacía y cerrada mediante `--session=CODIGO`, limpia únicamente sus propios registros y conserva cualquier participante ajeno.

[Detalle de validación](VALIDACION.md). Las pruebas en iOS Safari y Android Chrome físicos y el piloto humano de ocho minutos siguen pendientes. Local: `node scripts/serve.mjs`. Deploy: push a `main`, Pages desde la raíz, sin build.
