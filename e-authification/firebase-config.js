// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBF9moWqWCqzWBQwKIhQqoer0GR_rejsyU",
  authDomain: "e-authentication-96908.firebaseapp.com",
  projectId: "e-authentication-96908",
  storageBucket: "e-authentication-96908.appspot.com", // Fixed storage bucket URL
  messagingSenderId: "1086728900655",
  appId: "1:1086728900655:web:201b936eefaef2bc84b6da",
  measurementId: "G-KDX7YCS3VE"
};

console.log('Initializing Firebase with config:', firebaseConfig);

// Initialize Firebase
try {
  // Force Firebase to use long polling instead of WebSockets or QUIC
  // This helps avoid QUIC protocol errors
  firebase.INTERNAL.extendNamespace({
    TRANSPORT_SESSION_PARAM: 'VER=8&wtsid=' + Math.random().toString(36).substring(2) + '&transport=polling'
  });
  
  firebase.initializeApp(firebaseConfig);
  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);
  // Try to handle already initialized error
  if (error.code === 'app/duplicate-app') {
    console.log('Firebase already initialized, getting existing app');
  } else {
    alert('Firebase initialization error: ' + error.message);
  }
}

// Get references to Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Configure Firestore settings to help avoid connection issues
db.settings({
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true
});

// Enable Firestore logging in console without localhost settings
if (location.hostname === 'localhost' || location.protocol === 'file:') {
  console.log('Enabling Firestore debug mode - connecting to production');
  firebase.firestore.setLogLevel('debug'); // Enable detailed Firestore logging for troubleshooting
}

// Verify Firestore connection
db.collection('users').limit(1).get()
  .then(snapshot => {
    console.log('Firestore connection verified - can query users collection');
    console.log('Found ' + snapshot.size + ' documents in initial test query');
  })
  .catch(error => {
    console.error('Firestore connection error:', error);
  });
