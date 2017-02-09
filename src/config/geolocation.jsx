const geolocation = (
    navigator.geolocation ?
        navigator.geolocation :
        ({
          /**
           * 透過 geocoder 傳回原始位置的經緯度及位址
           * @param {Function} success 成功後執行的Function
           * @param {Function} failure 失敗後執行的Function
           * @returns {void}
           */
          getCurrentPosition(success, failure) {
            failure('Your browser doesn\'t support geolocation.')
          },
        })
)

export default geolocation
