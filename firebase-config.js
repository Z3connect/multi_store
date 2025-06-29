// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyB9LmVxeZ4KVD0kmvAHGRbGQxDfsPzN3WY",
  authDomain: "storemanagement-77217.firebaseapp.com",
  projectId: "storemanagement-77217",
  storageBucket: "storemanagement-77217.firebasestorage.app",
  messagingSenderId: "871583102401",
  appId: "1:871583102401:web:290148d12c507e6d656b40"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
