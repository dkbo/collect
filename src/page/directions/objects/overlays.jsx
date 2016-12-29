
export default function() {
  return class overlays extends google.maps.OverlayView {
    constructor(bounds, image, message, map) {
      super(bounds, image, message, map)
      this.bounds = bounds
      this.message = message
      this.image = image

      this.map = map;
      this.div = null;
      this.setMap(map);

      this.toggleDialog = ::this.toggleDialog
    }
    onAdd() {
      const innerHTML = `
      <div class='geoDialog card'>${this.message}</div>
      <div class='geoImg'>
        <img src='${this.image}' />
      </div>
      `
      const div = document.createElement('div');
      div.className = 'geoContainer'
      div.innerHTML = innerHTML

      this.div = div;
      this.Dialog = this.div.children[0]
      this.img = this.div.children[1].children[0]

      this.img.addEventListener('click', this.toggleDialog, false)

      const panes = this.getPanes();
      panes.overlayImage.appendChild(this.div);
    }
    toggleDialog() {
      this.Dialog.style.opacity = this.Dialog.style.opacity === '1' ? 0 : 1
    }

    draw() {
      const overlayProjection = this.getProjection();
      const sw = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest());
      const ne = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast());

      this.div.style.left = sw.x - 75 + 'px';
      this.div.style.top = ne.y - 40 + 'px';
    }
    onSet(bounds, image, message, map) {
      this.bounds = bounds
      this.Dialog.innerHTML = message
      this.img.src = image
      this.draw()
    }
  }
}
