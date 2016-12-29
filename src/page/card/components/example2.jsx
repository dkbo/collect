import React from 'react';
import {Link} from 'react-router'

const example = () => (
  <div className="card">
    <h3 className="card-header">Card 範例二</h3>
    <div className="card-block">
      <Link to="/main2" className="btn btn-primary card-link">main2</Link>
    </div>
    <ul className="list-group list-group-flush">
      <li className="list-group-item">1</li>
      <li className="list-group-item">2</li>
      <li className="list-group-item">3</li>
    </ul>
  </div>
)

export default example
