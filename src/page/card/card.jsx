import React from 'react'
import Example1 from './components/example1'
import Example2 from './components/example2'
import Example3 from './components/example3'
import Example4 from './components/example4'
import Col from './components/col'
import MiniChat from '../../components/miniChat'

import './card.sass'

const Card = props => {
  return(
      <div id='card' className='container-fluid'>
        <div className="row">
          <Col>
            <Example1 />
          </Col>
          <Col>
            <Example2 />
          </Col>
          <Col>
            <Example3 />
          </Col>
          <Col>
            <Example4 />
          </Col>
          <Col>
            <progress className="progress progress-striped progress-animated" value="25" max="100"></progress>
          </Col>
        </div>
        <MiniChat {...props} miniChatStyle={{left: 0}}/>
      </div>
  )
}
export default Card
