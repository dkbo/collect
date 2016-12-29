import React, {Component, PropTypes} from 'react'
import Player from './components/player'
import Sence from './components/sence'
import Chat from './components/chat'
import Load from '../../components/loading'
import MiniChat from '../../components/miniChat'
import './rpg.sass'

export default class Rpg extends Component {
	constructor(props) {
		super(props)
	}
	requestAFrame() {
		return window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		window.oRequestAnimationFrame ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60)
		}
	}
	cancelAFrame() {
		return window.cancelAnimationFrame ||
		window.webkitCancelAnimationFrame ||
		window.mozCancelAnimationFrame ||
		window.oCancelAnimationFrame ||
		function(id) {
			window.clearTimeout(id)
		}
	}

	componentWillMount() {
		document.body.className = 'rpg'
	}
	componentDidMount() {
		window.addEventListener('contextmenu', this.contextmenu, false)
	}
	componentWillUnmount() {
		window.removeEventListener('contextmenu', this.contextmenu, false)
		document.body.className = ''
	}
	/**
	 * 鎖定瀏覽器滑鼠右鍵選單
	 * @param {object} e 事件集
	 * @returns {void}
	 */
	contextmenu(e) {
		e.preventDefault()
	}
	render() {
		return (
			<main>
				{	this.props.sence.get('isTransSence')
						? <Load loadText='載入中請稍後' bodyClass='rpg'/>
						: null
				}
				<Sence {...this.props} senceImg={'second'}/>
				<Player {...this.props} rAF={this.requestAFrame} cAF={this.cancelAFrame}/>
				<Sence {...this.props} senceImg={'first'}/>
				<Chat npc={this.props.npc} />
				<MiniChat {...this.props} miniChatStyle={{left: 0}}/>
			</main>
		)
	}
}
Rpg.propTypes = {
	sence: PropTypes.any,
	npc: PropTypes.object,
	sen: PropTypes.func,

}
