let brevo = null;

try {
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY !== 'xsmtpsib-placeholder') {
    const { BrevoClient } = require('@getbrevo/brevo');
    brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
  }
} catch (e) {
  console.log('Brevo non configuré, emails désactivés');
}

const sendEmail = async ({ to, subject, html }) => {
  if (!brevo) {
    console.log(`[Email simulé] To: ${to}, Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const data = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'HairPro', email: 'noreply@hairpro.sbs' },
      to: [{ email: to }],
      subject,
      htmlContent: html
    });
    return { success: true, data };
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return { success: false, error };
  }
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.APP_URL}/forgot-password?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe - HairPro',
    html: `
      <h2>Réinitialisation de mot de passe</h2>
      <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
      <p><a href="${resetUrl}" style="background:#1a2e1a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans 1 heure.</p>
      <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    `
  });
};

const sendAppointmentNotification = async (email, type, details) => {
  const subjects = {
    new: 'Nouvelle demande de rendez-vous',
    accepted: 'Votre rendez-vous a été accepté',
    rejected: 'Votre rendez-vous a été refusé',
    cancelled: 'Un rendez-vous a été annulé'
  };

  return sendEmail({
    to: email,
    subject: `${subjects[type]} - HairPro`,
    html: `
      <h2>${subjects[type]}</h2>
      <p>Date : ${details.date}</p>
      <p>Créneau : ${details.slot}</p>
      ${details.notes ? `<p>Notes : ${details.notes}</p>` : ''}
      <p><a href="${process.env.APP_URL}/dashboard" style="background:#1a2e1a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Voir mes rendez-vous</a></p>
    `
  });
};

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
  return sendEmail({
    to: email,
    subject: 'Vérifiez votre adresse email - HairPro',
    html: `
      <h2>Bienvenue sur HairPro !</h2>
      <p>Merci de votre inscription. Veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous.</p>
      <p><a href="${verifyUrl}" style="background:#1a2e1a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;">Vérifier mon email</a></p>
      <p>Ce lien expire dans 24 heures.</p>
    `
  });
};

module.exports = { sendEmail, sendPasswordResetEmail, sendAppointmentNotification, sendVerificationEmail };
