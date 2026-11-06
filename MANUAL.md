# Manual técnico · Decisiones

La guía de uso y configuración está en [README](README.md).

## Backend

Supabase `irryksaoygdklwtsjsru`, tablas `nype_dec_sessions`, `nype_dec_participants` y `nype_dec_answers`. RLS sin permisos directos para anon/authenticated. Solo las RPC públicas conceden acceso, validando clave docente o token del dispositivo, recepción, época de la sesión, secuencia e idempotencia. Las claves se guardan como SHA-256; los tokens se generan al azar y no se exportan.

Los sorteos se hacen al unirse, bajo bloqueo de la sesión. El mazo factorial aleatorio de cuatro celdas es independiente del mazo de enfermedad de dos. El plan y la asignación se guardan en el servidor; recargar o abrir otra pestaña no cambia la condición. Cada respuesta conserva la asignación y design_version. El alumno recibe solo la pantalla actual, sin soluciones ni etiquetas de grupos.

Las migraciones de versión archivan las respuestas anteriores antes de reiniciar el plan. El cambio es transaccional: se conserva todo o no se aplica. Incrementar epoch invalida envíos pendientes del diseño anterior. El archivo clase21-v1 conserva incluso los planes incompletos, los tiempos y el texto original.

Las consultas docentes devuelven un agregado JSON completo; no dependen del límite de 1000 filas de la API de tablas. Se inicia una consulta cada cuatro segundos después de terminar la anterior. Las vistas se dibujan con SVG propios; el código cliente no necesita compilación ni bibliotecas externas.

## Datos y análisis

Un dispositivo significa un perfil de navegador con almacenamiento local; otro perfil o borrar el almacenamiento genera otro identificador. No se piden nombres, correos o legajos. La app no guarda IP, user-agent ni huellas digitales. La infraestructura puede conservar sus registros técnicos habituales.

El CSV lleva BOM UTF-8 y protege textos que una planilla podría ejecutar como fórmulas. Incluye design_version, anchor_group y ownership_group además de la condición de cada respuesta. En dotación se permiten precios cero; si la mediana de compra es cero, el cociente venta/compra se muestra como no definido.

En anclaje, cada panel tiene su escala y unidad. El resumen calcula por persona el promedio de logaritmos de estimación/real y compara los promedios de los dos grupos; no calcula diferencias alta-baja dentro de una persona. Los ceros se conservan en las medianas por pregunta y se excluyen del resumen logarítmico. En dotación se comparan medianas por objeto; no se mezclan pesos de objetos distintos en una media global.

## Configuración

Tipos: anchors, endowment, choice, framing, problems; intervals y decile se conservan solo para leer la versión histórica. Las condiciones between usan anchorGroup y ownershipGroup. Cada objeto define foto, descripción idéntica, consignas por rol, rango visual y un valor demoBase exclusivo del simulador; ese valor no se muestra ni se usa como respuesta correcta.

No modifiques configuración de una sesión con respuestas sin una migración que separe versiones. prepare-session.mjs genera SQL y clave privados para sesiones nuevas y no sobrescribe archivos existentes. Nunca publiques las claves, los archivos ACCESO-DOCENTE ni los SQL privados de activación.

## Referencia del bloque de dotación

El contraste entre disposición máxima a pagar y mínima a aceptar sigue el paradigma de [Kahneman, Knetsch y Thaler (1990)](https://web.mit.edu/curhan/www/docs/Articles/15341_Readings/Behavioral_Decision_Theory/Kahneman_et_al_1990_Experimental_tests.pdf). La app usa posesión imaginada y respuestas hipotéticas: sirve como demostración de clase y no reproduce la asignación efectiva de objetos y las transacciones incentivadas del artículo. No se presume que el efecto tenga que aparecer.

Las preguntas de intervalos de la versión anterior venían del módulo [Judgment and Decision Making de Noba](https://nobaproject.com/modules/judgment-and-decision-making); contrastaban la cobertura empírica con el 98 % declarado. Fueron retiradas de la sesión actual a pedido del docente.
