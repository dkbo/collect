import {TOGGLE_MINICHAT} from '../constants'

export const toggle_minichat = count => {
    return {
        type: TOGGLE_MINICHAT,
        count,
    }
}