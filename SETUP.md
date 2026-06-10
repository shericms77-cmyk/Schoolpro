# 🔥 Firebase Setup Guide — School Admin Pro
# ============================================================
# Do this ONCE before deploying. Takes about 10 minutes.
# ============================================================

## STEP 1 — Create Firebase Project
1. Go to https://console.firebase.google.com
2. Click "Add project" → name it "SchoolAdminPro"
3. Disable Google Analytics (not needed) → Create project

## STEP 2 — Enable Google Sign-In
1. In Firebase console → Authentication → Get Started
2. Sign-in method → Google → Enable → Save

## STEP 3 — Create Firestore Database
1. Firestore Database → Create database
2. Choose "Start in production mode"
3. Select region: asia-south1 (Mumbai — closest to Pakistan)

## STEP 4 — Firestore Security Rules
Paste these rules in Firestore → Rules tab:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // School settings — only admin can write
    match /schools/{schoolId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users — can read own profile, admin can read all
    match /users/{userId} {
      allow read: if request.auth.uid == userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
      allow write: if request.auth.uid == userId ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Students — admin, accountant, teacher can read; admin can write
    match /students/{studentId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant','teacher'];
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
    }

    // Fee records
    match /fees/{feeId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
    }

    // Attendance
    match /attendance/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','teacher'];
    }

    // Exams
    match /exams/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','teacher'];
    }

    // Notices
    match /notices/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','teacher'];
    }

    // Homework
    match /homework/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','teacher'];
    }

    // Staff
    match /staff/{docId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Salary
    match /salary/{docId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','accountant'];
    }

    // Timetable
    match /timetable/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin','teacher'];
    }
  }
}
```

## STEP 5 — Get your Firebase Config
1. Project Settings (gear icon) → General → Your apps
2. Click "</>" Web app → Register app name "SchoolAdminPro"
3. Copy the firebaseConfig object — looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "schooladminpro.firebaseapp.com",
  projectId: "schooladminpro",
  storageBucket: "schooladminpro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. Open app.js → find "PASTE YOUR FIREBASE CONFIG HERE"
5. Replace the placeholder config with yours

## STEP 6 — Deploy to Firebase Hosting (free)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # choose your project, public folder = . (dot)
firebase deploy
```

Your app will be live at: https://schooladminpro.web.app

## STEP 7 — Set first Admin account
After first login, go to Firebase Console → Firestore → users collection
Find your user document → edit → set role: "admin"

## NOTES
- Free Spark plan: 1GB storage, 50K reads/day, 20K writes/day — plenty for one school
- Data is stored in Firestore cloud — deleting the app NEVER deletes data
- Users log in with any Google account
- Admin assigns roles to new users from the app
