document.addEventListener('DOMContentLoaded', () => {

    // 1. VERIFICACIÓN DE SEGURIDAD (token emitido por el servidor en /api/login)
    const TOKEN_KEY = 'mylanstore_admin_token';
    const token = sessionStorage.getItem(TOKEN_KEY);

    function volverAlLogin(mensaje) {
        sessionStorage.removeItem(TOKEN_KEY);
        if (mensaje) alert(mensaje);
        window.location.href = 'index.html';
    }

    if (!token) {
        volverAlLogin('Acceso no autorizado. Por favor ingresa la contraseña de administrador.');
        return;
    }

    // Petición autenticada a la API. Si la sesión expiró, regresa al login.
    function api(url, opciones = {}) {
        const headers = Object.assign({ 'Authorization': `Bearer ${token}` }, opciones.headers || {});
        if (opciones.body) headers['Content-Type'] = 'application/json';
        return fetch(url, Object.assign({}, opciones, { headers }))
            .then(res => res.json().catch(() => ({})).then(body => {
                if (res.status === 401) {
                    volverAlLogin('Tu sesión expiró. Vuelve a iniciar sesión.');
                    throw new Error('Sesión expirada');
                }
                if (!res.ok) throw new Error(body.error || `Error ${res.status}`);
                return body;
            }));
    }

    const IMG_RESPALDO = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">' +
        '<rect width="60" height="60" fill="#1e293b"/>' +
        '<text x="30" y="34" font-family="sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">Sin imagen</text></svg>'
    );
    window.IMG_RESPALDO = IMG_RESPALDO;

    const formProducto = document.getElementById('form-producto');
    const tablaProductosBody = document.querySelector('#tabla-admin-productos tbody');
    const tablaPedidosBody = document.querySelector('#tabla-admin-pedidos tbody');
    const tablaMensajesBody = document.querySelector('#tabla-admin-mensajes tbody');
    const btnCancelarAdmin = document.getElementById('btn-cancelar-admin');
    const btnGuardarProd = document.getElementById('btn-guardar-prod');
    const btnLogout = document.getElementById('btn-logout');
    const toastContainer = document.getElementById('toast-container');

    const inputId = document.getElementById('admin-prod-id');
    const inputNombre = document.getElementById('admin-nombre');
    const inputCategoria = document.getElementById('admin-categoria');
    const inputPrecio = document.getElementById('admin-precio');
    const inputImagen = document.getElementById('admin-imagen');
    const inputDescripcion = document.getElementById('admin-descripcion');
    const previewImagen = document.getElementById('admin-preview-img');

    let productosCache = [];

    window.escapeHtml = function(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };
    const esc = window.escapeHtml;

    function mostrarToast(mensaje, tipo = 'info') {
        if (!toastContainer) return alert(mensaje);
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.textContent = mensaje;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- PESTAÑAS ---
    const tabs = {
        productos: { seccion: 'seccion-productos', boton: 'tab-productos-btn', cargar: () => cargarInventarioAdmin() },
        pedidos:   { seccion: 'seccion-pedidos',   boton: 'tab-pedidos-btn',   cargar: () => cargarPedidosAdmin() },
        mensajes:  { seccion: 'seccion-mensajes',  boton: 'tab-mensajes-btn',  cargar: () => cargarMensajesAdmin() }
    };

    function cambiarTab(nombre) {
        Object.entries(tabs).forEach(([clave, tab]) => {
            const seccion = document.getElementById(tab.seccion);
            const boton = document.getElementById(tab.boton);
            const activa = clave === nombre;
            if (seccion) seccion.style.display = activa ? 'block' : 'none';
            if (boton) boton.classList.toggle('active', activa);
        });
        if (tabs[nombre]) tabs[nombre].cargar();
    }
    window.cambiarTab = cambiarTab;

    Object.entries(tabs).forEach(([clave, tab]) => {
        const boton = document.getElementById(tab.boton);
        if (boton) boton.addEventListener('click', () => cambiarTab(clave));
    });

    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            api('/api/logout', { method: 'POST' })
                .catch(() => {})
                .finally(() => volverAlLogin());
        });
    }

    // --- PRODUCTOS ---
    function cargarInventarioAdmin() {
        fetch('/api/productos')
            .then(res => {
                if (!res.ok) throw new Error('Error al obtener productos');
                return res.json();
            })
            .then(data => {
                productosCache = Array.isArray(data) ? data : [];
                renderizarTablaAdmin(productosCache);
            })
            .catch(err => {
                console.warn('Error al cargar inventario del servidor:', err);
                if (tablaProductosBody) {
                    tablaProductosBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No se pudo conectar con el servidor.</td></tr>`;
                }
            });
    }

    function renderizarTablaAdmin(productos) {
        if (!tablaProductosBody) return;
        tablaProductosBody.innerHTML = '';

        if (productos.length === 0) {
            tablaProductosBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No hay productos registrados.</td></tr>`;
            return;
        }

        productos.forEach(prod => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${esc(prod.id)}</strong></td>
                <td><img src="${esc(prod.imagen)}" alt="${esc(prod.nombre)}" class="admin-thumb" onerror="this.onerror=null; this.src=window.IMG_RESPALDO"></td>
                <td>
                    <div class="info-block">
                        <strong>${esc(prod.nombre)}</strong>
                    </div>
                </td>
                <td><span class="product-tag">${esc(prod.categoria)}</span></td>
                <td><span class="total-amount">$${parseFloat(prod.precio).toFixed(2)}</span></td>
                <td>
                    <div class="action-buttons" style="width: auto; flex-direction: row; gap: 6px;">
                        <button type="button" class="btn-action btn-progress" data-accion="editar" data-id="${esc(prod.id)}">✏️ Editar</button>
                        <button type="button" class="btn btn-danger" style="width: auto; padding: 6px 10px; font-size: 0.75rem;" data-accion="eliminar" data-id="${esc(prod.id)}">🗑️ Eliminar</button>
                    </div>
                </td>
            `;
            tablaProductosBody.appendChild(tr);
        });
    }

    if (tablaProductosBody) {
        tablaProductosBody.addEventListener('click', (e) => {
            const boton = e.target.closest('button[data-accion]');
            if (!boton) return;
            const id = boton.getAttribute('data-id');
            if (boton.dataset.accion === 'editar') editarProducto(id);
            if (boton.dataset.accion === 'eliminar') eliminarProducto(id);
        });
    }

    function actualizarPreview() {
        if (!previewImagen) return;
        const ruta = inputImagen.value.trim();
        previewImagen.style.display = ruta ? 'block' : 'none';
        if (ruta) previewImagen.src = ruta;
        else previewImagen.removeAttribute('src');
    }
    if (inputImagen) inputImagen.addEventListener('input', actualizarPreview);
    if (previewImagen) {
        previewImagen.addEventListener('error', () => {
            if (previewImagen.src !== IMG_RESPALDO && inputImagen.value.trim()) previewImagen.src = IMG_RESPALDO;
        });
    }

    function resetFormulario() {
        formProducto.reset();
        inputId.value = '';
        if (btnGuardarProd) btnGuardarProd.textContent = 'Guardar Producto';
        if (btnCancelarAdmin) btnCancelarAdmin.style.display = 'none';
        actualizarPreview();
    }

    if (formProducto) {
        formProducto.addEventListener('submit', (e) => {
            e.preventDefault();

            const id = inputId.value;
            const productoData = {
                nombre: inputNombre.value.trim(),
                categoria: inputCategoria.value.trim().toLowerCase(),
                precio: parseFloat(inputPrecio.value),
                imagen: inputImagen.value.trim(),
                descripcion: inputDescripcion.value.trim()
            };

            api(id ? `/api/productos/${encodeURIComponent(id)}` : '/api/productos', {
                method: id ? 'PUT' : 'POST',
                body: JSON.stringify(productoData)
            })
            .then(() => {
                mostrarToast(id ? '✅ Producto actualizado con éxito' : '🎉 Producto creado con éxito', 'success');
                resetFormulario();
                cargarInventarioAdmin();
            })
            .catch(err => mostrarToast(`❌ ${err.message}`, 'danger'));
        });
    }

    function editarProducto(id) {
        const prod = productosCache.find(p => String(p.id) === String(id));
        if (!prod) return;
        inputId.value = prod.id;
        inputNombre.value = prod.nombre;
        inputCategoria.value = prod.categoria;
        inputPrecio.value = prod.precio;
        inputImagen.value = prod.imagen;
        inputDescripcion.value = prod.descripcion;
        actualizarPreview();

        if (btnGuardarProd) btnGuardarProd.textContent = 'Actualizar Producto';
        if (btnCancelarAdmin) btnCancelarAdmin.style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (btnCancelarAdmin) btnCancelarAdmin.addEventListener('click', resetFormulario);

    function eliminarProducto(id) {
        if (!confirm('¿Estás seguro de que deseas eliminar este producto de la base de datos?')) return;
        api(`/api/productos/${encodeURIComponent(id)}`, { method: 'DELETE' })
            .then(() => {
                mostrarToast('🗑️ Producto eliminado correctamente', 'success');
                cargarInventarioAdmin();
            })
            .catch(err => mostrarToast(`❌ ${err.message}`, 'danger'));
    }

    // --- PEDIDOS ---
    function cargarPedidosAdmin(silencioso = false) {
        if (!tablaPedidosBody) return;
        if (!silencioso) tablaPedidosBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Cargando pedidos...</td></tr>`;

        api('/api/pedidos')
            .then(pedidos => renderizarTablaPedidos(Array.isArray(pedidos) ? pedidos : []))
            .catch(err => {
                console.warn('Error al cargar pedidos:', err);
                tablaPedidosBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No se pudieron cargar los pedidos.</td></tr>`;
            });
    }

    function formatearProductosPedido(productosRaw) {
        try {
            const lista = typeof productosRaw === 'string' ? JSON.parse(productosRaw) : productosRaw;
            if (!Array.isArray(lista) || lista.length === 0) {
                return `<span class="product-tag">Sin detalle de productos</span>`;
            }
            return lista
                .map(item => `<div><span class="product-tag">${esc(item.nombre)} (x${parseInt(item.cantidad, 10) || 1})</span></div>`)
                .join('');
        } catch (e) {
            return `<span class="product-tag">${esc(productosRaw)}</span>`;
        }
    }

    function renderizarTablaPedidos(pedidos) {
        if (!tablaPedidosBody) return;
        tablaPedidosBody.innerHTML = '';

        actualizarResumen(pedidos);

        if (pedidos.length === 0) {
            tablaPedidosBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No hay pedidos registrados aún.</td></tr>`;
            return;
        }

        const dato = v => esc(v == null || v === '' ? '-' : v);

        pedidos.forEach(pedido => {
            const esRealizado = String(pedido.estado).toLowerCase() === 'realizado';
            const badgeClass = esRealizado ? 'realizado' : 'progreso';
            const badgeTexto = esRealizado ? '✔ Realizado' : '⏳ En Progreso';
            const clienteCompleto = esc(`${pedido.nombre || ''} ${pedido.apellido || ''}`.trim());
            const id = parseInt(pedido.id, 10);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="info-block">
                        <strong>#${id}</strong>
                        <span class="info-subtext">${dato(pedido.fecha)}</span>
                    </div>
                </td>
                <td>
                    <div class="info-block">
                        <strong>${clienteCompleto || 'Cliente'}</strong>
                    </div>
                </td>
                <td>
                    <div class="info-block">
                        <span>CI: ${dato(pedido.cedula)}</span>
                        <span class="info-subtext">Tel: ${dato(pedido.telefono)}</span>
                    </div>
                </td>
                <td>
                    <div class="info-block">
                        <span>${dato(pedido.banco)}</span>
                        <span class="info-subtext">Ref: ${dato(pedido.referencia)}</span>
                    </div>
                </td>
                <td>
                    <div class="info-block">
                        ${formatearProductosPedido(pedido.productos)}
                        <span class="total-amount">Total: $${parseFloat(pedido.total || 0).toFixed(2)}</span>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${badgeClass}">${badgeTexto}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn-action btn-progress" ${!esRealizado ? 'disabled' : ''} onclick="window.actualizarEstadoPedido(${id}, 'En Progreso')">⏳ En Progreso</button>
                        <button type="button" class="btn-action btn-done" ${esRealizado ? 'disabled' : ''} onclick="window.actualizarEstadoPedido(${id}, 'Realizado')">✔ Realizado</button>
                    </div>
                </td>
            `;
            tablaPedidosBody.appendChild(tr);
        });
    }

    function actualizarResumen(pedidos) {
        const resumen = document.getElementById('resumen-pedidos');
        if (!resumen) return;
        const realizados = pedidos.filter(p => String(p.estado).toLowerCase() === 'realizado');
        const ventas = realizados.reduce((acc, p) => acc + parseFloat(p.total || 0), 0);
        resumen.innerHTML = `
            <div class="resumen-item"><span>Pedidos totales</span><strong>${pedidos.length}</strong></div>
            <div class="resumen-item"><span>En progreso</span><strong>${pedidos.length - realizados.length}</strong></div>
            <div class="resumen-item"><span>Realizados</span><strong>${realizados.length}</strong></div>
            <div class="resumen-item"><span>Ventas completadas</span><strong>$${ventas.toFixed(2)}</strong></div>
        `;
    }

    window.actualizarEstadoPedido = function(id, nuevoEstado) {
        api(`/api/pedidos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ estado: nuevoEstado })
        })
        .then(() => {
            mostrarToast(`Pedido #${id} marcado como "${nuevoEstado}"`, 'success');
            cargarPedidosAdmin();
        })
        .catch(err => mostrarToast(`❌ ${err.message}`, 'danger'));
    };

    // --- MENSAJES DE CONTACTO ---
    function cargarMensajesAdmin(silencioso = false) {
        if (!tablaMensajesBody) return;
        if (!silencioso) tablaMensajesBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">Cargando mensajes...</td></tr>`;

        api('/api/mensajes')
            .then(mensajes => {
                mensajes = Array.isArray(mensajes) ? mensajes : [];
                tablaMensajesBody.innerHTML = '';
                if (mensajes.length === 0) {
                    tablaMensajesBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay mensajes todavía.</td></tr>`;
                    return;
                }
                mensajes.forEach(m => {
                    const id = parseInt(m.id, 10);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><div class="info-block"><strong>#${id}</strong><span class="info-subtext">${esc(m.fecha)}</span></div></td>
                        <td><strong>${esc(m.nombre)}</strong></td>
                        <td><a href="mailto:${esc(m.email)}" class="admin-link">${esc(m.email)}</a></td>
                        <td class="mensaje-texto">${esc(m.mensaje)}</td>
                        <td><button type="button" class="btn btn-danger" style="width:auto; padding:6px 10px; font-size:0.75rem;" onclick="window.eliminarMensaje(${id})">🗑️ Eliminar</button></td>
                    `;
                    tablaMensajesBody.appendChild(tr);
                });
            })
            .catch(err => {
                console.warn('Error al cargar mensajes:', err);
                tablaMensajesBody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No se pudieron cargar los mensajes.</td></tr>`;
            });
    }

    window.eliminarMensaje = function(id) {
        if (!confirm('¿Eliminar este mensaje?')) return;
        api(`/api/mensajes/${id}`, { method: 'DELETE' })
            .then(() => {
                mostrarToast('🗑️ Mensaje eliminado', 'success');
                cargarMensajesAdmin();
            })
            .catch(err => mostrarToast(`❌ ${err.message}`, 'danger'));
    };

    // Comprueba que la sesión siga siendo válida (el servidor pudo reiniciarse)
    api('/api/sesion').then(r => {
        if (!r.valida) volverAlLogin('Tu sesión expiró. Vuelve a iniciar sesión.');
    }).catch(() => {});

    // Actualización automática: cada 10 s recarga pedidos/mensajes si esa pestaña está abierta
    setInterval(() => {
        const visible = id => {
            const el = document.getElementById(id);
            return el && el.style.display !== 'none';
        };
        if (document.hidden) return;
        if (visible('seccion-pedidos')) cargarPedidosAdmin(true);
        if (visible('seccion-mensajes')) cargarMensajesAdmin(true);
    }, 10000);

    cargarInventarioAdmin();
});
