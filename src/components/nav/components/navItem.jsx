import React, { Component, PropTypes } from 'react'
import { Link } from 'react-router'

export default class NavItem extends Component {
  shouldComponentUpdate() {
    return false
  }
  render() {
    return (
      <li className="nav-item" >
        <Link
          to={this.props.to}
          className="nav-link"
          activeClassName="active"
          onlyActiveOnIndex={this.props.to === '/'}
          onClick={this.props.navToggle}
        >
          {this.props.title}
        </Link>
      </li>
    )
  }
}

NavItem.propTypes = {
  to: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  navToggle: PropTypes.func,
}
