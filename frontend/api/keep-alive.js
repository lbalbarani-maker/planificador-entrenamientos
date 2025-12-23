// frontend/api/keep-alive.js
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // Usa las variables que YA tienes en Vercel
    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan variables de entorno REACT_APP_SUPABASE_URL o REACT_APP_SUPABASE_ANON_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Consulta SUPER ligera a la tabla users (siempre existe)
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('Advertencia en keep-alive:', error.message);
      // Continuamos aunque haya error - el ping ya sirvió
    }

    console.log(`✅ Keep-alive ejecutado: ${new Date().toISOString()}`);
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Supabase keep-alive ejecutado',
      note: 'Consulta realizada 1 vez al día para evitar pausa automática'
    });
  } catch (error) {
    console.error('❌ Error en keep-alive:', error.message);
    res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};