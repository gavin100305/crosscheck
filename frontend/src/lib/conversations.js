import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore"

import { db, hasFirebaseConfig } from "@/lib/firebase"

const COLLECTION_NAME = "conversations"

function ensureFirebase() {
  if (!hasFirebaseConfig || !db) {
    throw new Error("Firebase is not configured. Please set VITE_FIREBASE_* env vars.")
  }
}

export async function listConversationsFromFirebase() {
  ensureFirebase()

  const q = query(collection(db, COLLECTION_NAME), orderBy("created_at", "desc"))
  const snap = await getDocs(q)

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }))
}

export async function getConversationFromFirebase(conversationId) {
  ensureFirebase()

  const ref = doc(db, COLLECTION_NAME, conversationId)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    return null
  }

  return {
    id: snap.id,
    ...snap.data(),
  }
}

export async function createConversationInFirebase(conversation) {
  ensureFirebase()

  const ref = doc(db, COLLECTION_NAME, conversation.id)
  await setDoc(ref, conversation)
  return conversation
}

export async function saveConversationToFirebase(conversation) {
  ensureFirebase()

  const ref = doc(db, COLLECTION_NAME, conversation.id)
  const payload = {
    ...conversation,
    message_count: (conversation.messages || []).length,
    updated_at: new Date().toISOString(),
  }

  await setDoc(ref, payload, { merge: true })
}

export async function patchConversationInFirebase(conversationId, patch) {
  ensureFirebase()

  const ref = doc(db, COLLECTION_NAME, conversationId)
  await updateDoc(ref, {
    ...patch,
    updated_at: new Date().toISOString(),
  })
}

export async function deleteConversationFromFirebase(conversationId) {
  ensureFirebase()

  const ref = doc(db, COLLECTION_NAME, conversationId)
  await deleteDoc(ref)
}
