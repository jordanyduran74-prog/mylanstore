import os
import sqlite3

# Modelo relacional extendido (para futuras versiones). No interfiere con las
# tablas que usa server.py (productos, pedidos, mensajes, usuario_admin).
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(BASE_DIR, 'db'), exist_ok=True)
conn = sqlite3.connect(os.path.join(BASE_DIR, 'db', 'mylanstore.db'))
cursor = conn.cursor()

# 1. Tabla usuarios
cursor.execute('''
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefono TEXT,
    rol TEXT DEFAULT 'cliente'
)
''')

# 2. Tabla categorias
cursor.execute('''
CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    descripcion TEXT
)
''')

# 3. Tabla direcciones
cursor.execute('''
CREATE TABLE IF NOT EXISTS direcciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    direccion TEXT NOT NULL,
    ciudad TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
)
''')

# 4. Tabla metodos_pago
cursor.execute('''
CREATE TABLE IF NOT EXISTS metodos_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    instrucciones TEXT,
    activo INTEGER DEFAULT 1
)
''')

# 5. Tabla carrito
cursor.execute('''
CREATE TABLE IF NOT EXISTS carrito (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    fecha_creacion TEXT,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
)
''')

# 6. Tabla reservas (pedidos del modelo relacional; "pedidos" ya la usa server.py)
cursor.execute('''
CREATE TABLE IF NOT EXISTS reservas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    metodo_pago_id INTEGER,
    fecha_pedido TEXT,
    estado TEXT DEFAULT 'pendiente',
    total REAL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago(id)
)
''')

# 7. Tabla historial_pedidos
cursor.execute('''
CREATE TABLE IF NOT EXISTS historial_pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reserva_id INTEGER,
    estado TEXT,
    fecha_cambio TEXT,
    FOREIGN KEY (reserva_id) REFERENCES reservas(id)
)
''')

conn.commit()
conn.close()
print("¡Todas las tablas del modelo relacional fueron creadas con éxito!")