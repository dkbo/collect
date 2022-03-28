import React, { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import './listBox.sass'
import { resolve } from 'path'


const ListBox = (props) => {
  const editRef = useRef(null)

  useEffect(() => {
    if (props.del) {
      handleLeaveAndDelete();
    }
  })
  useEffect(() => {
    if (editRef.current) {
      editRef.current.focus();
    }
  }, [props.object.isEdit])
  const getEditLabelClassName = () => (props.object.completed ? 'hidden-xs-up' : '')
  const getLiClassName = () => {
    let state = ''
    if (props.match.params.keyword === 'completed') {
      state = props.object.completed ? '' : 'hide'
    } else if (props.match.params.keyword === 'active') {
      state = props.object.completed ? 'hide' : ''
    }

    if (props.object.isLeave) {
      if (state.indexOf('hide') === -1) {
        state += `${state} leaved`
      }
    }

    if (props.object.completed) {
      return `${state} completed`
    }

    return state
  }
  const handleLeave = () => props.todoLeave(props.index)
  const handleDelete = () => props.todoDelete(props.index)
  const handleLeaveAndDelete = (e) => {
    handleLeave()
    setTimeout(() => handleDelete(), 500)
  }
  const handleEdit = e => e.keyCode === 13 ? props.todoUpdate(e.target.value, props.index) : null
  const handleBlur = e => props.todoUpdate(e.target.value, props.index)
  const handleEditActive = () => props.todoUpdateActive(props.index)
  const handleCompleted = () => props.todoCompleted(props.index)
  const getLiItems = () => (
    props.object.isEdit
      ? <input ref={editRef} type="text" onBlur={handleBlur} onKeyDown={handleEdit} defaultValue={props.object.value} />
      : <span>{props.object.value}</span>
  )
  return (
    <li className={getLiClassName()}>
      <div className="liText" onMouseDown={handleCompleted} >{getLiItems()}</div>
      <label className={getEditLabelClassName()} htmlFor={`edit${props.index}`}>
        <button id={`edit${props.index}`} onClick={handleEditActive}>
          <i className="fa fa-edit" />
        </button>
      </label>
      <label htmlFor={`delete${props.index}`}>
        <button id={`delete${props.index}`} onClick={handleLeaveAndDelete}>
          <i className="fa fa-remove" />
        </button>
      </label>
    </li>
  )
}
ListBox.propTypes = {
  todoLeave: PropTypes.func,
  todoDelete: PropTypes.func,
  todoUpdate: PropTypes.func,
  todoCompleted: PropTypes.func,
  todoUpdateActive: PropTypes.func,
  object: PropTypes.object,
  index: PropTypes.number,
}

export default ListBox
