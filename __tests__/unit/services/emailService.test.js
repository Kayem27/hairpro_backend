// Test emailService in fallback mode (no Brevo API key)
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv, APP_URL: 'http://localhost:5173' };
  delete process.env.BREVO_API_KEY;
});

afterAll(() => {
  process.env = originalEnv;
});

describe('emailService (mode simulé)', () => {
  test('sendEmail devrait retourner success en mode simulé', async () => {
    const { sendEmail } = require('../../../services/emailService');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>'
    });

    expect(result).toEqual({ success: true, simulated: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Email simulé]')
    );
    consoleSpy.mockRestore();
  });

  test('sendPasswordResetEmail devrait appeler sendEmail', async () => {
    const { sendPasswordResetEmail } = require('../../../services/emailService');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await sendPasswordResetEmail('test@example.com', 'reset-token-123');

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    consoleSpy.mockRestore();
  });

  test('sendVerificationEmail devrait appeler sendEmail', async () => {
    const { sendVerificationEmail } = require('../../../services/emailService');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await sendVerificationEmail('test@example.com', 'verify-token-456');

    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    consoleSpy.mockRestore();
  });

  test('sendAppointmentNotification devrait gérer tous les types', async () => {
    const { sendAppointmentNotification } = require('../../../services/emailService');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const types = ['new', 'accepted', 'rejected', 'cancelled'];
    for (const type of types) {
      const result = await sendAppointmentNotification('test@example.com', type, {
        date: '2026-04-15',
        slot: '09:00 - 10:00',
        notes: 'Test note'
      });
      expect(result.success).toBe(true);
    }

    consoleSpy.mockRestore();
  });

  test('sendAppointmentNotification devrait fonctionner sans notes', async () => {
    const { sendAppointmentNotification } = require('../../../services/emailService');
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    const result = await sendAppointmentNotification('test@example.com', 'new', {
      date: '2026-04-15',
      slot: '09:00 - 10:00'
    });

    expect(result.success).toBe(true);
    consoleSpy.mockRestore();
  });
});
