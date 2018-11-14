import React from 'react'
import PropTypes from 'prop-types'
import miniControl from '../../../components/miniChat/components/control'
import './control.sass'

export default class Control extends miniControl{}

Control.propTypes = {
  addMessage: PropTypes.func,
  clearMessage: PropTypes.func,
}
