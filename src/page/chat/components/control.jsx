import React, { PropTypes } from 'react'
import miniControl from '../../../components/miniChat/components/control'
import './control.sass'

export default class Control extends miniControl {
  render() {
    return (
      <div className="control">
        <input className="form-control" ref="message" type="text" placeholder={this.getPlaceholder()} onKeyDown={this.handleKeyDown} />
        <button className="btn" type="button" title="發送" onClick={this.SendMessage}><i className="fa fa-paper-plane" /></button>
        <button className="btn" type="button" title="清除" onClick={this.props.clearMessage}><i className="fa fa-eraser" /></button>
      </div>
    )
  }
}
Control.propTypes = {
  addMessage: PropTypes.func,
  clearMessage: PropTypes.func,
}
