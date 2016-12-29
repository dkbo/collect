import React, {Component} from "react"
import Control from "./components/control"
import Map from "./components/map"
import MiniChat from '../../components/miniChat'

import './directions.sass'


export default class Direction extends Component {
  constructor() {
    super()

    this.state = {
      isSearchBox: false,
    }
    this.toggleSearchBox = ::this.toggleSearchBox
  }
  // shouldComponentUpdate(nextProps) {
  //   console.log(nextProps.directions, this.props.directions);
  //   return true
  // }
  componentWillUnmount() {
    const pac_container = document.getElementsByClassName('pac-container')
    for(let x in pac_container) {
      if(pac_container[x].parentNode) {
        pac_container[x].parentNode.removeChild(pac_container[x])
      }
    }
  }
  /**
   * 顯示/隱藏導航視窗
   * @return {void}
   */
  toggleSearchBox() {
    this.setState({isSearchBox: !this.state.isSearchBox})
  }

  render() {
    return (
      <div className='container-fluid' id='mapBox'>
        <MiniChat {...this.props} miniChatStyle={{left: 0}}/>
        <Control {...this.props} isSearchBox={this.state.isSearchBox} toggleSearchBox={this.toggleSearchBox} />
        <Map {...this.props} />
        <div id="searchBtn"><button onClick={this.toggleSearchBox}><i className="fa fa-search"></i></button></div>
      </div>
    )
  }
}

