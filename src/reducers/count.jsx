import {fromJS} from 'immutable';
import {ADD, RED} from '../constants';

const one = 'one';

export const count = (state = fromJS({one: 0}), action) => {
    const setValue = value => state.set(one, state.get(one) + value);
    switch (action.type) {
        case ADD:
            return setValue(1);
        case RED:
            return setValue(-1);
        default:
            return state
    }
}

export default count
