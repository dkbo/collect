import React from 'react'
import Map from './components/map'
import Control from './components/control'
import MiniChat from '../../components/miniChat'


import './directions.sass'

const Direction = props => (
  <div className="container-fluid" id="mapBox">
    <MiniChat
      {...props}
      miniChatStyle={{ left: 0 }}
    />
    <Map {...props} />
    <Control {...props} />
  </div>
)

export default Direction
