import {ADD_MESSAGE, CLEAR_MESSAGE} from '../constants'

/**
 * 在 firebase 資料庫找尋會員姓名及會員頭像連結
 * @param {any} snap firebase 傳輸的資料集
 * @return {function} 在 firebase 資料庫找尋會員姓名及會員頭像連結
 */
export const add_message = async snap => {
    try {
        const message = snap.val()
        const value = await firebase.chatDB.ref('members/' + message.uid).once('value')
        message.displayName = value.val().displayName
        message.photoURL = value.val().photoURL
        return {
            type: ADD_MESSAGE,
            message,
        }
    } catch(err) {
        console.log(err);
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
