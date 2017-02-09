import React, { Component } from 'react'
import NavItem from './components/navItem'
import currentHistory from '../../config/currentHistory'
import './nav.sass'

const navItems = [
  {
    to: '/',
    title: '首頁',
  },
  {
    to: '/resume',
    title: 'e履歷',
  },
  {
    to: '/rpgroom',
    title: '遊戲室',
  },
  {
    to: '/directions',
    title: '地圖導航',
  },
  {
    to: '/chat',
    title: '多人聊天',
  },
]

export default class Nav extends Component {
  constructor() {
    super()
    this.state = {
      isShowNav: false,
    }
    this.navToggle = ::this.navToggle
  }
  getUser() {
    return firebase.chatAH.currentUser;
  }
  /**
   * 在解析度寬度 767px 以下顯示隱藏選單
   * @returns {void}
   */
  navToggle() {
    this.setState({ isShowNav: !this.state.isShowNav })
  }

  logout() {
    firebase.chatAH.signOut()
    .then(() => {
      console.log('登出成功')
      currentHistory.push('/auth')
    }).catch((error) => {
      console.log('登出失敗', error)
    });
  }
  login() {
    currentHistory.push('/auth')
  }
  render() {
    const navbarClass = this.state.isShowNav ? 'nav navbar-nav active' : 'nav navbar-nav'
    const user = this.getUser()
    return (
      <nav id="navTop" className="navbar navbar-dark navbar-full">
        <button className="btn hidden-md-up" onClick={this.navToggle}><i className="fa fa-bars" /></button>
        <ul className={navbarClass}>
          {navItems.map((item, key) =>
            <NavItem to={item.to} key={key} title={item.title} navToggle={this.navToggle} />)}
        </ul>
        <div className="float-xs-right">
          {user ? <button className="btn"><img className="rounded" src={user.photoURL} alt="" /></button> : null}
          {user ? <button className="btn" onClick={this.logout} ><i className="fa fa-sign-out" /></button> : <button className="btn" onClick={this.login} ><i className="fa fa-sign-out" /></button>}
        </div>
      </nav>
    )
  }
}
