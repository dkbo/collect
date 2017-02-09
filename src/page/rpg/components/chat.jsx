import React, { Component, PropTypes } from 'react'
import './chat.sass'

export default class Chat extends Component {
  shouldComponentUpdate(nextProps) {
    return nextProps.npc.messageCount !== this.props.npc.messageCount
  }
  render({ npcName, npcMessage } = this.props.npc) {
    return (
      <div id="rpgChatBox" ref="rpgChatBox">
        {npcName} : {typeof npcMessage === 'object' ? npcMessage.toJS() : npcMessage}
      </div>
    )
  }
}
Chat.propTypes = {
  npc: PropTypes.object.isRequired,
}
