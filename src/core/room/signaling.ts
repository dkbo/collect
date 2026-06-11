/**
 * WebRTC Signaling over Firestore：rooms/{roomId}/signals 子集合。
 * 僅在建立 P2P 連線時短暫使用；收訊端處理後即刪除文件，連上 DataChannel 後不再經 Firestore。
 */
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/core/firebase'

export type SignalKind = 'offer' | 'answer' | 'ice'

/** signals/{id} 文件（data 依 kind 為 SDP 或 ICE candidate 的純物件） */
export interface Signal {
  id: string
  from: string
  to: string
  kind: SignalKind
  data: unknown
}

const signalsRef = (roomId: string) => collection(getDb(), 'rooms', roomId, 'signals')

/** 送出一則 signal 給特定對端 */
export const sendSignal = (
  roomId: string,
  sig: { from: string; to: string; kind: SignalKind; data: unknown }
): Promise<unknown> => addDoc(signalsRef(roomId), { ...sig, createdAt: serverTimestamp() })

/**
 * 訂閱「寄給自己」的 signals（to == selfId）。
 * 僅回呼新增的文件；初次快照也會把既有未處理文件視為 added 派送（不漏接 offer）。
 */
export const subscribeSignals = (
  roomId: string,
  selfId: string,
  onSignal: (sig: Signal) => void
): Unsubscribe => {
  const q = query(signalsRef(roomId), where('to', '==', selfId))
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type !== 'added') return
      const d = change.doc
      onSignal({ id: d.id, ...(d.data() as Omit<Signal, 'id'>) })
    })
  })
}

/** 處理完一則 signal 後刪除（收訊端 to==self 才有權刪，見 firestore.rules） */
export const deleteSignal = (roomId: string, signalId: string): Promise<void> =>
  deleteDoc(doc(getDb(), 'rooms', roomId, 'signals', signalId))
