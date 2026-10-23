rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
      match /mofieContacts/{contactId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    match /conversations/{chatId} {
      allow read, write: if request.auth != null && request.auth.uid in resource.data.participants;
      match /messages/{messageId} {
        allow read, create, update, delete: if request.auth != null
          && request.auth.uid in get(/databases/$(database)/documents/conversations/$(chatId)).data.participants;
      }
    }
    match /statuses/{statusId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null
        && (request.auth.uid == resource.data.userId
            || request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewers']));
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /system/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == "0d8XCjdozUSAbIZjdyJiURY2lT33";
    }
  }
}
