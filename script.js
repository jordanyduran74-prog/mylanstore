document.addEventListener('DOMContentLoaded', () => {

    // 1. ORIGEN DE DATOS: el catálogo se lee de la base de datos SQLite a través de la API (server.py)
    let productos = [];

    // Imagen de respaldo local si una imagen de producto no se encuentra
    const IMG_RESPALDO = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">' +
        '<rect width="200" height="150" fill="#1e293b"/>' +
        '<text x="100" y="82" font-family="sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">Sin imagen</text></svg>'
    );
    window.IMG_RESPALDO = IMG_RESPALDO;

    // PERSISTENCIA - Recuperar carrito guardado en localStorage
    let carrito = JSON.parse(localStorage.getItem('mylanstore_carrito')) || [];

    // Captura de Nodos DOM
    const gridProductos = document.getElementById('grid-productos');
    const buscador = document.getElementById('buscador');
    const selectCategoria = document.getElementById('select-categoria');
    
    const cartBtn = document.getElementById('cart-btn');
    const cartModal = document.getElementById('cart-modal');
    const closeCart = document.getElementById('close-cart');
    const cartItemsContainer = document.getElementById('cart-items');
    const cartFooter = document.querySelector('.cart-footer');
    const cartCount = document.getElementById('cart-count');
    const toastContainer = document.getElementById('toast-container');

    // Captura Formulario Contacto
    const contactoForm = document.getElementById('contacto-form');
    const inputNombre = document.getElementById('nombre');
    const inputEmail = document.getElementById('email');
    const inputMensaje = document.getElementById('mensaje');
    const btnSubmitContacto = document.getElementById('btn-submit-contacto');

    const errorNombre = document.getElementById('error-nombre');
    const errorEmail = document.getElementById('error-email');
    const errorMensaje = document.getElementById('error-mensaje');

    // SISTEMA DE NOTIFICACIONES TOAST (UX)
    function mostrarToast(mensaje, tipo = 'info') {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${tipo}`;
        toast.innerHTML = `<span>${mensaje}</span>`;

        toastContainer.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // PERSISTENCIA EN LOCALSTORAGE
    function guardarCarritoEnStorage() {
        localStorage.setItem('mylanstore_carrito', JSON.stringify(carrito));
    }

    // RENDERIZADO DE PRODUCTOS
    function renderizarProductos(lista) {
        if (!gridProductos) return;
        gridProductos.innerHTML = '';

        if (lista.length === 0) {
            gridProductos.innerHTML = `<p class="no-results">No se encontraron productos que coincidan con el filtro.</p>`;
            return;
        }

        lista.forEach(producto => {
            const card = document.createElement('article');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-icon" onclick="verDetalle('${producto.id}')" style="cursor:pointer;">
                    <img src="${producto.imagen}" alt="${producto.nombre}" class="producto-img" onerror="this.onerror=null; this.src=window.IMG_RESPALDO">
                </div>
                <h3 onclick="verDetalle('${producto.id}')" style="cursor:pointer;">${producto.nombre}</h3>
                <p>${producto.descripcion.length > 60 ? producto.descripcion.substring(0, 60) + '...' : producto.descripcion}</p>
                <div class="precio">$${parseFloat(producto.precio).toFixed(2)}</div>
                <div style="display:flex; gap:6px; margin-top:10px; width:100%;">
                    <button type="button" class="btn btn-add" data-id="${producto.id}" style="flex:1;">Comprar</button>
                    <button type="button" class="btn btn-secondary" onclick="verDetalle('${producto.id}')" style="width:auto; padding: 0.72rem 0.9rem;">👁️</button>
                </div>
            `;
            gridProductos.appendChild(card);
        });
    }

    // MOSTRAR MODAL CON DESCRIPCIÓN DETALLADA
    window.verDetalle = function(id) {
        const prod = productos.find(p => String(p.id) === String(id));
        if (!prod) return;

        const modalDetalle = document.getElementById('modal-detalle');
        const detalleContenido = document.getElementById('detalle-contenido');

        if (!modalDetalle || !detalleContenido) return;

        detalleContenido.innerHTML = `
            <div style="text-align:center;">
                <img src="${prod.imagen}" alt="${prod.nombre}" style="max-width:100%; max-height:220px; object-fit:contain; margin-bottom:15px; border-radius:8px;" onerror="this.onerror=null; this.src=window.IMG_RESPALDO">
                <h2 style="margin-bottom:10px; color:#ffffff;">${prod.nombre}</h2>
                <span class="product-tag" style="text-transform:uppercase; font-weight:bold;">${prod.categoria}</span>
                <p style="margin:15px 0; line-height:1.6; text-align:justify; color:#cbd5e1;">${prod.descripcion}</p>
                <div style="font-size:1.5rem; font-weight:bold; color:#4ade80; margin-bottom:15px;">$${parseFloat(prod.precio).toFixed(2)}</div>
                <button type="button" class="btn btn-add" onclick="agregarAlCarrito('${prod.id}'); document.getElementById('modal-detalle').classList.remove('active');" style="width:100%; padding:10px;">🛒 Añadir al Carrito</button>
            </div>
        `;

        modalDetalle.classList.add('active');
    };

    const closeDetalle = document.getElementById('close-detalle');
    if (closeDetalle) {
        closeDetalle.addEventListener('click', () => {
            document.getElementById('modal-detalle').classList.remove('active');
        });
    }

    // FILTRADO DE PRODUCTOS
    function filtrarProductos() {
        const texto = buscador ? buscador.value.toLowerCase().trim() : '';
        const categoria = selectCategoria ? selectCategoria.value : 'todas';

        const productosFiltrados = productos.filter(p => {
            const coincideTexto = p.nombre.toLowerCase().includes(texto) || 
                                   p.descripcion.toLowerCase().includes(texto);
            const coincideCategoria = categoria === 'todas' || p.categoria === categoria;

            return coincideTexto && coincideCategoria;
        });

        renderizarProductos(productosFiltrados);
    }

    // MANEJO DEL CARRITO
    window.agregarAlCarrito = function(id) {
        const productoEncontrado = productos.find(p => String(p.id) === String(id));
        if (!productoEncontrado) return;

        const existente = carrito.find(item => String(item.id) === String(id));
        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({ ...productoEncontrado, cantidad: 1 });
        }

        guardarCarritoEnStorage();
        actualizarCarritoUI();
        mostrarToast(`🛒 Se añadió "${productoEncontrado.nombre}" al carrito.`, 'success');
    };

    function eliminarDelCarrito(id) {
        const itemEliminado = carrito.find(item => String(item.id) === String(id));
        carrito = carrito.filter(item => String(item.id) !== String(id));

        guardarCarritoEnStorage();
        actualizarCarritoUI();
        if (itemEliminado) {
            mostrarToast(`❌ "${itemEliminado.nombre}" fue removido del carrito.`, 'danger');
        }
    }

    function actualizarCarritoUI() {
        if (!cartItemsContainer) return;

        cartItemsContainer.innerHTML = '';
        let total = 0;
        let totalCount = 0;

        if (carrito.length === 0) {
            cartItemsContainer.innerHTML = '<p class="cart-empty">El carrito está vacío.</p>';
        } else {
            carrito.forEach(item => {
                const precioNum = parseFloat(item.precio);
                total += precioNum * item.cantidad;
                totalCount += item.cantidad;

                const itemElement = document.createElement('div');
                itemElement.classList.add('cart-item');
                itemElement.innerHTML = `
                    <div>
                        <div class="cart-item-title">${item.nombre}</div>
                        <div class="cart-item-price">$${precioNum.toFixed(2)} x ${item.cantidad}</div>
                    </div>
                    <button type="button" class="btn-remove" data-id="${item.id}">❌ Eliminar</button>
                `;
                cartItemsContainer.appendChild(itemElement);
            });
        }

        const cartTotalPrice = document.getElementById('cart-total-price');
        if (cartTotalPrice) cartTotalPrice.textContent = `$${total.toFixed(2)}`;
        if (cartCount) cartCount.textContent = totalCount;
    }

    // FLUJO DE CHECKOUT / PAGO PROFESIONAL EN EL CARRITO
    function restaurarFooterCarrito() {
        if (!cartFooter) return;
        const totalActual = carrito.reduce((acc, item) => acc + (parseFloat(item.precio) * item.cantidad), 0);
        cartFooter.innerHTML = `
            <div class="cart-total">
                <span>Total:</span>
                <span id="cart-total-price">$${totalActual.toFixed(2)}</span>
            </div>
            <button type="button" class="btn btn-checkout">Proceder al Pago</button>
        `;
    }

    if (cartFooter) {
        cartFooter.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-checkout')) return;

            if (carrito.length === 0) {
                mostrarToast('⚠️ El carrito está vacío. Agrega productos antes de pagar.', 'danger');
                return;
            }

            const total = carrito.reduce((acc, item) => acc + (parseFloat(item.precio) * item.cantidad), 0);

            cartFooter.innerHTML = `
                <form id="form-checkout" style="display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 5px;">
                    <h4 style="margin-bottom: 5px; color: #c084fc;">Datos de Pago y Envío</h4>
                    <input type="text" id="checkout-nombre" placeholder="Nombre" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    <input type="text" id="checkout-apellido" placeholder="Apellido" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    <input type="text" id="checkout-cedula" placeholder="Cédula" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    <input type="text" id="checkout-telefono" placeholder="Teléfono" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    
                    <select id="checkout-banco" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                        <option value="">Selecciona Banco</option>
                        <option value="Banesco">Banesco</option>
                        <option value="Mercantil">Mercantil</option>
                        <option value="Provincial">Provincial</option>
                        <option value="BNC">BNC</option>
                        <option value="Zelle / Internacional">Zelle / Internacional</option>
                    </select>

                    <input type="text" id="checkout-referencia" placeholder="Nro. de Referencia Bancaria" required style="padding: 8px; background: var(--surface-bg); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    
                    <div style="font-weight: bold; margin-top: 5px; color: #4ade80;">Total a Pagar: $${total.toFixed(2)}</div>
                    
                    <button type="submit" class="btn" style="background: linear-gradient(135deg, #16a34a, #22c55e); margin-top: 5px;">Confirmar y Enviar Pedido</button>
                    <button type="button" id="btn-cancelar-checkout" class="btn btn-secondary" style="font-size: 0.85rem; padding: 6px; margin-top: 4px;">Volver al Carrito</button>
                </form>
            `;

            document.getElementById('form-checkout').addEventListener('submit', (ev) => {
                ev.preventDefault();

                const payload = {
                    nombre: document.getElementById('checkout-nombre').value.trim(),
                    apellido: document.getElementById('checkout-apellido').value.trim(),
                    cedula: document.getElementById('checkout-cedula').value.trim(),
                    telefono: document.getElementById('checkout-telefono').value.trim(),
                    banco: document.getElementById('checkout-banco').value,
                    referencia: document.getElementById('checkout-referencia').value.trim(),
                    productos: carrito,
                    total: total
                };

                fetch('/api/pedidos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                .then(res => res.json().then(body => {
                    if (!res.ok) throw new Error(body.error || 'Error al enviar pedido');
                    return body;
                }))
                .then((resp) => {
                    mostrarToast(`🎉 ¡Pedido #${resp.id} registrado con éxito! Total: $${parseFloat(resp.total).toFixed(2)}`, 'success');
                    carrito = [];
                    guardarCarritoEnStorage();
                    actualizarCarritoUI();
                    restaurarFooterCarrito();
                    if (cartModal) cartModal.classList.remove('active');
                })
                .catch((err) => mostrarToast(`❌ ${err.message || 'Error al procesar el pedido en el servidor'}`, 'danger'));
            });

            document.getElementById('btn-cancelar-checkout').addEventListener('click', () => {
                restaurarFooterCarrito();
                actualizarCarritoUI();
            });
        });
    }

    // VALIDACIÓN IN-LINE DEL FORMULARIO DE CONTACTO
    const validarNombre = () => {
        if (!inputNombre) return false;
        const val = inputNombre.value.trim();
        const esValido = val.length >= 3;
        marcarCampo(inputNombre, errorNombre, esValido);
        return esValido;
    };

    const validarEmail = () => {
        if (!inputEmail) return false;
        const val = inputEmail.value.trim();
        const esValido = val.includes('@') && val.includes('.') && val.length > 5;
        marcarCampo(inputEmail, errorEmail, esValido);
        return esValido;
    };

    const validarMensaje = () => {
        if (!inputMensaje) return false;
        const val = inputMensaje.value.trim();
        const esValido = val.length >= 10;
        marcarCampo(inputMensaje, errorMensaje, esValido);
        return esValido;
    };

    function marcarCampo(input, spanError, esValido) {
        if (!input || !spanError) return;

        if (input.value.trim() === '') {
            input.classList.remove('valid', 'invalid');
            spanError.classList.remove('active');
            return;
        }

        if (esValido) {
            input.classList.add('valid');
            input.classList.remove('invalid');
            spanError.classList.remove('active');
        } else {
            input.classList.add('invalid');
            input.classList.remove('valid');
            spanError.classList.add('active');
        }
    }

    function validarFormularioCompleto() {
        const esValido = validarNombre() && validarEmail() && validarMensaje();
        if (btnSubmitContacto) {
            btnSubmitContacto.disabled = !esValido;
        }
    }

    // --- AUTENTICACIÓN Y ACCESO RESTRINGIDO A ADMIN ---
    const btnOpenAdmin = document.getElementById('btn-open-admin');
    const modalAuthAdmin = document.getElementById('modal-auth-admin');
    const closeAuthAdmin = document.getElementById('close-auth-admin');
    const formLoginAdmin = document.getElementById('form-login-admin');
    const inputAdminPassword = document.getElementById('input-admin-password');

    if (btnOpenAdmin && modalAuthAdmin) {
        btnOpenAdmin.addEventListener('click', (e) => {
            e.preventDefault();
            modalAuthAdmin.classList.add('active');
            if (inputAdminPassword) {
                inputAdminPassword.value = '';
                inputAdminPassword.focus();
            }
        });
    }

    if (closeAuthAdmin && modalAuthAdmin) {
        closeAuthAdmin.addEventListener('click', () => {
            modalAuthAdmin.classList.remove('active');
        });
    }

    if (formLoginAdmin) {
        formLoginAdmin.addEventListener('submit', (e) => {
            e.preventDefault();
            const passIngresada = inputAdminPassword.value.trim();

            // La contraseña se valida en el servidor contra la tabla usuario_admin (SQLite)
            fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario: 'admin', password: passIngresada })
            })
            .then(res => res.json().then(body => ({ ok: res.ok, body })))
            .then(({ ok, body }) => {
                if (!ok || !body.token) throw new Error(body.error || 'Contraseña incorrecta');

                sessionStorage.setItem('mylanstore_admin_token', body.token);
                mostrarToast('🔓 Acceso concedido. Redirigiendo a Administración...', 'success');
                modalAuthAdmin.classList.remove('active');
                setTimeout(() => {
                    window.location.href = 'admin.html';
                }, 800);
            })
            .catch((err) => {
                const msg = err instanceof TypeError ? 'No hay conexión con el servidor' : err.message;
                mostrarToast(`❌ ${msg}. Inténtalo de nuevo.`, 'danger');
                inputAdminPassword.value = '';
                inputAdminPassword.focus();
            });
        });
    }

    // Cerrar los modales al hacer clic fuera del contenido
    [document.getElementById('modal-detalle'), modalAuthAdmin].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active, .cart-modal.active, .assistant-modal.active')
                .forEach(m => m.classList.remove('active'));
        }
    });

    // LISTENERS Y EVENTOS GENERALES
    if (gridProductos) {
        gridProductos.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-add')) {
                const id = e.target.getAttribute('data-id');
                agregarAlCarrito(id);
            }
        });
    }

    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove')) {
                const id = e.target.getAttribute('data-id');
                eliminarDelCarrito(id);
            }
        });
    }

    if (buscador) buscador.addEventListener('input', filtrarProductos);
    if (selectCategoria) selectCategoria.addEventListener('change', filtrarProductos);

    if (cartBtn && cartModal && closeCart) {
        cartBtn.addEventListener('click', () => cartModal.classList.add('active'));
        closeCart.addEventListener('click', () => cartModal.classList.remove('active'));
        
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) cartModal.classList.remove('active');
        });
    }

    if (contactoForm) {
        [inputNombre, inputEmail, inputMensaje].forEach(input => {
            if (input) {
                input.addEventListener('input', validarFormularioCompleto);
                input.addEventListener('blur', validarFormularioCompleto);
            }
        });

        contactoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (validarNombre() && validarEmail() && validarMensaje()) {
                if (btnSubmitContacto) btnSubmitContacto.disabled = true;

                fetch('/api/mensajes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nombre: inputNombre.value.trim(),
                        email: inputEmail.value.trim(),
                        mensaje: inputMensaje.value.trim()
                    })
                })
                .then(res => res.json().then(body => {
                    if (!res.ok) throw new Error(body.error || 'No se pudo enviar el mensaje');
                }))
                .then(() => {
                    mostrarToast('✉️ ¡Mensaje enviado con éxito! Te responderemos pronto.', 'success');
                    contactoForm.reset();
                    [inputNombre, inputEmail, inputMensaje].forEach(i => {
                        if (i) i.classList.remove('valid', 'invalid');
                    });
                })
                .catch((err) => {
                    mostrarToast(`❌ ${err.message}`, 'danger');
                    validarFormularioCompleto();
                });
            }
        });
    }

    // CARGA INICIAL DE PRODUCTOS DESDE LA API DEL SERVIDOR BACKEND (SQLITE)
    function cargarProductosDesdeAPI() {
        fetch('/api/productos')
            .then(response => {
                if (!response.ok) throw new Error('Error al conectar con la API');
                return response.json();
            })
            .then(data => {
                productos = Array.isArray(data) ? data : [];
                actualizarOpcionesCategoria();
                filtrarProductos();
            })
            .catch(error => {
                console.error('No se pudo conectar con el servidor:', error);
                if (gridProductos) {
                    gridProductos.innerHTML = `<p class="no-results">⚠️ No se pudo conectar con el servidor. Ejecuta <strong>python server.py</strong> y abre <strong>http://localhost:8000</strong></p>`;
                }
            });
    }

    // Agrega al filtro las categorías nuevas creadas desde el panel de administración
    function actualizarOpcionesCategoria() {
        if (!selectCategoria) return;
        const existentes = new Set(Array.from(selectCategoria.options).map(o => o.value));
        [...new Set(productos.map(p => p.categoria))].forEach(cat => {
            if (cat && !existentes.has(cat)) {
                const opcion = document.createElement('option');
                opcion.value = cat;
                opcion.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
                selectCategoria.appendChild(opcion);
            }
        });
    }

    // --- CONTROL DEL CHATBOT FLOTANTE ---
    const floatingBtn = document.getElementById('floating-assistant-btn');
    const assistantModal = document.getElementById('floating-assistant-modal');
    const closeAssistant = document.getElementById('close-assistant-modal');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatMessages = document.getElementById('chat-messages');

    const respuestasBot = [
        {
            keywords: ['garantia', 'garantía', 'defecto', 'fábrica', 'cambio'],
            respuesta: "🛡️ <strong>Garantía:</strong> Todos nuestros productos cuentan con garantía oficial de fábrica contra defectos (entre 6 meses y 1 año según el producto)."
        },
        {
            keywords: ['precio', 'costo', 'dolar', 'dólar', 'bs', 'bolivar', 'bolívares', 'tasa', 'bcv'],
            respuesta: "💵 <strong>Precios y Tasas:</strong> Los precios están expresados en dólares ($). Si pagas en bolívares, aplicamos la tasa oficial del BCV del día."
        },
        {
            keywords: ['pago', 'pagar', 'metodo', 'método', 'banco', 'zelle', 'transferencia', 'movil', 'móvil', 'efectivo'],
            respuesta: "💳 <strong>Métodos de Pago:</strong> Aceptamos Pago Móvil, transferencias (Banesco, Mercantil, Provincial, BNC), Zelle y efectivo en tienda."
        },
        {
            keywords: ['soporte', 'ayuda', 'tecnico', 'técnico', 'asesoría', 'asesoramiento', 'contacto'],
            respuesta: "👨‍💻 <strong>Soporte Técnico:</strong> Te asesoramos en la elección de componentes para tu setup y brindamos soporte post-venta. Escríbenos en la sección 'Contáctanos'."
        },
        {
            keywords: ['reserva', 'reservar', 'apartado', 'apartar', '50%'],
            respuesta: "📌 <strong>Reservas:</strong> Puedes apartar cualquier producto abonando el 50% de su valor. Lo guardamos a tu nombre hasta por 5 días hábiles."
        }
    ];

    if (floatingBtn && assistantModal) {
        floatingBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            assistantModal.classList.toggle('active');
        });
    }

    if (closeAssistant && assistantModal) {
        closeAssistant.addEventListener('click', () => {
            assistantModal.classList.remove('active');
        });
    }

    if (chatForm && chatInput && chatMessages) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const mensajeUsuario = chatInput.value.trim();
            if (!mensajeUsuario) return;

            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'chat-msg user-msg';
            userMsgDiv.textContent = mensajeUsuario;
            chatMessages.appendChild(userMsgDiv);
            chatInput.value = '';
            chatMessages.scrollTop = chatMessages.scrollHeight;

            const textoLimpio = mensajeUsuario.toLowerCase();
            let respuestaEncontrada = null;

            for (const item of respuestasBot) {
                if (item.keywords.some(kw => textoLimpio.includes(kw))) {
                    respuestaEncontrada = item.respuesta;
                    break;
                }
            }

            if (!respuestaEncontrada) {
                respuestaEncontrada = "🤖 Lo siento, no entendí bien. Pregúntame sobre <strong>garantías</strong>, <strong>precios</strong>, <strong>métodos de pago</strong>, <strong>soporte</strong> o <strong>reservas</strong>.";
            }

            setTimeout(() => {
                const botMsgDiv = document.createElement('div');
                botMsgDiv.className = 'chat-msg bot-msg';
                botMsgDiv.innerHTML = respuestaEncontrada;
                chatMessages.appendChild(botMsgDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }, 400);
        });
    }

    // INICIALIZACIÓN
    cargarProductosDesdeAPI();
    actualizarCarritoUI();
});