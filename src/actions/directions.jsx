import { DIRECTIONS_CONFIG } from '../constants'
import geolocation from '../config/geolocation'

/**
 * 地圖導航資料設定 reducers => directions.jsx
 * @param {String} origin 原始位址
 * @param {String} destination 導航目的地位址
 * @param {JSON} latLng 原始位置的經緯度經緯度
 * @return {JSON} 把資料傳入 reducers
 */
const directions_setting = (origin, destination, latLng) => {
    return {
        type: DIRECTIONS_CONFIG,
        origin,
        destination,
        latLng,
    }
}

/**
 * 透過 geocoder 傳回原始位置的經緯度及位址
 * @param {String} origin 原始位址 或是 經緯度
 * @param {String} destination 導航目的地位址
 * @return {Function} 把資料傳入 reducers
 */
export const directions_config = ({origin, destination}) => {
    return dispatch => {
        const geocoder = new google.maps.Geocoder()
        geolocation.getCurrentPosition(position => {
            if (origin) {
                geocoder.geocode({ address: origin }, (results, status) => {
                    if (status === 'OK') {
                        const latLng = results[0].geometry.location
                        dispatch(directions_setting(origin, destination, latLng))
                    } else {
                        alert('請檢查輸入的位址有無錯誤')
                    }
                })
            } else {
                const latLng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude)
                geocoder.geocode({ latLng }, (results) => {
                    origin = results[0].formatted_address
                    dispatch(directions_setting(origin, destination, latLng))
                })
            }
        }, () => {
            if (origin) {
                geocoder.geocode({ address: origin }, results => {
                    const latLng = results[0].geometry.location
                    dispatch(directions_setting(origin, destination, latLng))
                })
            } else {
                const latLng = new google.maps.LatLng(24.962, 121.218)
                geocoder.geocode({ latLng }, results => {
                    origin = results[0].formatted_address
                    dispatch(directions_setting(origin, destination, latLng))
                })
            }
        })
    }
}
