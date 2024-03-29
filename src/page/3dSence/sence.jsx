import React, { Component } from 'react'
import PropTypes from 'prop-types'
import * as BABYLON from 'babylonjs'
// import { Engine, Scene } from 'babylonjs';

import './sence.sass'
/**
 * Reducers 方法綁定在 Props 裡
 * @param {JSON} dispatch 執行 Action 方法
 * @returns {any} Reducers 方法綁定在 Props 裡
 */
export default class Todolist extends Component {
	state = {
	  liLeave: false,
	}
	constructor(props) {
	  super(props)
	}
	componentWillUnmount() {}
	componentDidMount() {
	  const canvas = document.getElementById('sence')
	  const engine = new BABYLON.Engine(canvas, true)
	  const createScene = function () {
	    // Create a basic BJS Scene object.
	    const scene = new BABYLON.Scene(engine)

	    // Create a FreeCamera, and set its position to (x:0, y:5, z:-10).
	    const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 5, -10), scene)

	    // Target the camera to scene origin.
	    camera.setTarget(BABYLON.Vector3.Zero())

	    // Attach the camera to the canvas.
	    camera.attachControl(canvas, false)

	    // Create a basic light, aiming 0,1,0 - meaning, to the sky.
	    const light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0, 1, 0), scene)

	    // Create a built-in "sphere" shape.
	    const sphere = BABYLON.MeshBuilder.CreateSphere('sphere', { segments: 16, diameter: 2 }, scene)

	    // Move the sphere upward 1/2 of its height.
	    sphere.position.y = 1

	    // Create a built-in "ground" shape.
	    const ground = BABYLON.MeshBuilder.CreateGround(
	      'ground1',
	      { height: 6, width: 6, subdivisions: 2 },
	      scene,
	    )

	    // Return the created scene.
	    return scene
	  }
	  const scene = createScene()
	  engine.runRenderLoop(() => {
	    scene.render()
	  })
	  window.onresize = () => engine.resize()
	}
	render() {
	  return <canvas id="sence" />
	}
}
Todolist.propTypes = {}
