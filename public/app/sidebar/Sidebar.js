import L from 'leaflet'
import 'sidebar-v2/js/leaflet-sidebar.js'
import 'sidebar-v2/css/leaflet-sidebar.css!'
import 'bootstrap/css/bootstrap.css!'
import {$, HTML} from 'minified'

import SearchPane from './SearchPane.js'
import WorkspacePane from './WorkspacePane.js'

let sidebarHtml = (sidebarId, searchPaneId, workspacePaneId) => `
<div id="${sidebarId}" class="sidebar collapsed">
  <!-- Nav tabs -->
  <div class="sidebar-tabs">
      <ul role="tablist">
          <li><a href="#${searchPaneId}" role="tab" class="sidebar-tab"><i class="glyphicon glyphicon-align-justify"></i></a></li>
          <li><a href="#${workspacePaneId}" role="tab" class="sidebar-tab"><i class="glyphicon glyphicon-flash"></i></a></li>
      </ul>
  </div>
  
  <!-- Tab panes -->
  <div class="sidebar-content">
      <div class="sidebar-pane" id="${searchPaneId}"></div>
      <div class="sidebar-pane" id="${workspacePaneId}"></div>
  </div>
</div>
<style>
.error-item {
  word-wrap: break-word;
}
`

export default class Sidebar {
  constructor (map, {app, sidebarId='sidebar', searchPaneId='search', workspacePaneId='workspace', layerControl=null}={}) {
    this.map = map
    this.app = app
    this.catalogue = app.catalogue
    this.workspace = app.workspace
    this.id = sidebarId
    this.layerControl = layerControl
    // has to come before the map div, otherwise it overlays zoom controls
    $('body').addFront(HTML(sidebarHtml(sidebarId, searchPaneId, workspacePaneId)))
    
    $('#' + map.getContainer().id).set('+sidebar-map')
        
    this.panes = {
      Search: new SearchPane(this, searchPaneId),
      Workspace: new WorkspacePane(this, workspacePaneId)
    }
    
    this.control = L.control.sidebar(sidebarId).addTo(map)
  }
  
  open (pane) {
    this.control.open(pane.id)
  }
}

