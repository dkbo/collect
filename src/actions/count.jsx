import {ADD, RED} from '../constants';

/**
 * 計數器 +1 reducers => count.jsx
 * @return {JSON} 把資料傳入 reducers
 */
export const add = () => {
  return {
    type: ADD,
  }
}

/**
 * 計數器 -1 reducers => count.jsx
 * @return {JSON} 把資料傳入 reducers
 */
export const red = () => {
  return {
    type: RED,
  }
}
