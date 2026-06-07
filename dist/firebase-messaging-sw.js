importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCJB10ot9q_6KpI_borDB987gZWuidX40I",
  authDomain: "vishwanavya-72a92.firebaseapp.com",
  projectId: "vishwanavya-72a92",
  storageBucket: "vishwanavya-72a92.appspot.com",
  messagingSenderId: "34331683691",
  appId: "1:34331683691:web:09cd70702c7f70dd83fa2e"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('📨 Background message received:', payload);
  
  const notificationTitle = payload.notification?.title || 'Your AI has answered 🤖';
  const notificationOptions = {
    body: payload.notification?.body || 'Your AI has answered your question',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'gk-study-notification',
    requireInteraction: false,
    silent: false
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event);
  
  event.notification.close();
  
  // Focus or open the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // If app is not open, open it
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});