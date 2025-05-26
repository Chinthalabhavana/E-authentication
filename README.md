# E-Authentication using QR Code and Mobile OTP

## Overview
This project implements a secure e-authentication system using Firebase Authentication for mobile OTP verification and QR code as a second factor for authentication. All user data is stored in Firebase Firestore instead of a traditional MySQL database.

## Features
- Mobile OTP verification using Firebase Authentication
- QR code as a second authentication factor
- User registration and login
- Secure data storage in Firebase Firestore
- Authentication history tracking
- Responsive UI design

## Setup Instructions

### Prerequisites
1. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Phone Authentication in the Firebase Authentication section
3. Create a Firestore database in the Firebase console

### Configuration
1. In the Firebase project settings, register your app and get your Firebase configuration
2. Update the `firebase-config.js` file with your Firebase configuration details:
   ```js
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID",
     measurementId: "YOUR_MEASUREMENT_ID"
   };
   ```

### Running the Project
1. Host the project on a web server or use a local development server
2. Open `Simple registration.html` in a browser to start the registration process
3. Register with your details and verify using mobile OTP
4. Once registered, you can log in using your mobile number and verify with OTP and QR code

## Authentication Flow
1. User registers with username, password, email, and mobile number
2. User logs in with mobile number
3. System sends OTP to the mobile number for verification
4. After OTP verification, system generates a QR code as a second factor
5. User scans the QR code to complete the authentication
6. User is redirected to the dashboard upon successful authentication

## Security Features
- Two-factor authentication (OTP + QR code)
- Phone number verification through SMS
- Authentication history tracking
- Session management
