import Eventable from './Eventable.js'
import Catalogue from './Catalogue.js'
import AnalysisCatalogue from './AnalysisCatalogue.js'

import CovJSON from './formats/CovJSON.js'
import GeoJSON from './formats/GeoJSON.js'
import JSONLD from './formats/JSONLD.js'
import WMS from './formats/WMS.js'

import CovJSONView from './actions/CovJSONView.js'
import CovJSONRemapCategories from './actions/CovJSONRemapCategories.js'
import GeoJSONView from './actions/GeoJSONView.js'
import WMSView from './actions/WMSView.js'

/**
 * Something like a main controller.
 * 
 * @fires App#dataLoading when some data has started loading
 * @fires App#dataLoad when some data has finished loading or an error occured
 */
export default class App extends Eventable {
  constructor (map) {
    super()
    this.map = map
            
    this.catalogue = new Catalogue()
    
    this.formats = [
      new CovJSON([
         CovJSONView,
         CovJSONRemapCategories
      ]),
      new GeoJSON([
        GeoJSONView
      ]),
      new WMS([
        WMSView
      ]),
      new JSONLD()
    ]
    
    this.analysisCatalogue = new AnalysisCatalogue(this.formats)
    this.analysisCatalogue.addStaticActionContext({map})
    
    this._registerLoadingListeners()
  }
  
  /**
   * Listens for any kind of data loading event and re-fires
   * those as generic 'dataLoading' and 'dataLoad' events
   * to allow for UI elements like loading spinners.
   * 
   * Note that any consumer of those events should register itself
   * before any data loading occurs. This is because events will fire
   * in any order and the consumer has to keep track of the counts of
   * 'dataLoading' and 'dataLoad' events to determine whether all data
   * has finished loading.
   */
  _registerLoadingListeners () {
    // TODO how can we listen to Action class events?
    
    let fireLoadingEvent = () => this.fire('dataLoading')
    let fireLoadEvent = () => this.fire('dataLoad')
    
    this.catalogue
      .on('loading', fireLoadingEvent)
      .on(['load', 'loadError'], fireLoadEvent)
    this.analysisCatalogue
      .on('distributionsLoading', fireLoadingEvent)
      .on('distributionsLoad', fireLoadEvent)
    for (let format of this.formats) {
      format
        .on('loading', fireLoadingEvent)
        .on(['load', 'loadError'], fireLoadEvent)
        .on('actionCreate', ({action}) => {
          action
            .on('loading', fireLoadingEvent)
            .on(['load', 'loadError'], fireLoadEvent)
        })
    }
  }
}