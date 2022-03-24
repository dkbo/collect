import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import './log.sass'

const Log = (props) => {
  const [logOpacity, setLogOpacity] = useState(0)
  const [stemWidth, setStemWidth] = useState(0)
  useEffect(() => {
    Rx.Observable
      .of('100px')
      .delay(1500)
      .take(1)
      .subscribe(setStemWidth)

    Rx.Observable
      .of(1)
      .delay(2100)
      .take(1)
      .subscribe(setLogOpacity)
  }, [])


  return (
    <div className="log">
      <div className="stem" style={{ width: stemWidth }} />
      <section style={{ opacity: logOpacity }}>
        <div className="name">{props.name}</div>
        <div className="class">{props.classor}</div>
        <div className="time">{props.time}</div>
      </section>
    </div>
  )
}

export default Log
Log.propTypes = {
  name: PropTypes.string.isRequired,
  classor: PropTypes.string.isRequired,
  time: PropTypes.string.isRequired,
}
