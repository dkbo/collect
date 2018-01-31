import React, { Component } from 'react'
import PropTypes from 'prop-types'
import './listBox.sass'

export default class ListBox extends Component {
  constructor(props) {
    super(props)
    this.DeleteSubject = new Rx.Subject()

    this.Delete = this.DeleteSubject
      .map(() => this.handleLeave())
      .delay(500)
      .subscribe(this.handleDelete)
  }
  componentDidUpdate(prevProps) {
    if (this.props.del) {
      this.DeleteSubject.next()
    }
    if (!prevProps.object.isEdit && this.props.object.isEdit) {
      this.refs.edit.focus();
    }
  }
  getEditLabelClassName = () => (this.props.object.completed ? 'hidden-xs-up' : '')
  getLiClassName = () => {
    let state = ''
    if (this.props.router.params.keyword === 'completed') {
      state = this.props.object.completed ? '' : 'hide'
    } else if (this.props.router.params.keyword === 'active') {
      state = this.props.object.completed ? 'hide' : ''
    }

    if (this.props.object.isLeave) {
      if(state.indexOf('hide') === -1) {
        state += `${state} leaved`
      }
    }

    if (this.props.object.completed) {
      return `${state} completed`
    }

    return state
  }
  getLiItems = () => (
    this.props.object.isEdit
      ? <input ref="edit" type="text" onBlur={this.handleBlur} onKeyDown={this.handleEdit} defaultValue={this.props.object.value} />
      : <span>{this.props.object.value}</span>
  )
  handleLeave = () => this.props.todoLeave(this.props.index)
  handleDelete = () => this.props.todoDelete(this.props.index)
  handleEdit = e => (
    e.keyCode === 13 ? this.props.todoUpdate(e.target.value, this.props.index) : null
  )
  handleBlur = e => this.props.todoUpdate(e.target.value, this.props.index)
  handleEditActive = () => this.props.todoUpdateActive(this.props.index)
  handleCompleted = () => this.props.todoCompleted(this.props.index)
  render() {
    return (
      <li className={this.getLiClassName()}>
        <div className="liText" onMouseDown={this.handleCompleted} >{this.getLiItems()}</div>
        <label className={this.getEditLabelClassName()} htmlFor="edit">
          <button id="edit" onClick={this.handleEditActive}>
            <i className="fa fa-edit" />
          </button>
        </label>
        <label htmlFor="delete">
          <button id="delete" onClick={() => this.DeleteSubject.next()}>
            <i className="fa fa-remove" />
          </button>
        </label>
      </li>
    )
  }
}
ListBox.propTypes = {
  todoDelete: PropTypes.func,
  todoUpdate: PropTypes.func,
  todoCompleted: PropTypes.func,
  todoUpdateActive: PropTypes.func,
  object: PropTypes.object,
  index: PropTypes.number,
}
