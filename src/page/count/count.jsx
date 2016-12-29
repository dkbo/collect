import React, { Component } from 'react'
import Addred from './components/addred'
import MiniChat from '../../components/miniChat'

export default class Main extends Component {
	constructor(porps) {
		super(porps)
		this.state = {
			test: []
		}
	}

	render(P = this.props) {
		return (
			<div className='container  text-xs-center'>
				<MiniChat {...P}/>
				<Addred add={P.add} red={P.red} value={P.init} title={"加減按鈕1"} />
			</div>
		)
	}
}
