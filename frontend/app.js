const API_BASE = '/api';
let token = localStorage.getItem('token') || null;
let usuario = localStorage.getItem('usuario') ? JSON.parse(localStorage.getItem('usuario')) : null;

// Catálogo en memoria para filtros instantáneos
let librosMemoria = [];
let vistaActualCatalogo = 'catalogo'; // 'catalogo' | 'ofertas' | 'novedades'
let timerContador = null;

// ==========================================
// SEGURIDAD: Escape de HTML (C-02)
// Evita XSS al insertar datos del servidor en innerHTML
// ==========================================
function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str ?? '');
  return d.innerHTML;
}

// Valida que una URL sea http o https (M-05)
function urlSegura(url) {
  if (!url || typeof url !== 'string') return '';
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : '';
}

// ==========================================
// UTILIDADES & NOTIFICACIONES
// ==========================================
function mostrarMensaje(texto, tipo = 'info') {
  const div = document.getElementById('mensaje-global');
  // B-04: Usar createElement y textContent en lugar de innerHTML para evitar XSS
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo}`;
  alerta.textContent = texto;
  div.innerHTML = '';
  div.appendChild(alerta);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    if (div.contains(alerta)) {
      div.innerHTML = '';
    }
  }, 6000);
}

async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  options.headers = headers;

  const res = await fetch(`${API_BASE}${endpoint}`, options);

  if (res.status === 401) {
    cerrarSesion();
    mostrarMensaje('Tu sesión ha expirado o no es válida. Por favor, ingresá nuevamente.', 'error');
    navegar('login');
    throw new Error('Sesión expirada');
  }

  return res;
}

// ==========================================
// SESIÓN & NAVEGACIÓN
// ==========================================
function actualizarEstadoSesion() {
  const badge = document.getElementById('badge-usuario');
  const navLogin = document.getElementById('nav-login');
  const navLogout = document.getElementById('nav-logout');
  const navMisReservas = document.getElementById('nav-misreservas');
  const navEmpleado = document.getElementById('nav-empleado');
  const navAdmin = document.getElementById('nav-admin');

  if (usuario && token) {
    badge.classList.remove('hidden');
    document.getElementById('nombre-usuario').textContent = `${usuario.nombre} ${usuario.apellido}`;
    document.getElementById('rol-usuario').textContent = usuario.rol;

    navLogin.classList.add('hidden');
    navLogout.classList.remove('hidden');

    if (usuario.rol === 'cliente') {
      navMisReservas.classList.remove('hidden');
      navEmpleado.classList.add('hidden');
      navAdmin.classList.add('hidden');
    } else if (usuario.rol === 'empleado') {
      navMisReservas.classList.add('hidden');
      navEmpleado.classList.remove('hidden');
      navAdmin.classList.add('hidden');
    } else if (usuario.rol === 'administrador') {
      navMisReservas.classList.add('hidden');
      navEmpleado.classList.remove('hidden');
      navAdmin.classList.remove('hidden');
    }
  } else {
    badge.classList.add('hidden');
    navLogin.classList.remove('hidden');
    navLogout.classList.add('hidden');
    navMisReservas.classList.add('hidden');
    navEmpleado.classList.add('hidden');
    navAdmin.classList.add('hidden');
  }
}

function navegar(seccion) {
  // Verificación de acceso por rol
  if (seccion === 'misreservas' && (!usuario || usuario.rol !== 'cliente')) {
    mostrarMensaje('Acceso exclusivo para clientes', 'error');
    seccion = 'login';
  }
  if (seccion === 'empleado' && (!usuario || (usuario.rol !== 'empleado' && usuario.rol !== 'administrador'))) {
    mostrarMensaje('Acceso restringido: se requiere rol de empleado o administrador', 'error');
    seccion = 'login';
  }
  if (seccion === 'admin' && (!usuario || usuario.rol !== 'administrador')) {
    mostrarMensaje('Acceso restringido: solo administradores', 'error');
    seccion = 'login';
  }

  // Ocultar todas las secciones
  const secciones = ['catalogo', 'misreservas', 'login', 'empleado', 'admin', 'avisos', 'contacto', 'politicas'];
  secciones.forEach(s => {
    const el = document.getElementById(`sec-${s}`);
    if (el) el.classList.add('hidden');
  });

  // Marcar enlace activo
  document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById(`nav-${seccion}`);
  if (navEl) navEl.classList.add('active');

  // Mostrar sección elegida y cargar datos
  if (seccion === 'catalogo' || seccion === 'ofertas' || seccion === 'novedades') {
    vistaActualCatalogo = seccion;
    document.getElementById('sec-catalogo').classList.remove('hidden');
    cargarCatalogo();
  } else {
    const el = document.getElementById(`sec-${seccion}`);
    if (el) el.classList.remove('hidden');

    if (seccion === 'misreservas') cargarMisReservas();
    if (seccion === 'empleado') cargarDatosEmpleado();
    if (seccion === 'admin') cargarDatosAdmin();
    if (seccion === 'avisos') cargarAvisos();
    if (seccion === 'contacto') cargarContacto();
    if (seccion === 'politicas') cargarPoliticas();
  }
}

async function login() {
  const doc = document.getElementById('login-documento').value.trim();
  const pass = document.getElementById('login-contrasena').value;
  if (!doc || !pass) {
    mostrarMensaje('Por favor ingresá documento y contraseña', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documento: doc, contrasena: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Credenciales inválidas', 'error');
      return;
    }

    token = data.token;
    usuario = data.usuario;
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));

    actualizarEstadoSesion();
    mostrarMensaje(`¡Bienvenido/a ${usuario.nombre}!`, 'success');

    if (usuario.rol === 'cliente') {
      navegar('catalogo');
    } else if (usuario.rol === 'empleado') {
      navegar('empleado');
    } else if (usuario.rol === 'administrador') {
      navegar('admin');
    }
  } catch (e) {
    mostrarMensaje('Error de conexión con el servidor', 'error');
  }
}

function cerrarSesion() {
  token = null;
  usuario = null;
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  actualizarEstadoSesion();
  mostrarMensaje('Sesión cerrada correctamente', 'info');
  navegar('catalogo');
}

// ==========================================
// CATÁLOGO, BÚSQUEDA Y FILTROS
// ==========================================
async function cargarCatalogo() {
  const grilla = document.getElementById('grilla-catalogo');
  const titulo = document.getElementById('catalogo-titulo');
  grilla.innerHTML = '<p>Cargando catálogo...</p>';

  let url = `${API_BASE}/libros`;
  if (vistaActualCatalogo === 'ofertas') {
    url = `${API_BASE}/libros/ofertas`;
    titulo.textContent = '🔥 Ofertas y Descuentos Vigentes';
  } else if (vistaActualCatalogo === 'novedades') {
    url = `${API_BASE}/libros/novedades`;
    titulo.textContent = '✨ Novedades (Últimos Ingresos)';
  } else {
    titulo.textContent = 'Catálogo de Libros';
  }

  // Verificar si el cliente tiene deuda para mostrar alerta arriba
  if (usuario && usuario.rol === 'cliente') {
    verificarDeudaCliente();
  }

  try {
    const res = await fetch(url);
    librosMemoria = await res.json();
    poblarSelectsFiltros(librosMemoria);
    filtrarCatalogo();
  } catch (e) {
    grilla.innerHTML = '<p class="alert alert-error">Error al cargar libros.</p>';
  }
}

async function verificarDeudaCliente() {
  const alerta = document.getElementById('bloque-deuda-alerta');
  try {
    const res = await apiFetch('/deudas/mias');
    if (res.ok) {
      const deudas = await res.json();
      const pendientes = deudas.filter(d => d.estado === 'pendiente');
      if (pendientes.length > 0) {
        const total = pendientes.reduce((acc, d) => acc + d.monto, 0);
        alerta.innerHTML = `⚠️ <strong>Atención:</strong> Tenés una deuda pendiente de <strong>$${total}</strong> por reservas no retiradas. No podés realizar nuevas reservas hasta cancelarla en el local en efectivo.`;
        alerta.classList.remove('hidden');
        return;
      }
    }
  } catch {}
  alerta.classList.add('hidden');
}

function poblarSelectsFiltros(libros) {
  if (!Array.isArray(libros)) return;
  const selectGen = document.getElementById('filtro-genero');
  const selectEdit = document.getElementById('filtro-editorial');
  if (!selectGen || !selectEdit) return;

  const generos = [...new Set(libros.map(l => l.genero).filter(Boolean))].sort();
  const editoriales = [...new Set(libros.map(l => l.editorial).filter(Boolean))].sort();

  selectGen.innerHTML = '<option value="">Todos los géneros</option>' + generos.map(g => `<option value="${g}">${g}</option>`).join('');
  selectEdit.innerHTML = '<option value="">Todas las editoriales</option>' + editoriales.map(e => `<option value="${e}">${e}</option>`).join('');
}

function filtrarCatalogo() {
  if (!Array.isArray(librosMemoria)) return;
  const q = (document.getElementById('filtro-buscar')?.value || '').toLowerCase().trim();
  const genero = document.getElementById('filtro-genero')?.value || '';
  const editorial = document.getElementById('filtro-editorial')?.value || '';
  const disp = document.getElementById('filtro-disponibilidad')?.value || '';

  const filtrados = librosMemoria.filter(libro => {
    const textoMatch = !q ||
      (libro.titulo && libro.titulo.toLowerCase().includes(q)) ||
      (libro.serie && libro.serie.toLowerCase().includes(q)) ||
      (libro.autor && libro.autor.toLowerCase().includes(q));

    const genMatch = !genero || libro.genero === genero;
    const editMatch = !editorial || libro.editorial === editorial;

    let dispMatch = true;
    if (disp === 'disponibles') dispMatch = libro.cantidad_disponible > 0;
    if (disp === 'agotados') dispMatch = libro.cantidad_disponible === 0;

    return textoMatch && genMatch && editMatch && dispMatch;
  });

  renderizarLibros(filtrados);
}

function renderizarLibros(libros) {
  const grilla = document.getElementById('grilla-catalogo');
  if (libros.length === 0) {
    grilla.innerHTML = '<p style="grid-column: 1/-1; color:#666;">No se encontraron libros con los filtros seleccionados.</p>';
    return;
  }

  // C-02: Todos los datos del servidor se escapan con esc() antes de insertar en innerHTML
  grilla.innerHTML = libros.map(libro => {
    const disponible = libro.cantidad_disponible > 0;
    const tieneDescuento = libro.precio_vigente && libro.precio_vigente < libro.precio;
    const precioFinal = libro.precio_vigente || libro.precio;
    const portada = urlSegura(libro.portada_url); // M-05: solo URLs http/https

    let botonHtml = '';
    if (!usuario) {
      botonHtml = `<button class="btn btn-sm" onclick="navegar('login')">Inicie sesión para reservar</button>`;
    } else if (usuario.rol === 'cliente') {
      if (disponible) {
        botonHtml = `<button class="btn btn-success btn-sm" onclick="reservarLibro(${Number(libro.id)})">Reservar (24 hs)</button>`;
      } else {
        botonHtml = `<button class="btn btn-sm" disabled>Agotado</button>`;
      }
    } else {
      botonHtml = `<span style="font-size:0.8rem; color:#666;">(Sesión de personal)</span>`;
    }

    return `
      <div class="libro-card">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.6rem;">
            <span class="badge ${libro.clasificacion_edad === '+18' ? 'badge-18' : 'badge-atp'}">${esc(libro.clasificacion_edad) || 'ATP'}</span>
            <div style="display:flex; gap:0.3rem;">
              ${tieneDescuento ? '<span class="badge badge-oferta">OFERTA</span>' : ''}
              ${libro.es_novedad ? '<span class="badge badge-novedad">NUEVO</span>' : ''}
            </div>
          </div>
          ${portada ? `<div style="margin-bottom:0.8rem; overflow:hidden; border-radius:8px; max-height:150px; background:rgba(11,13,25,0.7); text-align:center; border:1px solid rgba(255,255,255,0.06);"><img src="${portada}" alt="${esc(libro.titulo)}" style="max-height:150px; width:auto; max-width:100%; object-fit:cover;" onerror="this.parentElement.style.display='none'"></div>` : ''}
          <h3>${esc(libro.titulo)}</h3>
          <div class="libro-meta">
            <div><strong>Serie:</strong> <em>${esc(libro.serie || 'Tomo Único')}</em> (Tomo ${Number(libro.numero_tomo)})</div>
            <div><strong>Autor:</strong> <em>${esc(libro.autor)}</em></div>
            <div><strong>Editorial:</strong> <em>${esc(libro.editorial)}</em></div>
            <div><strong>Género:</strong> <em>${esc(libro.genero)}</em></div>
          </div>
        </div>
        <div>
          <div class="precio-box">
            ${tieneDescuento ? `<span class="precio-original">$${Number(libro.precio)}</span>` : ''}
            <span class="precio-vigente">$${Number(precioFinal)}</span>
          </div>
          <div class="disponibilidad ${disponible ? 'disponible' : 'agotado'}">
            ${disponible ? `✔ Disponibles: ${Number(libro.cantidad_disponible)}` : '✖ Agotado'}
          </div>
          <div>${botonHtml}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// RESERVAS Y MIS RESERVAS (CLIENTE)
// ==========================================
async function reservarLibro(libroId) {
  try {
    const res = await apiFetch('/reservas', {
      method: 'POST',
      body: { libro_id: libroId }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'No se pudo crear la reserva', 'error');
      return;
    }

    mostrarMensaje(`¡Reserva creada exitosamente! Código: ${data.codigo}. Vence en 24 horas.`, 'success');
    cargarCatalogo();
  } catch (e) {
    if (e.message !== 'Sesión expirada') {
      mostrarMensaje('Error al crear la reserva: ' + e.message, 'error');
    }
  }
}

async function cargarMisReservas() {
  const cont = document.getElementById('lista-reservas');
  const deudaBox = document.getElementById('deuda-cliente-box');
  cont.innerHTML = '<p>Cargando tus reservas...</p>';

  // Cargar deudas pendientes del cliente
  try {
    const resDeuda = await apiFetch('/deudas/mias');
    if (resDeuda.ok) {
      const deudas = await resDeuda.json();
      const pendientes = deudas.filter(d => d.estado === 'pendiente');
      if (pendientes.length > 0) {
        const total = pendientes.reduce((acc, d) => acc + d.monto, 0);
        deudaBox.innerHTML = `⚠️ Tenés deudas pendientes por un total de <strong>$${total}</strong>. Debés abonarlas en efectivo en el local antes de realizar nuevas reservas.`;
        deudaBox.classList.remove('hidden');
      } else {
        deudaBox.classList.add('hidden');
      }
    }
  } catch {}

  try {
    const res = await apiFetch('/reservas/mias');
    if (!res.ok) throw new Error('Error al obtener reservas');
    const reservas = await res.json();

    if (reservas.length === 0) {
      cont.innerHTML = '<p>No tenés reservas activas en este momento.</p>';
      return;
    }

    cont.innerHTML = `
      <p style="font-size:0.85rem; color:#666; margin-bottom:1rem;">Podés retirar tus reservas en el local con tu código o tu documento abonando en efectivo (precio fijado + 5% de recargo).</p>
      <div style="display:flex; flex-direction:column; gap:1rem;">
        ${reservas.map(r => `
          <div class="card" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; border-left: 4px solid #e94560;">
            <div>
              <h3>${esc(r.titulo)}</h3>
              <div style="font-size:0.9rem; color:#555;">
                <div>Código de retiro: <strong style="color:#1a1a2e; font-size:1.05rem;">${esc(r.codigo)}</strong></div>
                <div>Precio fijado: <strong>$${Number(r.precio_fijado)}</strong> (+ 5% en caja: <strong>$${Math.round(r.precio_fijado * 1.05)}</strong>)</div>
                <div>Vencimiento: ${new Date(r.fecha_vencimiento).toLocaleString()}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div class="reserva-timer" data-segundos="${Number(r.segundos_restantes)}" style="font-size:1.1rem; font-weight:bold; color:#e94560; margin-bottom:0.5rem;">
                ${formatearTiempoRestante(r.segundos_restantes)}
              </div>
              <button class="btn btn-danger btn-sm" onclick="cancelarMiReserva(${Number(r.id)})">Cancelar Reserva</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    iniciarTemporizadores();
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al cargar reservas: ' + e.message + '</p>';
  }
}

function formatearTiempoRestante(segundos) {
  if (segundos <= 0) return 'Vencida';
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = segundos % 60;
  return `⏱ Faltan ${horas}h ${minutos}m ${segs}s`;
}

function iniciarTemporizadores() {
  if (timerContador) clearInterval(timerContador);
  timerContador = setInterval(() => {
    document.querySelectorAll('.reserva-timer').forEach(el => {
      let s = parseInt(el.getAttribute('data-segundos'), 10);
      if (s > 0) {
        s--;
        el.setAttribute('data-segundos', s);
        el.textContent = formatearTiempoRestante(s);
      } else {
        el.textContent = 'Vencida';
      }
    });
  }, 1000);
}

async function cancelarMiReserva(id) {
  if (!confirm('¿Seguro que deseás cancelar esta reserva? El libro será liberado de inmediato sin costo.')) return;
  try {
    const res = await apiFetch(`/reservas/${id}/cancelar`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al cancelar la reserva', 'error');
      return;
    }
    mostrarMensaje('Reserva cancelada correctamente', 'success');
    cargarMisReservas();
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

// ==========================================
// PANEL DE EMPLEADO
// ==========================================
function verSubSeccionEmpleado(sub) {
  ['cuentas', 'retiros', 'deudas', 'cantidad', 'documentos'].forEach(s => {
    document.getElementById(`emp-sub-${s}`).classList.add('hidden');
    document.getElementById(`btn-emp-${s}`).classList.remove('active');
  });
  document.getElementById(`emp-sub-${sub}`).classList.remove('hidden');
  document.getElementById(`btn-emp-${sub}`).classList.add('active');
}

async function cargarDatosEmpleado() {
  // Cargar combo de libros para actualizar stock
  const select = document.getElementById('emp-stock-libro');
  try {
    const res = await apiFetch('/libros');
    const libros = await res.json();
    select.innerHTML = libros.map(l => `<option value="${l.id}">${l.titulo} (Copias actuales: ${l.cantidad_total})</option>`).join('');
  } catch {}
}

async function empleadoCrearCuenta() {
  const nombre = document.getElementById('emp-cli-nombre').value.trim();
  const apellido = document.getElementById('emp-cli-apellido').value.trim();
  const documento = document.getElementById('emp-cli-doc').value.trim();
  const correo = document.getElementById('emp-cli-correo').value.trim();
  const telefono = document.getElementById('emp-cli-tel').value.trim();
  const fecha_nacimiento = document.getElementById('emp-cli-fnac').value;
  const contrasena = document.getElementById('emp-cli-pass').value;
  const adulto_responsable = document.getElementById('emp-cli-adulto').checked;

  try {
    const res = await apiFetch('/usuarios', {
      method: 'POST',
      body: { nombre, apellido, documento, correo, telefono, fecha_nacimiento, contrasena, adulto_responsable }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al crear la cuenta', 'error');
      return;
    }
    mostrarMensaje(`Cuenta creada con éxito para ${data.nombre} ${data.apellido} (Doc: ${data.documento})`, 'success');
    // Limpiar formulario
    ['emp-cli-nombre', 'emp-cli-apellido', 'emp-cli-doc', 'emp-cli-correo', 'emp-cli-tel', 'emp-cli-fnac', 'emp-cli-pass'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('emp-cli-adulto').checked = false;
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function empleadoRestablecerContrasena() {
  const idODoc = document.getElementById('emp-rest-doc').value.trim();
  const nuevaContrasena = document.getElementById('emp-rest-pass').value;
  if (!idODoc || !nuevaContrasena) {
    mostrarMensaje('Ingresá el usuario y la nueva contraseña', 'error');
    return;
  }

  try {
    const res = await apiFetch(`/usuarios/${idODoc}/contrasena`, {
      method: 'POST',
      body: { nueva_contrasena: nuevaContrasena }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al restablecer contraseña', 'error');
      return;
    }
    mostrarMensaje('Contraseña restablecida correctamente', 'success');
    document.getElementById('emp-rest-doc').value = '';
    document.getElementById('emp-rest-pass').value = '';
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function empleadoBuscarReserva() {
  const q = document.getElementById('emp-retiro-busqueda').value.trim();
  const salida = document.getElementById('emp-resultado-busqueda');
  if (!q) {
    mostrarMensaje('Ingresá un código o documento', 'error');
    return;
  }

  salida.innerHTML = '<p>Buscando...</p>';
  try {
    const endpoint = q.startsWith('RES-') ? `/reservas/buscar?codigo=${encodeURIComponent(q)}` : `/reservas/buscar-por-documento?documento=${encodeURIComponent(q)}`;
    const res = await apiFetch(endpoint);
    const data = await res.json();
    if (!res.ok) {
      salida.innerHTML = `<p class="alert alert-error">${data.error || 'No se encontró la reserva'}</p>`;
      return;
    }

    const items = Array.isArray(data) ? data : [data];
    if (items.length === 0) {
      salida.innerHTML = '<p class="alert alert-info">No se encontraron reservas activas para ese documento.</p>';
      return;
    }

    salida.innerHTML = items.map(r => `
      <div class="card" style="border-left: 4px solid #28a745; margin-bottom:1rem;">
        <h3>Reserva ${esc(r.codigo)} - ${esc(r.titulo)}</h3>
        <p><strong>Cliente:</strong> ${esc(r.nombre)} ${esc(r.apellido)} (Doc: ${esc(r.documento)})</p>
        <p><strong>Precio fijado:</strong> $${Number(r.precio_fijado)}</p>
        <p><strong>Total con recargo del 5% a cobrar en efectivo:</strong> <span style="font-size:1.2rem; color:#28a745; font-weight:bold;">$${Math.round(r.precio_fijado * 1.05)}</span></p>
        <p><strong>Estado:</strong> ${esc(r.estado)}</p>
        <button class="btn btn-success" style="margin-top:0.6rem;" onclick="empleadoCobrarYRetirar(${Number(r.id)})">Cobrar en Efectivo y Marcar Retirada</button>
      </div>
    `).join('');
  } catch (e) {
    salida.innerHTML = `<p class="alert alert-error">Error al buscar: ${e.message}</p>`;
  }
}

async function empleadoCobrarYRetirar(reservaId) {
  try {
    const res = await apiFetch(`/reservas/${reservaId}/retirar`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al retirar reserva', 'error');
      return;
    }
    mostrarMensaje(`¡Retiro registrado! Total cobrado en efectivo: $${data.total}`, 'success');
    empleadoBuscarReserva();
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function empleadoCobrarDeuda() {
  const deudaId = document.getElementById('emp-deuda-id').value.trim();
  if (!deudaId) {
    mostrarMensaje('Ingresá el ID de la deuda', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/deudas/${deudaId}/pago`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al registrar cobro de deuda', 'error');
      return;
    }
    mostrarMensaje(`Pago de deuda #${data.id} por $${data.monto} registrado exitosamente`, 'success');
    document.getElementById('emp-deuda-id').value = '';
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function empleadoActualizarStock() {
  const libroId = document.getElementById('emp-stock-libro').value;
  const cant = document.getElementById('emp-stock-cant').value;
  if (!cant || isNaN(cant)) {
    mostrarMensaje('Ingresá una cantidad válida', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/libros/${libroId}/cantidad`, {
      method: 'PATCH',
      body: { cantidad: Number(cant) }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al actualizar cantidad', 'error');
      return;
    }
    mostrarMensaje(`Cantidad actualizada a ${data.cantidad_total} copias para "${data.titulo}"`, 'success');
    cargarDatosEmpleado();
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function empleadoInformarDocumento() {
  const usuarioId = document.getElementById('emp-doc-usuario').value.trim();
  if (!usuarioId) {
    mostrarMensaje('Ingresá el ID o documento del usuario', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/usuarios/${usuarioId}/informe-documento`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al informar documento', 'error');
      return;
    }
    mostrarMensaje('Documento ajeno informado y asentado en el registro de actividad', 'success');
    document.getElementById('emp-doc-usuario').value = '';
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

// ==========================================
// PANEL DE ADMINISTRADOR
// ==========================================
function verSubSeccionAdmin(sub) {
  ['libros', 'precios', 'avisos', 'deudas', 'cuentas', 'actividad'].forEach(s => {
    document.getElementById(`adm-sub-${s}`).classList.add('hidden');
    document.getElementById(`btn-adm-${s}`).classList.remove('active');
  });
  document.getElementById(`adm-sub-${sub}`).classList.remove('hidden');
  document.getElementById(`btn-adm-${sub}`).classList.add('active');

  if (sub === 'libros') adminListarLibros();
  if (sub === 'actividad') adminCargarActividad();
}

async function cargarDatosAdmin() {
  adminListarLibros();
}

async function adminCrearLibro() {
  const titulo = document.getElementById('adm-lib-titulo').value.trim();
  const serie = document.getElementById('adm-lib-serie').value.trim();
  const numero_tomo = Number(document.getElementById('adm-lib-tomo').value);
  const autor = document.getElementById('adm-lib-autor').value.trim();
  const editorial = document.getElementById('adm-lib-editorial').value.trim();
  const idioma = document.getElementById('adm-lib-idioma').value.trim();
  const genero = document.getElementById('adm-lib-genero').value.trim();
  const clasificacion_edad = document.getElementById('adm-lib-edad').value;
  const precio = Number(document.getElementById('adm-lib-precio').value);
  const cantidad_total = Number(document.getElementById('adm-lib-cantidad').value);
  const portada_url = document.getElementById('adm-lib-portada').value.trim();
  const sinopsis = document.getElementById('adm-lib-sinopsis').value.trim();

  try {
    const res = await apiFetch('/libros', {
      method: 'POST',
      body: { titulo, serie, numero_tomo, autor, editorial, idioma, genero, clasificacion_edad, precio, cantidad_total, portada_url, sinopsis }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al cargar el libro', 'error');
      return;
    }
    mostrarMensaje(`Libro "${data.titulo}" creado exitosamente`, 'success');
    adminListarLibros();
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminListarLibros() {
  const cont = document.getElementById('adm-tabla-libros');
  try {
    const res = await apiFetch('/libros');
    const libros = await res.json();
    cont.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>Serie</th>
            <th>Precio</th>
            <th>Copias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${libros.map(l => `
            <tr>
              <td>${Number(l.id)}</td>
              <td>${esc(l.titulo)}</td>
              <td>${esc(l.serie || '-')}</td>
              <td>$${Number(l.precio)}</td>
              <td>${Number(l.cantidad_total)}</td>
              <td>
                <button class="btn btn-sm ${l.oculto ? 'btn-success' : 'btn-danger'}" onclick="adminToggleOcultarLibro(${Number(l.id)}, ${l.oculto ? 0 : 1})">
                  ${l.oculto ? 'Mostrar' : 'Ocultar'}
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al listar libros</p>';
  }
}

async function adminToggleOcultarLibro(id, nuevoEstado) {
  try {
    const res = await apiFetch(`/libros/${id}/ocultar`, {
      method: 'PATCH',
      body: { ocultar: nuevoEstado === 1 }
    });
    if (res.ok) {
      mostrarMensaje('Visibilidad de libro actualizada', 'success');
      adminListarLibros();
    }
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminCrearDescuento() {
  const tipo = document.getElementById('adm-desc-tipo').value;
  const porcentaje = Number(document.getElementById('adm-desc-porcentaje').value);
  const alcance = document.getElementById('adm-desc-alcance').value;
  const referencia_id = document.getElementById('adm-desc-ref').value.trim() || undefined;
  const fecha_inicio = document.getElementById('adm-desc-inicio').value;
  const fecha_fin = document.getElementById('adm-desc-fin').value;

  if (porcentaje < 10 || porcentaje > 50) {
    mostrarMensaje('El porcentaje debe estar comprendido entre el 10% y el 50% ([RN-43])', 'error');
    return;
  }

  try {
    const res = await apiFetch('/descuentos', {
      method: 'POST',
      body: { tipo, porcentaje, alcance, referencia_id, fecha_inicio, fecha_fin }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al crear descuento/aumento', 'error');
      return;
    }
    mostrarMensaje(`Regla de precio (${tipo} del ${porcentaje}%) creada con éxito`, 'success');
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminPublicarAviso() {
  const titulo = document.getElementById('adm-aviso-titulo').value.trim();
  const texto = document.getElementById('adm-aviso-texto').value.trim();
  if (!titulo || !texto) {
    mostrarMensaje('Completá título y texto del aviso', 'error');
    return;
  }
  try {
    const res = await apiFetch('/avisos', {
      method: 'POST',
      body: { titulo, texto }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al publicar aviso', 'error');
      return;
    }
    mostrarMensaje(`Aviso "${data.titulo}" publicado con éxito (visible por 7 días)`, 'success');
    document.getElementById('adm-aviso-titulo').value = '';
    document.getElementById('adm-aviso-texto').value = '';
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminRegistrarCierre() {
  const fecha = document.getElementById('adm-cierre-fecha').value;
  if (!fecha) {
    mostrarMensaje('Ingresá una fecha válida (YYYY-MM-DD)', 'error');
    return;
  }
  try {
    const res = await apiFetch('/cierres', {
      method: 'POST',
      body: { fecha }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al registrar cierre', 'error');
      return;
    }
    mostrarMensaje(`Cierre registrado para el día ${data.fecha}. Se extendieron 24h a ${data.reservasAfectadas} reservas activas.`, 'success');
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminPerdonarDeuda() {
  const id = document.getElementById('adm-deuda-id').value.trim();
  const motivo = document.getElementById('adm-deuda-motivo').value.trim();
  if (!id || !motivo) {
    mostrarMensaje('ID de deuda y motivo obligatorio son requeridos ([RN-31])', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/deudas/${id}/perdon`, {
      method: 'POST',
      body: { motivo }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al perdonar deuda', 'error');
      return;
    }
    mostrarMensaje(`Deuda #${data.id} perdonada y asentada en el historial`, 'success');
    document.getElementById('adm-deuda-id').value = '';
    document.getElementById('adm-deuda-motivo').value = '';
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminBanear() {
  const usuarioId = document.getElementById('adm-baneo-id').value.trim();
  const motivo = document.getElementById('adm-baneo-motivo').value.trim();
  if (!usuarioId || !motivo) {
    mostrarMensaje('Ingresá el usuario y el motivo obligatorio del baneo', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/usuarios/${usuarioId}/baneo`, {
      method: 'POST',
      body: { motivo }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al banear cuenta', 'error');
      return;
    }
    mostrarMensaje('Cuenta baneada. Sus reservas activas han sido canceladas sin deuda.', 'success');
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminRevertirBaneo() {
  const usuarioId = document.getElementById('adm-baneo-id').value.trim();
  if (!usuarioId) {
    mostrarMensaje('Ingresá el ID de usuario para revertir baneo', 'error');
    return;
  }
  try {
    const res = await apiFetch(`/usuarios/${usuarioId}/baneo`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al revertir baneo', 'error');
      return;
    }
    mostrarMensaje('Baneo revertido exitosamente. El usuario puede volver a reservar.', 'success');
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminCrearPersonal() {
  const rol = document.getElementById('adm-pers-rol').value;
  const documento = document.getElementById('adm-pers-doc').value.trim();
  const nombre = document.getElementById('adm-pers-nombre').value.trim();
  const apellido = document.getElementById('adm-pers-apellido').value.trim();
  const correo = document.getElementById('adm-pers-correo').value.trim();
  const telefono = document.getElementById('adm-pers-tel').value.trim();
  const fecha_nacimiento = document.getElementById('adm-pers-fnac').value;
  const contrasena = document.getElementById('adm-pers-pass').value;

  try {
    const res = await apiFetch('/empleados', {
      method: 'POST',
      body: { rol, documento, nombre, apellido, correo, telefono, fecha_nacimiento, contrasena }
    });
    const data = await res.json();
    if (!res.ok) {
      mostrarMensaje(data.error || 'Error al crear personal', 'error');
      return;
    }
    mostrarMensaje(`¡${rol.toUpperCase()} creado con éxito! (${data.nombre} ${data.apellido})`, 'success');
    ['adm-pers-doc', 'adm-pers-nombre', 'adm-pers-apellido', 'adm-pers-correo', 'adm-pers-tel', 'adm-pers-fnac', 'adm-pers-pass'].forEach(id => {
      document.getElementById(id).value = '';
    });
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

async function adminCargarActividad() {
  const cont = document.getElementById('adm-tabla-actividad');
  cont.innerHTML = '<p>Cargando registros...</p>';
  try {
    const res = await apiFetch('/registro-actividad');
    const logs = await res.json();
    if (!res.ok) throw new Error(logs.error || 'Error al obtener registros');

    cont.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td style="white-space:nowrap; font-size:0.8rem;">${new Date(l.fecha).toLocaleString()}</td>
              <td>${esc(l.usuario_nombre || 'Sistema')} (${esc(l.usuario_rol || '-')})</td>
              <td><code>${esc(l.accion)}</code></td>
              <td>${esc(l.detalle)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al cargar actividad: ' + e.message + '</p>';
  }
}

async function adminPurgarActividad() {
  if (!confirm('¿Deseás purgar los registros de actividad con más de 30 días de antigüedad? Los registros de historial_cuenta permanecerán intactos.')) return;
  try {
    const res = await apiFetch('/jobs/limpiar-actividad', { method: 'POST' });
    const data = await res.json();
    mostrarMensaje(`Se eliminaron ${data.eliminados} registros de más de 30 días`, 'info');
    adminCargarActividad();
  } catch (e) {
    mostrarMensaje(e.message, 'error');
  }
}

// ==========================================
// AVISOS, CONTACTO Y POLÍTICAS
// ==========================================
async function cargarAvisos() {
  const cont = document.getElementById('lista-avisos');
  cont.innerHTML = '<p>Cargando avisos...</p>';
  try {
    const res = await fetch(`${API_BASE}/avisos`);
    const avisos = await res.json();
    if (avisos.length === 0) {
      cont.innerHTML = '<p>No hay avisos recientes en este momento.</p>';
      return;
    }
    cont.innerHTML = avisos.map(a => `
      <div class="card" style="border-left: 4px solid #1a1a2e; margin-bottom:1rem;">
        <h3>${a.titulo}</h3>
        <p style="font-size:0.8rem; color:#888; margin-bottom:0.5rem;">Publicado el ${new Date(a.fecha_publicacion).toLocaleString()} (visible por 7 días)</p>
        <p>${a.texto}</p>
      </div>
    `).join('');
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al cargar avisos.</p>';
  }
}

async function cargarContacto() {
  const cont = document.getElementById('info-contacto');
  try {
    const res = await fetch(`${API_BASE}/contacto`);
    const data = await res.json();
    cont.innerHTML = `
      <div style="font-size:1rem; line-height:1.8;">
        <p>📍 <strong>Dirección:</strong> ${data.direccion || 'Av. Corrientes 1234, CABA'}</p>
        <p>📞 <strong>Teléfono:</strong> ${data.telefono || '011-4321-5678'}</p>
        <p>✉️ <strong>Correo de contacto:</strong> ${data.correo || 'contacto@comiqueria.com'}</p>
        <p>🕒 <strong>Horario de atención:</strong> ${data.horario || 'Lunes a Viernes de 10:00 a 13:00 y 14:00 a 19:00. Sábados y Domingos de 11:00 a 18:00.'}</p>
      </div>
    `;
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al cargar contacto.</p>';
  }
}

async function cargarPoliticas() {
  const cont = document.getElementById('info-politicas');
  try {
    const res = await fetch(`${API_BASE}/politicas`);
    const data = await res.json();
    cont.innerHTML = `
      <div style="font-size:0.95rem; line-height:1.7;">
        <p><strong>1. Modalidad de Pago:</strong> ${data.pago || 'Únicamente en efectivo y en persona en la sucursal. No disponemos de medios de pago online ni tarjetas de crédito/débito.'}</p>
        <p><strong>2. Plazo de Reserva:</strong> ${data.plazo || 'Las reservas tienen una duración estricta de 24 horas corridas desde su generación en el servidor.'}</p>
        <p><strong>3. Recargo por Retiro:</strong> ${data.recargo || 'Al momento de retirar en caja, se adiciona un recargo del 5% en efectivo sobre el precio pactado.'}</p>
        <p><strong>4. Deudas por Ausencia:</strong> ${data.deudas || 'Si una reserva no se retira dentro del plazo de 24 horas, vence automáticamente y se genera una deuda por el valor del 5% del libro fijado al reservar. Mientras exista una deuda pendiente, no es posible generar nuevas reservas.'}</p>
        <p><strong>5. Cancelaciones:</strong> Las reservas pueden cancelarse sin cargo antes de vencer, con un límite de hasta 5 cancelaciones por mes calendario.</p>
      </div>
    `;
  } catch (e) {
    cont.innerHTML = '<p class="alert alert-error">Error al cargar políticas.</p>';
  }
}

// ==========================================
// INICIALIZACIÓN
// ==========================================
(function init() {
  actualizarEstadoSesion();
  navegar('catalogo');
})();
