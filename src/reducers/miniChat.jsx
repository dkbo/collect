import {fromJS} from 'immutable';
import {TOGGLE_MINICHAT} from '../constants';

const stateInitial = {
    isShow: false,
    count: 0,
}
export const miniChat = (state = fromJS(stateInitial), action) => {
    switch (action.type) {
        case TOGGLE_MINICHAT:
        return state.merge({'isShow': !state.get('isShow'), 'count': action.count})
        default:
            return state
    }
}

export default miniChat
