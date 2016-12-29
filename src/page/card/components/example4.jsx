import React from 'react';

const example = () => (
	<div className="card">
    <h3 className="card-header">Card 範例四</h3>
    <div className="card-block">
      <ul className="nav nav-pills card-header-pills">
        <li className="nav-item">
          <a className="nav-link active" href="#">Active</a>
        </li>
        <li className="nav-item">
          <a className="nav-link" href="#">Link</a>
        </li>
        <li className="nav-item">
          <a className="nav-link disabled" href="#">Disabled</a>
        </li>
      </ul>
    </div>
    <div className="card-block text-xs-center">
      <h4 className="card-title">Special title treatment</h4>
      <p className="card-text">With supporting text below as a natural lead-in to additional content.</p>
      <a href="#" className="btn btn-primary">Go somewhere</a>
    </div>
  </div>
)

export default example
