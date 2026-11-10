# Nova Pedidos

App de Impresos Nova para llevar pedidos, precios, cotizaciones y clientes. Funciona en la compu y en el celular, y se puede instalar como app.

## Qué tiene

- **Inicio:** pedidos atrasados, los que se entregan hoy y mañana, los listos para entregar, lo que te deben y lo vendido en el mes.
- **Pedidos:** fecha en que se recibió, fecha de entrega calculada en días hábiles, anticipos y pagos, historial, nota para el cliente en imagen o impresa y aviso por WhatsApp.
  - **Estados:** Recibido → Diseño → Aprobación → Producción (taller) o Enviado a maquila → Listo → Entregado.
  - **Colores por urgencia:** rojo es atrasado, naranja es hoy, amarillo es el siguiente día hábil, verde es a tiempo y azul es listo.
  - **Maquila primero:** en los pedidos de maquila, la urgencia se mide por la **fecha límite para enviarla** (la entrega menos los días de maquila), no por la de entrega, y aparecen primero en la lista.
  - **Botón rápido en cada pedido:** *Ya se envió*, *Ya llegó*, *Ya está listo* o *Entregado*. Al marcarlo listo ofrece avisarle al cliente por WhatsApp, y al entregarlo con saldo pregunta si ya pagó.
- **Cotizaciones:** mezclan productos de imprenta, playeras, diseño y conceptos libres. Se pueden imprimir o guardar en PDF, mandar por WhatsApp y pasar a pedido con un clic.
- **Precios:** buscador del catálogo de imprenta y de playeras. Los precios se pueden editar.
- **Calculadora:** una calculadora rápida y cálculos de playeras, lona y vinil por medida, IVA, anticipo y margen.
- **Contactos:** clientes (con su historial, lo que deben, cómo nos conocieron y su última compra) y proveedores o maquiladores.
- **Desempeño:** indicadores por semana o mes y comparación con el periodo anterior: ventas, cobrado, ganancia, margen, gastos, utilidad, pedidos, ticket promedio, clientes nuevos, cotizaciones que se vendieron y entregas a tiempo. Incluye gráficas de las últimas 12 semanas o 12 meses y un historial que se descarga para Excel. Tiene cuatro pestañas:
  - **Clientes:** de dónde llegan, los mejores clientes, las cotizaciones a las que hay que dar seguimiento y los clientes por reactivar, con botón de WhatsApp.
  - **Bitácora:** cada estrategia nueva que pruebes, con la comparación de ventas antes y después. También aparece numerada en la gráfica.
  - **Gastos:** renta, luz, sueldos, publicidad y lo demás que no es de un pedido.
  - **Venta rápida:** registra ventas de mostrador que se cobran y entregan al momento.
- **Ajustes:** datos del negocio, reglas de playeras, días hábiles, costos, equipo, cuenta y respaldo.
- **Equipo:** el dueño ve todo; los colaboradores manejan pedidos, cotizaciones y clientes (ver abajo).

### Ganancias

Cada pedido calcula su costo con los costos del catálogo. Si el costo no está completo, puedes escribir el costo real en el pedido. Para que las ganancias salgan solas, pon:

- **El costo de cada producto**, en Precios (toca el producto y llena "Te cuesta").
- **El costo de cada estampado de playera**, por lado, en Ajustes → Costos.

Los pedidos que no tienen costo no cuentan en la ganancia, y la app avisa cuáles son.

Los precios iniciales vienen del archivo `Impresos INOVA.xlsm`: la hoja *Precios Imprenta* y la hoja *Catálogo Playeras Blancas*.

### Diseño

El botón **＋ Diseño** abre los niveles de diseño con un precio de referencia, y el diseñador ajusta el precio en cada caso. También se puede marcar como "incluido sin costo". Los niveles se cambian en Precios → Diseño:

- Ajuste rápido: $30
- Diseño sencillo: $50
- Diseño medio: $100
- Diseño complejo: $200

### Nota para el cliente

En cada pedido, el botón **Nota para el cliente** genera una imagen con el logo, los conceptos y el desglose del IVA (subtotal, IVA y total). También trae el anticipo con su fecha y forma de pago (o "Sin anticipo"), los abonos y lo que **resta por pagar**. Se descarga o, en el celular, se comparte directo a WhatsApp. Las cotizaciones tienen la misma opción con el botón **Imagen**.

### Playeras

En el cotizador, **＋ Playeras** abre un selector. También está en **Calculadora → Playeras**. Así se usa:

1. **Filtra los modelos** por para quién es, tipo (casual, deportiva o para sublimar), cuello, manga, color y talla.
2. **Elige un modelo** y luego el color, la técnica (DTF, Vinil o Sublimación), dónde va estampada (cada lugar es un planchado) y las piezas de cada talla.
3. **Junta varios modelos** con *Apartar y elegir otro modelo*. El apartado lleva la cuenta de las piezas y avisa cuántas faltan para mayoreo.

El precio por pieza es: playera + cargo de técnica + planchados. El nivel lo decide el total de playeras de la cotización. Valores iniciales, tomados de la hoja *Cotizador* del Excel:

- **DTF:** $110 de técnica en menudeo y $100 en mayoreo.
- **Vinil:** $70 en menudeo y $60 en mayoreo.
- **Sublimación:** $40 en menudeo y $30 en mayoreo, tamaño carta por lado. Se usa la playera *SUBLI*, que no es de Yazbek y cuesta $80. Así queda en $140 a un lado y $160 a dos en menudeo, y $125 y $140 en mayoreo.
- **Cada planchado:** $20 en menudeo y $15 en mayoreo.
- **Mayoreo:** desde 12 playeras. En mayoreo, la playera se cobra a su precio de mayoreo del catálogo; esto se puede apagar.

Todo esto se cambia en **Ajustes → Playeras personalizadas**.

## Trabajar en equipo (Supabase, gratis)

Mientras nadie entre con una cuenta, los datos viven solo en el navegador donde se capturan. Para que tú y tus colaboradores vean lo mismo en todos los dispositivos:

### Una sola vez (el dueño)

1. **Crear el proyecto.** Entra a https://supabase.com, crea una cuenta y un proyecto nuevo. Elige la región más cercana, por ejemplo *East US*.
2. **Crear la base.** En el proyecto, ve a **SQL Editor → New query**, pega todo el contenido de `supabase.sql` y presiona **Run**. Si después sale una versión nueva de la app con otro `supabase.sql`, se vuelve a correr igual y no se pierde nada.
3. **Crear tu usuario primero.** Ve a **Authentication → Users → Add user → Create new user**, escribe tu correo y una contraseña larga (12 caracteres o más) y marca *Auto Confirm User*. **El primer usuario que se crea queda como dueño.**
4. **Cerrar el registro público.** Ve a **Authentication → Sign In / Providers** y desactiva **Allow new users to sign up**. Así solo entra quien tú des de alta.
5. **Copiar los datos de conexión.** En **Project Settings → API** (o *Data API*), copia la **Project URL** y la clave pública (*anon* o *publishable*). **Nunca** uses la clave *service_role* ni la *secret*.
6. **Entrar.** Abre la app publicada; te pedirá entrar. Pega la URL, la clave, tu correo y tu contraseña.
7. **Subir el catálogo.** El catálogo de precios no va en el código publicado. La primera vez, en **Ajustes → Respaldo → Cargar respaldo**, elige el archivo `catalogo-inicial-nova-pedidos.json` (está en la carpeta del proyecto, fuera de `app-pedidos`). Se sube a la base y desde ahí lo reciben todos.

Opcional: si pones la URL y la clave en `js/config.js` y vuelves a publicar, nadie tiene que capturarlas; solo su correo y contraseña.

### Por cada colaborador

1. En Supabase, **Authentication → Users → Add user → Create new user** con su correo y una contraseña (marca *Auto Confirm User*).
2. En la app, **Ajustes → Equipo → Copiar enlace** (o *Enviar por WhatsApp*) y mándaselo junto con su contraseña. El enlace deja la app conectada; solo tiene que entrar.
3. Cuando entre por primera vez aparece en **Ajustes → Equipo** como *Sin acceso* y no ve nada. Ponle el rol **Colaborador** y su nombre (el nombre sale en el historial de cada pago y cambio).
4. Para quitarle el acceso, ponle *Sin acceso* o bórralo en Supabase → Authentication → Users. Si deja de trabajar contigo, que cierre sesión eligiendo **"borrar datos de este dispositivo"**.

### Qué puede hacer cada quien

- **Dueño:** todo.
- **Colaborador:** ve y maneja pedidos, cotizaciones, clientes, precios (solo consulta) y la calculadora. No ve costos, ganancias, Desempeño, gastos ni Ajustes; no puede borrar, quitar pagos ni cambiar precios. Gastos y bitácora además están protegidos en la base: aunque alguien lo intente, el servidor no se los entrega.

### Seguridad

- **Sin sesión no se ve nada.** La app publicada solo muestra la pantalla de entrada. El código es público (así funciona GitHub Pages gratis), pero no trae precios, costos, clientes, contraseñas ni claves secretas: todo eso vive en tu base de Supabase.
- **La base solo responde a usuarios aprobados.** Las reglas de `supabase.sql` niegan todo a quien no tiene sesión, y a una cuenta nueva hasta que el dueño la aprueba. Gastos y bitácora solo los ve el dueño, y un colaborador no puede borrar registros.
- **Código protegido contra inyecciones.** Todo lo que se captura se muestra como texto. Una política de seguridad (CSP) impide ejecutar código que no sea de la app y solo permite hablar con Supabase. Lo que llega de otros dispositivos se limpia antes de usarse.
- **Enlaces de invitación seguros.** Solo aceptan direcciones `https://….supabase.co`. Si llenas `js/config.js`, los enlaces ya no cambian nada y la app solo habla con tu base.
- **Lo que te toca cuidar:** desactivar *Allow new users to sign up*, usar contraseñas largas, no compartir la clave *service_role* y quitar el acceso a quien se vaya. En Supabase, **Authentication → Policies / Rate limits** ya limita los intentos de contraseña.

### Cómo se sincroniza

La app sube y baja cambios sola: al guardar algo, cada minuto y al volver a la app. Si no hay internet, guarda los cambios y los sube cuando regresa la conexión. Si dos personas cambian el mismo registro, se queda el cambio más reciente; en los pedidos, además, **se juntan los pagos y el historial de ambas** para que no se pierda ningún cobro.

## Dónde está publicada

La app está en GitHub Pages (ver la dirección en el repositorio). Ábrela en el celular y elige **Agregar a pantalla de inicio** para instalarla.

- **Para publicar cambios:** sube el número `VERSION` en `sw.js` (para que los dispositivos tomen la versión nueva), haz commit y push a la rama `main`. GitHub Pages se actualiza solo en uno o dos minutos.
- **Para probar en la compu sin publicar:** abre `index.html` con doble clic. Funciona todo menos instalarla y usarla sin internet.

## Respaldo

En **Ajustes → Respaldo → Descargar respaldo** se baja un archivo `.json` con todo. Conviene guardarlo en Drive de vez en cuando, sobre todo si todavía no conectas Supabase.
