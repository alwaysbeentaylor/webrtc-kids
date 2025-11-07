// Service Worker and Push Notification Service
class NotificationService {
  private static instance: NotificationService | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private serviceWorkerReady: boolean = false;

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
      this.serviceWorkerReady = true;
      console.log('✅ Service Worker ready');

      // Request notification permission (only if not already requested)
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log('📱 Notification permission:', permission);
        
        if (permission === 'granted') {
          // Subscribe to push notifications (for future server-side push)
          await this.subscribeToPush();
        } else {
          console.warn('⚠️ Notification permission denied');
        }
      } else {
        console.log('📱 Notification permission already:', Notification.permission);
        if (Notification.permission === 'granted') {
          await this.subscribeToPush();
        }
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
      console.warn('⚠️ Notification permission not granted:', permission);
      // Try to request permission if not yet requested
      if (permission === 'default') {
        const newPermission = await this.requestPermission();
        if (newPermission !== 'granted') {
          console.warn('⚠️ User denied notification permission');
          return;
        }
      } else {
        console.warn('⚠️ Notification permission denied by user');
        return;
      }
    }

    try {
      // Try to use service worker notification first (works when app is closed/background)
      if (this.registration && this.serviceWorkerReady) {
        // Send message to service worker to show notification
        // This works even when app is in background
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            options
          });
          console.log('📤 Message sent to service worker for notification');
        }
        
        // Also try direct service worker notification
        await this.registration.showNotification(title, {
          ...options,
          requireInteraction: true
        });
        console.log('✅ Notification shown via service worker');
      } else {
        // Fallback to regular notification (only works when app is open)
        const notification = new Notification(title, options);
        console.log('✅ Notification shown directly');
        
        // Auto-close after 5 seconds if not clicked
        setTimeout(() => {
          notification.close();
        }, 5000);
      }
    } catch (error) {
      console.error('❌ Error showing notification:', error);
      // Fallback to regular notification
      try {
        const notification = new Notification(title, options);
        setTimeout(() => notification.close(), 5000);
      } catch (fallbackError) {
        console.error('❌ Fallback notification also failed:', fallbackError);
      }
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

  isReady(): boolean {
    return this.serviceWorkerReady && Notification.permission === 'granted';
  }
}

export const notificationService = NotificationService.getInstance();

