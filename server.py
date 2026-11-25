import http.server
import socketserver
import json
import sqlite3
import os
import secrets
import hashlib
import urllib.parse
from datetime import datetime

PORT = int(os.environ.get('PORT', 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, 'db')
DB_PATH = os.path.join(DB_DIR, 'mylanstore.db')

# Sesiones de administrador activas (token -> usuario). Se pierden al reiniciar el servidor.
SESIONES_ADMIN = {}


def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# --- 1. INICIALIZACIÓN Y CONFIGURACIÓN DE BASE DE DATOS (SQLITE) ---
def init_db():
    os.makedirs(DB_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Tabla de Productos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            categoria TEXT NOT NULL,
            precio REAL NOT NULL,
            imagen TEXT NOT NULL,
            descripcion TEXT NOT NULL
        )
    ''')

    # Tabla de Pedidos (Checkout)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            cedula TEXT NOT NULL,
            telefono TEXT NOT NULL,
            banco TEXT NOT NULL,
            referencia TEXT NOT NULL,
            productos TEXT NOT NULL,
            total REAL NOT NULL,
            estado TEXT DEFAULT 'En Progreso'
        )
    ''')
    # Migración: agrega la fecha del pedido si la tabla es de una versión anterior
    columnas = [fila[1] for fila in cursor.execute('PRAGMA table_info(pedidos)')]
    if 'fecha' not in columnas:
        cursor.execute('ALTER TABLE pedidos ADD COLUMN fecha TEXT')

    # Tabla de Mensajes del formulario "Contáctanos"
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            email TEXT NOT NULL,
            mensaje TEXT NOT NULL,
            fecha TEXT NOT NULL
        )
    ''')

    # Tabla de Administradores (contraseña guardada como hash SHA-256)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuario_admin (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    cursor.execute('SELECT id, password FROM usuario_admin')
    admins = cursor.fetchall()
    if not admins:
        cursor.execute('INSERT INTO usuario_admin (username, password) VALUES (?, ?)',
                       ('admin', hash_password('admin123')))
    else:
        # Convierte contraseñas guardadas en texto plano a hash
        for admin_id, pwd in admins:
            if len(pwd) != 64:
                cursor.execute('UPDATE usuario_admin SET password=? WHERE id=?',
                               (hash_password(pwd), admin_id))

    # Población automática de 10 productos iniciales si la tabla está vacía
    cursor.execute('SELECT COUNT(*) FROM productos')
    if cursor.fetchone()[0] == 0:
        productos_iniciales = [
            ("1", "Teclado Mecánico RGB", "perifericos", 45.00, "img/teclado.jpg", "Teclado mecánico para gaming con retroiluminación personalizable y switches azules."),
            ("2", "Mouse Inalámbrico Ergonómico", "perifericos", 25.50, "img/mouse.jpg", "Diseño vertical para evitar fatiga en la muñeca, alta precisión y batería recargable."),
            ("3", "Audífonos de Diadema", "audio", 60.00, "img/audifonos.jpg", "Sonido envolvente 7.1, cancelación de ruido pasiva y micrófono incorporado."),
            ("4", "Monitor Gaming 144Hz", "monitores", 180.00, "img/monitor.jpg", "Pantalla de 24 pulgadas Full HD, tiempo de respuesta de 1ms y tecnología FreeSync."),
            ("5", "SSD NVMe M.2 1TB", "almacenamiento", 85.00, "img/ssd.jpg", "Unidad de estado sólido ultra rápida con velocidades de lectura de hasta 3500 MB/s."),
            ("6", "Cámara Web Full HD 1080p", "accesorios", 35.00, "img/camara.jpg", "Ideal para streaming y videoconferencias, con micrófono estereo integrado y autofocus."),
            ("7", "Cornetas Bluetooth Portátiles", "audio", 40.00, "img/corneta.jpg", "Resistentes al agua (IPX7), graves potentes y hasta 12 horas de reproducción continua."),
            ("8", "Micrófono Condensador USB", "accesorios", 50.00, "img/microfono.jpg", "Calidad de estudio con patrón polar cardioide, trípode y filtro anti-pop incluido."),
            ("9", "Mousepad Gamer XL", "accesorios", 15.00, "img/mousepad.jpg", "Superficie de tela de alta densidad con bordes cosidos y base de goma antideslizante."),
            ("10", "Hub USB-C 7 en 1", "accesorios", 30.00, "img/hub.jpg", "Amplía tu conectividad con puertos HDMI 4K, USB 3.0, lector de tarjetas SD y carga PD.")
        ]
        cursor.executemany('''
            INSERT OR IGNORE INTO productos (id, nombre, categoria, precio, imagen, descripcion)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', productos_iniciales)

    conn.commit()
    conn.close()


class ErrorValidacion(Exception):
    pass


def texto_requerido(data, campo, max_len=500):
    valor = data.get(campo)
    if valor is None or str(valor).strip() == '':
        raise ErrorValidacion(f'El campo "{campo}" es obligatorio')
    valor = str(valor).strip()
    if len(valor) > max_len:
        raise ErrorValidacion(f'El campo "{campo}" es demasiado largo')
    return valor


def precio_valido(data):
    try:
        precio = float(data.get('precio'))
    except (TypeError, ValueError):
        raise ErrorValidacion('El precio debe ser un número')
    if precio < 0:
        raise ErrorValidacion('El precio no puede ser negativo')
    return round(precio, 2)


# --- 2. MANEJADOR DE PETICIONES HTTP (SERVIDOR BACKEND) ---
class CustomHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        # Sirve siempre los archivos desde la carpeta del proyecto
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def send_json_response(self, data, status=200):
        cuerpo = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(cuerpo)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(cuerpo)

    def end_headers(self):
        # Evita que el navegador use versiones viejas de admin.js / script.js / css
        if not self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    # --- Utilidades ---
    def leer_json(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            return {}
        datos = json.loads(self.rfile.read(content_length).decode('utf-8'))
        if not isinstance(datos, dict):
            raise ErrorValidacion('Formato de datos inválido')
        return datos

    def es_admin(self):
        auth = self.headers.get('Authorization', '')
        token = auth[7:] if auth.startswith('Bearer ') else ''
        return token in SESIONES_ADMIN

    def ruta(self):
        return urllib.parse.urlparse(self.path).path.rstrip('/')

    def ejecutar(self, funcion):
        """Ejecuta un manejador y responde con un error JSON si algo falla."""
        try:
            return funcion()
        except ErrorValidacion as e:
            return self.send_json_response({'error': str(e)}, status=400)
        except json.JSONDecodeError:
            return self.send_json_response({'error': 'JSON inválido'}, status=400)
        except Exception as e:
            print('Error interno:', repr(e))
            return self.send_json_response({'error': 'Error interno del servidor'}, status=500)

    def no_autorizado(self):
        return self.send_json_response({'error': 'No autorizado. Inicia sesión como administrador.'}, status=401)

    def no_encontrado(self):
        return self.send_json_response({'error': 'Ruta no encontrada'}, status=404)

    # MANEJO DE PETICIONES GET
    def do_GET(self):
        ruta = self.ruta()
        if ruta.startswith('/api/'):
            return self.ejecutar(lambda: self.get_api(ruta))
        return super().do_GET()

    def get_api(self, ruta):
        if ruta == '/api/productos':
            conn = get_conn()
            productos = [dict(r) for r in conn.execute('SELECT * FROM productos ORDER BY CAST(id AS INTEGER)')]
            conn.close()
            return self.send_json_response(productos)

        if ruta == '/api/pedidos':
            if not self.es_admin():
                return self.no_autorizado()
            conn = get_conn()
            pedidos = [dict(r) for r in conn.execute('SELECT * FROM pedidos ORDER BY id DESC')]
            conn.close()
            return self.send_json_response(pedidos)

        if ruta == '/api/mensajes':
            if not self.es_admin():
                return self.no_autorizado()
            conn = get_conn()
            mensajes = [dict(r) for r in conn.execute('SELECT * FROM mensajes ORDER BY id DESC')]
            conn.close()
            return self.send_json_response(mensajes)

        if ruta == '/api/sesion':
            return self.send_json_response({'valida': self.es_admin()})

        return self.no_encontrado()

    # MANEJO DE PETICIONES POST
    def do_POST(self):
        return self.ejecutar(self.post_api)

    def post_api(self):
        ruta = self.ruta()
        data = self.leer_json()

        if ruta == '/api/login':
            usuario = str(data.get('usuario') or 'admin').strip()
            password = str(data.get('password') or '')
            conn = get_conn()
            fila = conn.execute('SELECT password FROM usuario_admin WHERE username=?', (usuario,)).fetchone()
            conn.close()
            if fila and secrets.compare_digest(fila['password'], hash_password(password)):
                token = secrets.token_hex(24)
                SESIONES_ADMIN[token] = usuario
                return self.send_json_response({'token': token, 'usuario': usuario})
            return self.send_json_response({'error': 'Contraseña incorrecta'}, status=401)

        if ruta == '/api/logout':
            auth = self.headers.get('Authorization', '')
            SESIONES_ADMIN.pop(auth[7:], None)
            return self.send_json_response({'message': 'Sesión cerrada'})

        if ruta == '/api/productos':
            if not self.es_admin():
                return self.no_autorizado()
            valores = (
                texto_requerido(data, 'nombre', 120),
                texto_requerido(data, 'categoria', 60).lower(),
                precio_valido(data),
                texto_requerido(data, 'imagen', 300),
                texto_requerido(data, 'descripcion', 1000),
            )
            conn = get_conn()
            fila = conn.execute('SELECT MAX(CAST(id AS INTEGER)) FROM productos').fetchone()
            new_id = str((fila[0] or 0) + 1)
            conn.execute('''
                INSERT INTO productos (id, nombre, categoria, precio, imagen, descripcion)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (new_id, *valores))
            conn.commit()
            conn.close()
            return self.send_json_response({'message': 'Producto creado con éxito', 'id': new_id}, status=201)

        if ruta == '/api/pedidos':
            cliente = {campo: texto_requerido(data, campo, 100)
                       for campo in ('nombre', 'apellido', 'cedula', 'telefono', 'banco', 'referencia')}
            items = data.get('productos')
            if not isinstance(items, list) or not items:
                raise ErrorValidacion('El pedido no tiene productos')

            # El total se recalcula con los precios reales de la base de datos
            conn = get_conn()
            detalle, total = [], 0.0
            for item in items:
                fila = conn.execute('SELECT * FROM productos WHERE id=?', (str(item.get('id')),)).fetchone()
                if not fila:
                    conn.close()
                    raise ErrorValidacion(f'El producto "{item.get("nombre", "")}" ya no está disponible')
                try:
                    cantidad = max(1, int(item.get('cantidad', 1)))
                except (TypeError, ValueError):
                    cantidad = 1
                total += fila['precio'] * cantidad
                detalle.append({'id': fila['id'], 'nombre': fila['nombre'],
                                'precio': fila['precio'], 'cantidad': cantidad})

            cursor = conn.execute('''
                INSERT INTO pedidos (nombre, apellido, cedula, telefono, banco, referencia, productos, total, estado, fecha)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'En Progreso', ?)
            ''', (cliente['nombre'], cliente['apellido'], cliente['cedula'], cliente['telefono'],
                  cliente['banco'], cliente['referencia'], json.dumps(detalle, ensure_ascii=False),
                  round(total, 2), datetime.now().strftime('%Y-%m-%d %H:%M')))
            conn.commit()
            pedido_id = cursor.lastrowid
            conn.close()
            return self.send_json_response({'message': 'Pedido registrado exitosamente', 'id': pedido_id,
                                            'total': round(total, 2)}, status=201)

        if ruta == '/api/mensajes':
            nombre = texto_requerido(data, 'nombre', 100)
            email = texto_requerido(data, 'email', 150)
            mensaje = texto_requerido(data, 'mensaje', 2000)
            if '@' not in email or '.' not in email:
                raise ErrorValidacion('Correo electrónico inválido')
            conn = get_conn()
            conn.execute('INSERT INTO mensajes (nombre, email, mensaje, fecha) VALUES (?, ?, ?, ?)',
                         (nombre, email, mensaje, datetime.now().strftime('%Y-%m-%d %H:%M')))
            conn.commit()
            conn.close()
            return self.send_json_response({'message': 'Mensaje recibido'}, status=201)

        return self.no_encontrado()

    # MANEJO DE PETICIONES PUT
    def do_PUT(self):
        return self.ejecutar(self.put_api)

    def put_api(self):
        ruta = self.ruta()
        if not self.es_admin():
            return self.no_autorizado()
        data = self.leer_json()

        if ruta.startswith('/api/productos/'):
            prod_id = ruta.split('/')[-1]
            valores = (
                texto_requerido(data, 'nombre', 120),
                texto_requerido(data, 'categoria', 60).lower(),
                precio_valido(data),
                texto_requerido(data, 'imagen', 300),
                texto_requerido(data, 'descripcion', 1000),
            )
            conn = get_conn()
            cursor = conn.execute('''
                UPDATE productos
                SET nombre=?, categoria=?, precio=?, imagen=?, descripcion=?
                WHERE id=?
            ''', (*valores, prod_id))
            conn.commit()
            conn.close()
            if cursor.rowcount == 0:
                return self.send_json_response({'error': 'Producto no encontrado'}, status=404)
            return self.send_json_response({'message': 'Producto actualizado'})

        if ruta.startswith('/api/pedidos/'):
            pedido_id = ruta.split('/')[-1]
            estado = data.get('estado')
            if estado not in ('En Progreso', 'Realizado'):
                raise ErrorValidacion('Estado inválido')
            conn = get_conn()
            cursor = conn.execute('UPDATE pedidos SET estado=? WHERE id=?', (estado, pedido_id))
            conn.commit()
            conn.close()
            if cursor.rowcount == 0:
                return self.send_json_response({'error': 'Pedido no encontrado'}, status=404)
            return self.send_json_response({'message': 'Estado del pedido actualizado'})

        return self.no_encontrado()

    # MANEJO DE PETICIONES DELETE
    def do_DELETE(self):
        return self.ejecutar(self.delete_api)

    def delete_api(self):
        ruta = self.ruta()
        if not self.es_admin():
            return self.no_autorizado()

        tablas = {'/api/productos/': 'productos', '/api/mensajes/': 'mensajes', '/api/pedidos/': 'pedidos'}
        for prefijo, tabla in tablas.items():
            if ruta.startswith(prefijo):
                registro_id = ruta.split('/')[-1]
                conn = get_conn()
                cursor = conn.execute(f'DELETE FROM {tabla} WHERE id=?', (registro_id,))
                conn.commit()
                conn.close()
                if cursor.rowcount == 0:
                    return self.send_json_response({'error': 'Registro no encontrado'}, status=404)
                return self.send_json_response({'message': 'Eliminado correctamente'})

        return self.no_encontrado()


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    # Servidor multihilo: cada petición se atiende en su propio hilo, así una
    # conexión ociosa del navegador (preconnect de Chrome) no bloquea al resto.
    daemon_threads = True


# --- 3. INICIO DEL SERVIDOR ---
if __name__ == '__main__':
    init_db()
    with ThreadedServer(("", PORT), CustomHandler) as httpd:
        print(f"Servidor corriendo en http://localhost:{PORT}")
        print("Base de datos SQLite lista y sincronizada.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")
