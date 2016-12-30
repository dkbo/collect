import React, {PropTypes} from 'react'
import miniControl from '../../../components/miniChat/components/control'
import './control.sass'

export default class Control extends miniControl {
	render() {
	    return (
			<div className='control'>
				<input className='form-control' ref='message' type="text" placeholder='message' onKeyDown={this.handleKeyDown}/>
				<button className='btn' type='button' title='發送' onClick={this.SendMessage}><i className="fa fa-paper-plane"></i></button>
				<button className='btn' type='button' title='清除' onClick={this.props.clear_message}><i className="fa fa-eraser"></i></button>
			</div>
	      )
	}
}
Control.propTypes = {
    add_message: PropTypes.func,
    clear_message: PropTypes.func,
}
