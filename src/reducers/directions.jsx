import { fromJS } from 'immutable';
import { DIRECTIONS_CONFIG, DIRECTIONS_KEY } from '../constants';

const stateInitial = {
  origin: '',
  destination: '',
  latLng: null,
}

if (localStorage.map) {
  const mapSave = JSON.parse(localStorage.map)
    // this.refs.start.value= mapSave.origin
  stateInitial.destination = mapSave.destination
}

const directions = (state = fromJS(stateInitial), action) => {
  switch (action.type) {
    case DIRECTIONS_CONFIG: {
      const { origin, destination, latLng } = action
      return state.merge({ origin, destination, latLng })
    }
    case DIRECTIONS_KEY:
      return state.merge(action.key)
    default:
      return state
  }
}

export default directions
