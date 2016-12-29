import {ADD_MESSAGE, CLEAR_MESSAGE} from '../constants'
/**
 * 把資料傳入 reducers => chat.jsx
 * @param {JSON} message 會員姓名、聊天訊息、頭像
 * @return {JSON} 把資料傳入 reducers
 */
const add_message_thunk = message => {
    return {
        type: ADD_MESSAGE,
        message,
    }
}
/**
 * 在 firebase 資料庫找尋會員姓名及會員頭像連結
 * @param {any} snap firebase 傳輸的資料集
 * @return {function} 在 firebase 資料庫找尋會員姓名及會員頭像連結
 */
export const add_message = snap => {
    const message = snap.val()
	return dispatch => {
      firebase.chatDB.ref('members/' + message.uid)
      .once('value', snap2 => {
        message.displayName = snap2.val().displayName
        message.photoURL = snap2.val().photoURL
        dispatch(add_message_thunk(message))
      })
    }
}
/**
 * 清除聊天室的訊息 reducers => chat.jsx
 * @return {JSON} 把資料傳入 reducers
 */
export const clear_message = () => {
    return {
        type: CLEAR_MESSAGE,
    }
}
