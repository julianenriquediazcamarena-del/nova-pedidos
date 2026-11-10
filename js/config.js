// Conexión fija a la base del negocio en Supabase (opcional).
// Si se llena, nadie del equipo tiene que capturar la URL ni la clave: solo su correo y contraseña.
// La clave "anon" o "publishable" es pública por diseño; NUNCA pongas aquí la clave "service_role" o "secret".
window.NOVA_CONFIG = {
  supabaseUrl: 'https://karxefuuhocwavflicza.supabase.co',
  supabaseClave: 'sb_publishable_mV2HoMJaCu75H4n9Z3oh8Q_nQ1WcFGi', // clave pública (publishable): segura en el navegador con RLS
};
