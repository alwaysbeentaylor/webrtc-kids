import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { firebaseApp } from '../config/firebase';

// Service Worker and Push Notification Service
class NotificationService {
  private static instance: NotificationService | null = null;
  private registration: ServiceWorkerRegistration | null = null;
  private serviceWorkerReady: boolean = false;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private messaging: Messaging | null = null;
  private fcmToken: string | null = null;

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
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      });
      console.log('✅ Service Worker registered:', this.registration.scope);

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      this.serviceWorkerReady = true;
      console.log('✅ Service Worker ready');

      // Ensure service worker is active
      if (this.registration.active) {
        console.log('✅ Service Worker is active');
      } else if (this.registration.installing) {
        await new Promise((resolve) => {
          this.registration!.installing!.addEventListener('statechange', () => {
            if (this.registration!.installing!.state === 'activated') {
              resolve(undefined);
            }
          });
        });
      }

      // Request notification permission (only if not already requested)
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log('📱 Notification permission:', permission);
        
        if (permission === 'granted') {
          await this.setupBackgroundSync();
        } else {
          console.warn('⚠️ Notification permission denied');
        }
      } else {
        console.log('📱 Notification permission already:', Notification.permission);
        if (Notification.permission === 'granted') {
          await this.setupBackgroundSync();
        }
      }

      // Start keep-alive mechanism
      this.startKeepAlive();

      // Initialize Firebase Cloud Messaging (FCM) for push notifications
      await this.initializeFCM();
    } catch (error) {
      console.error('❌ Error initializing notifications:', error);
    }
  }

  private async initializeFCM(): Promise<void> {
    try {
      // Check if messaging is supported
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        console.warn('⚠️ FCM requires notification permission');
        return;
      }

      if (!this.registration) {
        console.warn('⚠️ Service worker registration required for FCM');
        return;
      }

      // Initialize Firebase Messaging
      this.messaging = getMessaging(firebaseApp);
      console.log('✅ Firebase Messaging initialized');

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: this.registration
      });

      if (token) {
        this.fcmToken = token;
        console.log('✅ FCM token obtained:', token.substring(0, 20) + '...');
        
        // Send token to server to store it for this user
        await this.sendTokenToServer(token);
        
        // Listen for foreground messages (when app is open)
        onMessage(this.messaging, (payload) => {
          console.log('📬 FCM message received in foreground:', payload);
          // Show notification even when app is open
          this.showNotification(
            payload.notification?.title || 'Nieuwe oproep',
            {
              body: payload.notification?.body || 'Je hebt een oproep ontvangen',
              icon: payload.notification?.icon || '/icon-192.png',
              data: payload.data || {}
            }
          );
        });
      } else {
        console.warn('⚠️ No FCM token available');
      }
    } catch (error) {
      console.error('❌ Error initializing FCM:', error);
    }
  }

  private async sendTokenToServer(token: string): Promise<void> {
    try {
      // Get current user ID (parent or child)
      const userId = this.getCurrentUserId();
      if (!userId) {
        console.warn('⚠️ No user ID available to send FCM token');
        return;
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://webrtc-signaling-stg.fly.dev';
      const response = await fetch(`${backendUrl}/api/fcm-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          fcmToken: token
        })
      });

      if (response.ok) {
        console.log('✅ FCM token sent to server');
      } else {
        console.error('❌ Failed to send FCM token to server:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Error sending FCM token to server:', error);
    }
  }

  private getCurrentUserId(): string | null {
    // Try to get from localStorage (child session)
    const childSession = localStorage.getItem('childSession');
    if (childSession) {
      try {
        const session = JSON.parse(childSession);
        return session.userId || null;
      } catch {
        return null;
      }
    }

    // Try to get from Firebase Auth (parent)
    // This will be set by the App component
    return null; // Will be set via setUserId method
  }

  setUserId(userId: string): void {
    // If token exists but wasn't sent yet, send it now
    if (this.fcmToken && userId) {
      this.sendTokenToServer(this.fcmToken);
    }
  }

  getFCMToken(): string | null {
    return this.fcmToken;
  }

  private async setupBackgroundSync(): Promise<void> {
    if (!this.registration) return;

    try {
      // Register for background sync (if supported)
      const registration = this.registration as any;
      if ('sync' in registration) {
        try {
          await registration.sync.register('keep-alive');
          console.log('✅ Background sync registered');
        } catch (syncError) {
          console.warn('⚠️ Background sync registration failed:', syncError);
        }
      }

      // Register for periodic background sync (if supported)
      if ('periodicSync' in registration) {
        try {
          await registration.periodicSync.register('keep-alive', {
            minInterval: 30000 // 30 seconds
          });
          console.log('✅ Periodic background sync registered');
        } catch (periodicError) {
          console.warn('⚠️ Periodic sync registration failed:', periodicError);
        }
      }
    } catch (error) {
      console.warn('⚠️ Background sync setup failed:', error);
    }
  }

  private startKeepAlive(): void {
    // Send keep-alive message to service worker every 60 seconds (less frequent to avoid conflicts)
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(() => {
      if (this.registration && this.registration.active) {
        this.registration.active.postMessage({
          type: 'KEEP_ALIVE',
          timestamp: Date.now()
        });
      }
    }, 60000); // Every 60 seconds (was 20) - less frequent to avoid conflicts with socket

    console.log('✅ Keep-alive started (60s interval)');
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
      // Always use service worker notification (works even when app is closed)
      if (this.registration) {
        // Ensure service worker is ready
        if (!this.serviceWorkerReady) {
          await navigator.serviceWorker.ready;
          this.serviceWorkerReady = true;
        }

        // Use service worker to show notification (works in background/closed)
        const notificationOptions: any = {
          ...options,
          requireInteraction: true,
          tag: options.tag || `notification-${Date.now()}`,
          badge: '/icon-96.png',
          icon: options.icon || '/icon-192.png'
        };
        
        // Add vibrate if supported (not in standard NotificationOptions type)
        if ('vibrate' in Notification.prototype || 'vibrate' in navigator) {
          notificationOptions.vibrate = [200, 100, 200, 100, 200];
        }
        
        await this.registration.showNotification(title, notificationOptions);
        console.log('✅ Notification shown via service worker');
      } else {
        // Fallback to regular notification (only works when app is open)
        const notification = new Notification(title, options);
        console.log('✅ Notification shown directly');
        
        // Auto-close after 10 seconds if not clicked
        setTimeout(() => {
          notification.close();
        }, 10000);
      }
    } catch (error) {
      console.error('❌ Error showing notification:', error);
      // Fallback to regular notification
      try {
        const notification = new Notification(title, options);
        setTimeout(() => notification.close(), 10000);
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

  cleanup(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

export const notificationService = NotificationService.getInstance();
