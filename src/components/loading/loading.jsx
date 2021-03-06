import React, { Component } from 'react';
import PropTypes from 'prop-types'
import './loading.sass'

export default class Loading extends Component {
  shouldComponentUpdate() {
    return false
  }
  render() {
    return (
      <div id="loadBox">
        <div className="loader">
          <div className="loader-overlay" />
          <div className="loader-cogs">
            <div className="loader-cogs-top">
              <div className="top-part" />
              <div className="top-part" />
              <div className="top-part" />
              <div className="top-hole" />
            </div>
            <div className="loader-cogs-left">
              <div className="left-part" />
              <div className="left-part" />
              <div className="left-part" />
              <div className="left-hole" />
            </div>
            <div className="loader-cogs-bottom">
              <div className="bottom-part" />
              <div className="bottom-part" />
              <div className="bottom-part" />
              <div className="bottom-hole" />
            </div>
            <p>{this.props.loadText}</p>
          </div>
        </div>
      </div>
    )
  }
}

Loading.propTypes = {
  loadText: PropTypes.string,
}
