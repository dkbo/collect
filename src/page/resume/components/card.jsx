import React, { PropTypes } from 'react'
import './card.sass'

const Card = ({ header, children }) => (
  <div className="card">
    <div className="h3 text-xs-center">{header}</div>
    {children}
  </div>
)

Card.propTypes = {
  header: PropTypes.string.isRequired,
}
export default Card
