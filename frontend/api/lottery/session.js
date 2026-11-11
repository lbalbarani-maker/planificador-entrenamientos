const {
  findAdminProfile,
  readJson,
  sendJson,
  signAdminToken,
} = require('../_lib/lotteryAdmin');

module.exports = async function handler(request, res) {
  if (request.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Método no permitido' });
    return;
  }

  try {
    const body = await readJson(request);
    const profile = await findAdminProfile(body.email, body.password, body.pin);

    if (!profile) {
      sendJson(res, 403, { error: 'Credenciales de administración no válidas' });
      return;
    }

    const { token, payload } = signAdminToken(profile);
    sendJson(res, 200, {
      token,
      expiresAt: payload.exp,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        clubId: profile.club_id,
      },
    });
  } catch (error) {
    console.error('[lottery/session]', error);
    sendJson(res, 500, { error: 'No se pudo iniciar la sesión de administración' });
  }
};
