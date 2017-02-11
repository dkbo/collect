import { fromJS } from 'immutable';
import { ADD_MESSAGE, CLEAR_MESSAGE } from '../constants';

const chat = (state = fromJS([]), action) => {
  switch (action.type) {
    case ADD_MESSAGE:
      return state.push(action.message);
    case CLEAR_MESSAGE:
      return fromJS([])
    default:
      return state
  }
}

export default chat
