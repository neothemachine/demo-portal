import L from 'leaflet'

import {i18n} from '../util.js'
import {default as Action, VIEW} from './Action.js'

export default class GeoJSONView extends Action {
  constructor (data, context) {
    super(context)
    this.data = data
    
    this._setHidden()
      
    this.layers = []
  }
  
  _setVisible () {
    this.visible = true
    this.label = 'Hide'
    this.icon = '<span class="glyphicon glyphicon-eye-close"></span>'
    this.fire('labelChange')
  }
  
  _setHidden () {
    this.visible = false
    this.label = 'View'
    this.icon = '<span class="glyphicon glyphicon-eye-open"></span>'
    this.fire('labelChange')
  }
  
  get isSupported () {
    return true
  }
  
  run () {
    if (this.visible) {
      this.remove()
      this._setHidden()
      return
    }
    
    this._setVisible()
    
    let map = this.context.map
    
    let layer = L.geoJson(this.data, {
      pointToLayer: (feature, latlng) => L.circleMarker(latlng),
      onEachFeature: (feature, layer) => {
        layer.bindPopup(
            '<pre><code class="code-nowrap">' + JSON.stringify(feature.properties, null, 4) + '</code></pre>',
            { maxWidth: 400, maxHeight: 300 })
      }
    }).addTo(map)
    
    let datasetTitle = i18n(this.context.dataset.title)
    let distTitle = i18n(this.context.distribution.title)

    let layerName = '<span class="label label-success">GeoJSON</span> ' + distTitle
    map.layerControl.addOverlay(layer, layerName, {groupName: datasetTitle, expanded: true})
    //map.fitBounds(layer.getBounds())
    this.layers.push(layer)
  }
  
  remove () {
    let map = this.context.map
    
    for (let layer of this.layers) {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
      map.layerControl.removeLayer(layer)
    }
    this.layers = []
  }
}

GeoJSONView.type = VIEW
