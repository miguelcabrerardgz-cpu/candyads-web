-- Candy Ads · de dónde sale el color del formulario público de cada campaña (tema_color).
--   auto    = detectado del logo al subirlo, con contraste suficiente frente al texto blanco (>= 3:1)
--   manual  = elegido a mano en la ficha del panel
--   revisar = el color del logo no tenía contraste suficiente; se guardó el morado de Candy Ads (#8B7BC0)
--             y queda pendiente de que alguien elija uno a mano
-- NULL = campañas anteriores a esta columna (origen no registrado). No se publica: solo lo usa el panel.
alter table public.anunciantes_destino
  add column if not exists tema_color_origen text
    check (tema_color_origen in ('auto', 'manual', 'revisar'));
