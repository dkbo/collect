import React, {PropTypes} from 'react'
import miniControl from '../../../components/miniChat/components/control'
import './control.sass'

export default class Control extends miniControl {
	render() {
	    return (
			<div id='control' className='input-group has-success'>
				<input className='form-control' ref='message' type="text" placeholder='message' onKeyDown={this.handleKeyDown}/>
				<div className="input-group-btn">
					<button className='btn' type='button' title='發送' onClick={this.SendMessage}><i className="fa fa-paper-plane"></i></button>
					<button className='btn' type='button' title='清除' onClick={this.props.clear_message}><i className="fa fa-eraser"></i></button>
				</div>
			</div>
	      )
	}
}
Control.propTypes = {
    add_message: PropTypes.func,
    clear_message: PropTypes.func,
}
