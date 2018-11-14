import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'
export default class NavItem extends Component {
  render() {
    return (
      <li className="nav-item" >
        <NavLink
          to={this.props.to}
          className="nav-link"
          exact={this.props.to === '/'}
          onClick={this.props.navToggle}
        >
          {this.props.title}
        </NavLink>
      </li>
    )
  }
}

NavItem.propTypes = {
  to: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  navToggle: PropTypes.func,
}
