import React, { Component, PropTypes } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as CounterActions from '../actions';

import Nav from '../components/nav/'

class App extends Component {
  componentDidMount() {
    this.chatMessageOn(this.props.add_message)
  }
  componentWillUnmount() {
    this.chatMessageOff(this.props.add_message)

  }
  /**
   * 當 Firebase 資料庫於 messages 底下有新筆資料時，執行方法
   * @param {Function} func CallBack
   * @returns {void}
   */
  chatMessageOn(func) {
    firebase.chatDB.ref('messages/').limitToLast(1).on('child_added', func)
  }
  /**
   * 停止與Firebase 於 messages 底下的雙向數據溝通
   * @param {Function} func CallBack
   * @returns {void}
   */
  chatMessageOff(func) {
    firebase.chatDB.ref('messages/').off('child_added', func)
  }
  /**
   * 取得會員資料
   * @returns {JSON} 取得會員資料
   */
  getUser() {
    return firebase.chatAH.currentUser;
  }
  render() {
    const chatMessageOn = this.chatMessageOn
    const chatMessageOff = this.chatMessageOff
    const title = this.props.children.props.route.title
    const Page = React.cloneElement(this.props.children,
      {
        ...this.props,
        chatMessageOn,
        chatMessageOff,
        title,
      })
    document.title = title

    return (
      <main>
        <Nav />
        {Page}
      </main>
    )
  }
}

App.propTypes = {
  add_message: PropTypes.func
}

/**
 * 數據綁定在 Props裡
 * @param {JSON} state Store 數據資料
 * @returns {JSON} Store 數據綁定在 Props裡
 */
const mapStateToProps = state => {
  return {
    chat: state.chat,
    miniChat: state.miniChat,
    directions: state.directions,
    geo: state.geo,
    player: state.player.toObject(),
    sence: state.sence,
    npc: state.npc.toObject(),
  };
}
/**
 * Reducers 方法綁定在 Props 裡
 * @param {JSON} dispatch 執行 Action 方法
 * @returns {any} Reducers 方法綁定在 Props 裡
 */
const mapDispatchToProps = dispatch => {
  return bindActionCreators(CounterActions, dispatch);
}


export default connect(mapStateToProps, mapDispatchToProps)(App);
