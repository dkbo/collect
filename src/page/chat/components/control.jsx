import React, { PropTypes } from 'react'
import miniControl from '../../../components/miniChat/components/control'
import './control.sass'

export default class Control extends miniControl {
  render() {
    const placeholder = this.getUser() ? '留言' : '登入後才可留言唷~'
    return (
      <div className="control">
        <input className="form-control" ref="message" type="text" placeholder={placeholder} onKeyDown={this.handleKeyDown} />
        <button className="btn" type="button" title="發送" onClick={this.SendMessage}><i className="fa fa-paper-plane" /></button>
        <button className="btn" type="button" title="清除" onClick={this.props.clear_message}><i className="fa fa-eraser" /></button>
      </div>
    )
  }
}
Control.propTypes = {
  add_message: PropTypes.func,
  clear_message: PropTypes.func,
}
