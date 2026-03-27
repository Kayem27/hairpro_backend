jest.mock('../../../models/Notification', () => {
  return {
    create: jest.fn()
  };
});

const Notification = require('../../../models/Notification');
const { setIO, getIO, createNotification } = require('../../../services/notificationService');

describe('notificationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    setIO(null);
  });

  describe('setIO / getIO', () => {
    test('devrait stocker et retourner l\'instance socket.io', () => {
      expect(getIO()).toBeNull();
      const mockIO = { to: jest.fn() };
      setIO(mockIO);
      expect(getIO()).toBe(mockIO);
    });
  });

  describe('createNotification', () => {
    test('devrait créer une notification en base', async () => {
      const mockNotification = {
        notification_id: 'notif-001',
        user_id: 'user-001',
        type: 'appointment_new',
        title: 'Nouveau RDV',
        message: 'Test message',
        link: '/dashboard',
        toObject: function () { return { ...this }; }
      };
      delete mockNotification.toObject;
      Notification.create.mockResolvedValue({
        ...mockNotification,
        toObject() { return mockNotification; }
      });

      const result = await createNotification({
        user_id: 'user-001',
        type: 'appointment_new',
        title: 'Nouveau RDV',
        message: 'Test message',
        link: '/dashboard'
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-001',
          type: 'appointment_new',
          title: 'Nouveau RDV',
          message: 'Test message',
          link: '/dashboard'
        })
      );
    });

    test('devrait émettre via socket.io si disponible', async () => {
      const emitMock = jest.fn();
      const toMock = jest.fn().mockReturnValue({ emit: emitMock });
      setIO({ to: toMock });

      const mockNotif = {
        notification_id: 'notif-002',
        user_id: 'user-001',
        toObject() { return { notification_id: 'notif-002' }; }
      };
      Notification.create.mockResolvedValue(mockNotif);

      await createNotification({
        user_id: 'user-001',
        type: 'new_message',
        title: 'Nouveau message',
        message: 'Vous avez un message'
      });

      expect(toMock).toHaveBeenCalledWith('user:user-001');
      expect(emitMock).toHaveBeenCalledWith('notification', { notification_id: 'notif-002' });
    });

    test('ne devrait pas émettre si socket.io n\'est pas configuré', async () => {
      const mockNotif = {
        notification_id: 'notif-003',
        toObject() { return {}; }
      };
      Notification.create.mockResolvedValue(mockNotif);

      await createNotification({
        user_id: 'user-001',
        type: 'new_review',
        title: 'Nouvel avis',
        message: 'Test'
      });

      // No error, just no socket emission
      expect(getIO()).toBeNull();
    });

    test('devrait générer un notification_id unique', async () => {
      Notification.create.mockResolvedValue({
        toObject() { return {}; }
      });

      await createNotification({
        user_id: 'user-001',
        type: 'appointment_new',
        title: 'Test',
        message: 'Test'
      });

      const call = Notification.create.mock.calls[0][0];
      expect(call.notification_id).toBeDefined();
      expect(typeof call.notification_id).toBe('string');
      expect(call.notification_id.length).toBeGreaterThan(0);
    });

    test('devrait utiliser un lien vide par défaut', async () => {
      Notification.create.mockResolvedValue({
        toObject() { return {}; }
      });

      await createNotification({
        user_id: 'user-001',
        type: 'appointment_new',
        title: 'Test',
        message: 'Test'
      });

      const call = Notification.create.mock.calls[0][0];
      expect(call.link).toBe('');
    });
  });
});
