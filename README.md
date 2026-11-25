# 🛒 MylanStore

Tienda en línea de productos tecnológicos (periféricos, audio, monitores, almacenamiento y accesorios) con **panel de administración** y **base de datos SQLite**.

## 🧰 Tecnologías

| Capa | Tecnología |
|---|---|
| Front-end | HTML5, CSS3, JavaScript (sin frameworks) |
| Back-end | Python 3 (`http.server`), API REST |
| Base de datos | SQLite |

## 🚀 Cómo ejecutarlo

Requisito: tener **Python 3** instalado (no necesita librerías externas).

```bash
python server.py
```

Luego abre en el navegador: **http://localhost:8000**

> La primera vez, el servidor crea automáticamente la base de datos `db/mylanstore.db` con 10 productos de ejemplo y el usuario administrador.

**Acceso al panel de administración:** menú **Admin 🛠️** → contraseña `admin123`

## ✨ Funcionalidades

### Tienda (`index.html` + `script.js`)
- Catálogo cargado desde la base de datos SQLite.
- Buscador en tiempo real y filtro por categoría.
- Ventana de detalle de cada producto.
- Carrito de compras que se mantiene al recargar la página (`localStorage`).
- Checkout con datos del cliente y del pago (banco y referencia). El pedido se guarda en la base de datos.
- Formulario de contacto con validación en vivo. Los mensajes se guardan en la base de datos.
- Chatbot asistente que responde sobre garantías, precios, métodos de pago, soporte y reservas.
- Notificaciones flotantes (toasts).

### Panel de administración (`admin.html` + `admin.js`)
- Acceso protegido: la contraseña se valida en el servidor y genera un **token de sesión**.
- **Productos:** CRUD completo (crear, ver, editar y eliminar), con miniatura y vista previa de la imagen.
- **Pedidos:** datos del cliente, pago, productos, total, fecha y estado (**En Progreso / Realizado**). Incluye un resumen de ventas y se actualiza solo cada 10 segundos.
- **Mensajes:** consultas recibidas desde el formulario de contacto.
- Cierre de sesión.

### Seguridad y validaciones (`server.py`)
- La contraseña de administrador se guarda como hash **SHA-256**.
- Los endpoints de administración exigen un token (`Authorization: Bearer ...`).
- **El total del pedido se recalcula en el servidor** con los precios de la base de datos, así que no se puede manipular desde el navegador.
- Validación de campos obligatorios, precios y estados, con respuestas de error claras.
- Servidor multihilo: atiende varias peticiones a la vez.

## 🔌 API REST

| Método | Ruta | Descripción | Requiere admin |
|---|---|---|:---:|
| GET | `/api/productos` | Listar productos | |
| POST | `/api/productos` | Crear producto | ✔ |
| PUT | `/api/productos/{id}` | Editar producto | ✔ |
| DELETE | `/api/productos/{id}` | Eliminar producto | ✔ |
| POST | `/api/pedidos` | Registrar pedido (checkout) | |
| GET | `/api/pedidos` | Listar pedidos | ✔ |
| PUT | `/api/pedidos/{id}` | Cambiar estado del pedido | ✔ |
| POST | `/api/mensajes` | Enviar mensaje de contacto | |
| GET | `/api/mensajes` | Listar mensajes | ✔ |
| DELETE | `/api/mensajes/{id}` | Eliminar mensaje | ✔ |
| POST | `/api/login` | Iniciar sesión de administrador | |
| POST | `/api/logout` | Cerrar sesión | |

## 🗄️ Base de datos

Tablas que usa la aplicación (`server.py`):

- **productos**: id, nombre, categoria, precio, imagen, descripcion
- **pedidos**: id, nombre, apellido, cedula, telefono, banco, referencia, productos (JSON), total, estado, fecha
- **mensajes**: id, nombre, email, mensaje, fecha
- **usuario_admin**: id, username, password (hash SHA-256)

El script `actualizar_db.py` crea un **modelo relacional extendido** para futuras versiones: usuarios, categorias, direcciones, metodos_pago, carrito, reservas e historial_pedidos.

## 📁 Estructura

```
├── index.html        # Tienda
├── admin.html        # Panel de administración
├── script.js         # Lógica de la tienda
├── admin.js          # Lógica del panel admin
├── styles.css        # Estilos
├── server.py         # Servidor + API REST + SQLite
├── actualizar_db.py  # Modelo relacional extendido
└── img/              # Imágenes de los productos
```
