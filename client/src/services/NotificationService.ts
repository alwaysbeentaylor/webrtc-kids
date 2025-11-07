// Service Worker and Push Notification Service
class NotificationService {
  private static instance: NotificationService | null = null;
  private registration: ServiceWorkerRegistration | null = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('✅ Service Worker registered:', this.registration.scope);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready');

      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('📱 Notification permission:', permission);

      if (permission === 'granted') {
        // Subscribe to push notifications
        await this.subscribeToPush();
      } else {
        console.warn('⚠️ Notification permission denied');
      }
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  }

  private async subscribeToPush(): Promise<void> {
    if (!this.registration) {
      console.warn('No service worker registration');
      return;
    }

    try {
      // Subscribe to push notifications
      // Note: For production, you'll need a push service (Firebase Cloud Messaging, etc.)
      // For now, we'll use the service worker to show notifications when app is closed
      await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: null // Will be set when implementing full push service
      });
      console.log('✅ Push subscription created');
    } catch (error) {
      console.error('❌ Error subscribing to push:', error);
      // Push subscription might fail if no push service is configured
      // This is OK - we can still use service worker notifications
    }
  }

  async showNotification(title: string, options: NotificationOptions): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return;
    }

    const permission = Notification.permission;
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      // Try to use service worker notification first (works when app is closed)
      if (this.registration) {
        await this.registration.showNotification(title, {
          ...options,
          requireInteraction: true
        });
        console.log('✅ Notification shown via service worker');
      } else {
        // Fallback to regular notification (only works when app is open)
        new Notification(title, options);
        console.log('✅ Notification shown directly');
      }
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }
}

export const notificationService = NotificationService.getInstance();

