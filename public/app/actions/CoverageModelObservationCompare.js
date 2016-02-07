import {indexOfNearest} from 'leaflet-coverage/util/arrays.js'
import * as referencingUtil from 'leaflet-coverage/util/referencing.js'
import {COVJSON_GRID} from 'leaflet-coverage/util/constants.js'

import {$,$$, HTML} from 'minified'
import Modal from 'bootstrap-native/lib/modal-native.js'

import {i18n, COVJSON_PREFIX} from '../util.js'
import CoverageData from '../formats/CoverageData.js'
import {default as Action, PROCESS} from './Action.js'

const PointCollection = COVJSON_PREFIX + 'PointCoverageCollection'
const ProfileCollection = COVJSON_PREFIX + 'VerticalProfileCoverageCollection'

const TYPE = {
    MODEL: 1,
    OBSERVATIONS: 2
}

let html = `
<div class="modal fade" id="comparisonDatasetSelectModal" tabindex="-1" role="dialog" aria-labelledby="comparisonDatasetSelectModalLabel">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h4 class="modal-title" id="comparisonDatasetSelectModalLabel">Select a dataset to compare against</h4>
      </div>
      <div class="modal-body">
        
        <div class="panel panel-primary">
          <div class="panel-heading">
            <h4>Model-Observation comparison</h4>
          </div>
          <div class="panel-body">
            <p class="help-text-model">
              The gridded input dataset that you selected is assumed to be the model dataset that is compared
              against an observation collection dataset (point or vertical profile observations).
              Please select the observation dataset below.
            </p>
            <p class="help-text-observations">
              The collection-type input dataset that you selected is assumed to be the observation set that is
              compared against a model grid dataset.
              Please select the model dataset below.
            </p>
            <div class="alert alert-info comparison-distribution-list-empty" role="alert"><strong>None found.</strong></div>
          </div>
          
          <ul class="list-group comparison-distribution-list"></ul>
        </div>
       
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="comparisonParametersSelectModal" tabindex="-1" role="dialog" aria-labelledby="comparisonParametersSelectModalLabel">
  <div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h4 class="modal-title" id="comparisonParametersSelectModalLabel">Select parameters</h4>
      </div>
      <div class="modal-body">
        
        <div class="panel panel-primary">
          <div class="panel-body">
            <p>
              Select the parameters you wish to compare.
              Note that currently no unit conversion is done.
            </p>
              
            <div class="form-horizontal">
              <div class="form-group">
                <label for="modelComparisonParameter" class="col-sm-2 control-label">Model</label>
                <div class="col-sm-10">
                  <select id="modelComparisonParameter" class="form-control model-parameter-select"></select>
                </div>
              </div>
              
              <div class="form-group">
                <label for="observationComparisonParameter" class="col-sm-2 control-label">Observations</label>
                <div class="col-sm-10">
                  <select id="observationComparisonParameter" class="form-control observation-parameter-select"></select>
                </div>
              </div>
            </div>
                          
            <div class="parameter-select-button-container"></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>
`
$('body').add(HTML(html))

const TEMPLATES = {
  'comparison-distribution-item': `
  <li class="list-group-item">
    <h4 class="list-group-item-heading dataset-title"></h4>
    <p>Distribution: <span class="distribution-title"></span></p>
    <button type="button" class="btn btn-primary select-button" data-dismiss="modal">
      Select
    </button>
  </li>
  `,
  'params-select-button': `<button type="button" class="btn btn-primary params-select-button" data-dismiss="modal">Select</button>`
}


/**
 * Compare a model grid against an observation collection.
 */
export default class CoverageModelObservationCompare extends Action {
  constructor (data, context) {
    super(context)
    
    this.data = data
    
    this.label = 'Intercompare'
    this.icon = '<span class="glyphicon glyphicon-stats"></span>'
  }
  
  get isSupported () {
    return getCovData(this.data)
  }
  
  run () {
    // Step 1: determine if this dataset is the model grid or the observation collection
    // Step 2: display modal for selecting the dataset to compare against
    //         (filter appropriately by coverage type / collection)
    // Step 3: display modal for selecting the parameters to compare against (if more than one)
    // Step 4: interactive map display
    //         - if there is a model time dimension, display that as an axis selector
    //           and have an observation time dimension extent selector (e.g. +- 1h)
    //         - the intercomparison data is calculated for the current model time step and observation time extent
    //           (don't subset by bounding box for now, do globally, we'll see how it goes)
    //         - the result is a virtual dataset which is NOT added to the workspace,
    //           it is just used for displaying the data as if it was added as a dataset
    //         - there is a button "Store as Dataset" which adds the current virtual comparison dataset
    //           to the workspace
    //         - when clicking on a comparison point, a popup is shown with plots etc.
    
    let {data, type} = getCovData(this.data)
    
    let modalEl = $('#comparisonDatasetSelectModal')
    
    let dists
    if (type === TYPE.MODEL) {
      $('.help-text-model', modalEl).show()
      $('.help-text-observations', modalEl).hide()
      
      dists = this.context.workspace.filterDistributions(dist => {
        if (dist.formatImpl instanceof CoverageData) {
          let covdata = getCovData(dist.data)
          return covdata && covdata.type === TYPE.OBSERVATIONS
        }
      })
    } else {
      $('.help-text-model', modalEl).hide()
      $('.help-text-observations', modalEl).show()
      
      dists = this.context.workspace.filterDistributions(dist => {
        if (dist.formatImpl instanceof CoverageData) {
          let covdata = getCovData(dist.data)
          return covdata && covdata.type === TYPE.MODEL
        }
      })
    }
    
    $('.comparison-distribution-list', modalEl).fill()
    for (let {distribution,dataset} of dists) {
      let el = $(HTML(TEMPLATES['comparison-distribution-item']))
      
      $('.dataset-title', el).fill(i18n(dataset.title))
      $('.distribution-title', el).fill(i18n(distribution.title))
      
      $('.select-button', el).on('click', () => {
        if (type === TYPE.MODEL) {
          this._displayParameterSelectModal(data, distribution.data)
        } else {
          // extract grid from 1-element collection if necessary 
          let modelCov = getCovData(distribution.data).data
          this._displayParameterSelectModal(modelCov, data)
        }
      })
            
      $('.comparison-distribution-list', modalEl).add(el)
    }
    $$('.comparison-distribution-list-empty', modalEl).style.display = dists.length > 0 ? 'none' : 'block'
    
    new Modal(modalEl[0]).open()
  }
  
  _displayParameterSelectModal (modelCov, observationsColl) {
    console.log('Model:', modelCov)
    console.log('Observation collection:', observationsColl)
        
    let modelParams = getNonCategoricalParams(modelCov)
    let observationsParams = getNonCategoricalParams(observationsColl)
    
    let modalEl = $('#comparisonParametersSelectModal')
    
    let fillSelect = (el, params) => {
      el.fill()
      for (let param of params) {
        let unit = (param.unit.symbol || i18n(param.unit.label)) || 'unknown unit'
        let label = i18n(param.observedProperty.label) + ' (' + unit + ')'
        el.add(HTML('<option value="' + param.key + '">' + label + '</option>'))
      }
    }
    
    fillSelect($('.model-parameter-select', modalEl), modelParams)
    fillSelect($('.observation-parameter-select', modalEl), observationsParams)
    
    // we add this anew each time to get rid of old event listeners
    $('.parameter-select-button-container', modalEl).fill(HTML(TEMPLATES['params-select-button']))
    
    $('.params-select-button', modalEl).on('|click', () => {
      let modelParamKey = $$('.model-parameter-select', modalEl).value
      let observationsParamKey = $$('.observation-parameter-select', modalEl).value
      this._displayIntercomparisonUI (modelCov, observationsColl, modelParamKey, observationsParamKey)
    })
    
    new Modal(modalEl[0]).open()
  }
  
  _displayIntercomparisonUI (modelCov, observationsColl, modelParamKey, observationsParamKey) {
    console.log('start intercomparison UI:')
    console.log(modelCov, observationsColl, modelParamKey, observationsParamKey)
  }
  
}

CoverageModelObservationCompare.type = PROCESS

/**
 * Prepares coverage data for comparison, i.e. assigns the semantic type (model or observations)
 * and also extracts grids from 1-element collections.
 * If the coverage data is not suitable for intercomparison, then undefined is returned.
 */
function getCovData (data) {
  // either a Grid (=model) or a collection of Point or VerticalProfile coverages (=observations)
  // also, there must be non-categorical parameters
  let res
  if (data.coverages) {
    if (data.profiles.indexOf(PointCollection) !== -1 || data.profiles.indexOf(ProfileCollection) !== -1) {
      res = {type: TYPE.OBSERVATIONS, data}
    }
    // check if Grid in a 1-element collection
    if (data.coverages.length === 1 && data.coverages[0].domainProfiles.indexOf(COVJSON_GRID) !== -1) {
      res = {type: TYPE.MODEL, data: data.coverages[0]}
    }
  } else if (data.domainProfiles.indexOf(COVJSON_GRID) !== -1) {
    res = {type: TYPE.MODEL, data}      
  }
  if (res && getNonCategoricalParams(res.data).length === 0) {
    res = undefined
  }
  return res
}

function getNonCategoricalParams (cov) {
  let params = [...cov.parameters.values()]
  return params.filter(param => !param.observedProperty.categories)
}

function deriveIntercomparisonStatistics (modelGridCoverage, insituCoverageCollection, modelParamKey, insituParamKey) {
  
  // Basic requirements:
  // - the measurement units of both input parameters must be equal
  // - the model and insitu axes must have the same meaning and CRS
  // If any of that is not the case, then the input has to be transformed before-hand.
  
  // The following combinations for the Z axes are possible:
  // - the model has a fixed Z axis and the insitu coverages have a fixed or varying Z axis
  // - the model has a varying Z axis and the insitu coverages have a fixed or varying Z axis
  // - the model has a fixed Z axis and the insitu coverages have no Z axis
  // - the model has no Z axis and the insitu coverages have a fixed or no Z axis
  
  // The model grid must have:
  // - X and Y axes
  
  // Both inputs can have other fixed axes (like T), but those will be discarded in the result.
  
  // If one input has a fixed, the other a varying Z axis, then there are multiple choices
  // for matching up Z values. In that case the closest Z value is chosen and the result
  // is the absolute difference between both measurement values.
  
  // If both inputs have varying Z axes, then the insitu Z steps are used as base for extracting
  // a virtual vertical profile from the model grid (picking the closest slices from the grid).
  // In that case, the resulting statistics is the standard deviation (RMSE).
  
  // If neither of the inputs has a Z axis, then the resulting statistics is the absolute difference
  // between both measurement values, equal to the case when one input has a fixed Z axis.
  
  // The above is done for every insitu coverage in the collection.
  // The result is again a collection, but of Point coverages.
  // For each Point coverage, the input model grid and the input insitu coverage are referenced
  // by their IDs. This is to help with connecting data and specifically combined visualization
  // (info popups, plots etc.).
  
  // Formula used in all cases (n = number of z steps or 1 if no z axis):
  // RMSE = sqrt ( ( sum_{i=1}^n (x_i - y_i)^2 ) / n)
  // (simplifies to absolute difference if n=1)
  
  // Currently, we hard-code the statistics axis to 'z' but it can be any varying axis along which to calculate the RMSE.
  // For example, z could be fixed and the time axis 't' is varying instead.
  // This would however require that in-situ coverages have a time axis, which is typically not the case,
  // instead each new observation is a separate coverage (the reason is that the z values are often not the same).
  let Z = 'z'
    
  // TODO check that model and insitu coverages have the same CRSs
  
  let model = modelGridCoverage
  let insituCovs = insituCoverageCollection.coverages
  
  let modelParam = model.parameters.get(modelParamKey)
  
  let promises = [
    model.loadDomain(),
    Promise.all(insituCovs.map(cov => cov.loadDomain())),
    Promise.all(insituCovs.map(cov => cov.loadRange(insituParamKey)))
  ]
  
  return Promise.all(promises).then(([modelDomain, insituDomains, insituRanges]) => {
    for (let [key,axis] of modelDomain.axes) {
      if (['x','y',Z].indexOf(key) === -1 && axis.values.length > 1) {
        throw new Error('Only x,y,' + Z + ' can be varying axes in the model grid, not: ' + key)
      }
    }
    
    let modelHasZ = modelDomain.axes.has(Z)
    let modelZ = modelHasZ ? modelDomain.axes.get(Z).values : null 
    
    let insitus = insituCovs.map((cov, i) => ({
      cov,
      domain: insituDomains[i],
      range: insituRanges[i]
    }))
    
    let promises = []
    for (let insitu of insitus) {
      for (let [key,axis] of insitu.domain.axes) {
        if (key !== Z && axis.values.length > 1) {
          throw new Error('Only ' + Z + ' can be a varying axis in in-situ coverages, not: ' + key)
        }
      }
      
      let insituX = insitu.domain.axes.get('x').values[0]
      let insituY = insitu.domain.axes.get('y').values[0]
      let insituHasZ = insitu.domain.axes.has(Z)
      let insituZ = insituHasZ ? insitu.domain.axes.get(Z).values : null
      
      if (insituHasZ && insituZ.length > 1 && !modelHasZ) {
        throw new Error('Model grid must have a ' + Z + ' axis if insitu data has a varying ' + Z + ' axis')
      }
      if (!insituHasZ && modelHasZ && modelZ.length > 1) {
        throw new Error('Model grid must not have a varying ' + Z + ' axis if insitu data has no ' + Z + ' axis')
      }
          
      // TODO we want the geographically closest grid cell, but subsetByValue is defined numerically only
      //  -> for x (longitude, wrap-around) we could implement our own search algorithm and use subsetByIndex then
      //  -> this gets complicated for arbitrary projected CRSs though
      let promise = model.subsetByValue({x: {target: insituX}, y: {target: insituY}}).then(modelSubset => {
        return Promise.all([modelSubset.loadDomain(), modelSubset.loadRange(modelParamKey)])
          .then(([modelSubsetDomain, modelSubsetRange]) => {
            
            // collect the values to compare against each other
            let modelVals = []
            let insituVals = []
            if (!modelHasZ || modelZ.length === 1) {
              modelVals = [modelSubsetRange.get({})]
              
              if (!insituHasZ || insituZ.length === 1) {
                insituVals = [insitu.range.get({})]
              } else {
                // varying insitu z, get closest value to grid z
                let zIdxClosest = indexOfNearest(insituZ, modelZ[0])
                let val = insitu.range.get({[Z]: zIdxClosest})
                insituVals.push(val)
              }
            } else {
              // varying model z
              for (let z of insituZ) {
                let zIdxClosest = indexOfNearest(modelZ, z)
                let val = modelSubsetRange.get({[Z]: zIdxClosest})
                modelVals.push(val)
              }
              
              for (let i=0; i < insituZ.length; i++) {
                let val = insitu.range.get({[Z]: i})
                insituVals.push(val)
              } 
            }
            
            // calculate RMSE = sqrt ( ( sum_{i=1}^n (x_i - y_i)^2 ) / n)
            let n = modelVals.length
            let sum = zip(modelVals, insituVals)
              .map(([v1,v2]) => Math.pow(v1-v2, 2))
              .reduce((l,r) => l+r)
            let rmse = Math.sqrt(sum / n)
            
            // assemble the result into a CovJSON Point coverage            
            let covjson = {
              "type": "Coverage",
              "profile": "PointCoverage",
              "wasGeneratedBy": {
                "type": "ModelObservationComparisonActivity",
                "qualifiedUsage": [{
                  "entity": modelGridCoverage.id,
                  "hadRole": "modelToCompareAgainst"
                }, {
                  "entity": insitu.cov.id,
                  "hadRole": "observationToCompareAgainst"
                }]
              },
              "domain": {
                "type": "Domain",
                "profile": "Point",
                "axes": {
                  "x": { "values": [insituX] },
                  "y": { "values": [insituY] }
                }
              },
              "ranges": {
                "rmse": {
                  "type": "Range",
                  "values": [rmse],
                  "dataType": "float"
                }
              }
            }
            
            return covjson            
          })
      })
      
      promises.push(promise)
    }
    
    return Promise.all(promises).then(covjsons => {
      // put statistical point coverages into a CovJSON collection
      
      let coll = {
        "@context": {
          "prov": "http://www.w3.org/ns/prov#",
          "wasGeneratedBy": "prov:wasGeneratedBy",
          "qualifiedUsage": "prov:qualifiedUsage",
          "entity": {"@id": "prov:entity", "@type": "@id"},
          "hadRole": {"@id": "prov:hadRole", "@type": "@vocab"},
          "covstats": "http://covstats#",
          "ModelObservationComparisonActivity": "covstats:ModelObservationComparisonActivity",
          "modelToCompareAgainst": "covstats:modelToCompareAgainst",
          "observationToCompareAgainst": "covstats:observationToCompareAgainst"
        },
        "type": "CoverageCollection",
        "profile": "PointCoverageCollection",
        "parameters": {
          "rmse": {
            "type": "Parameter",
            "unit": modelParam.unit,
            "observedProperty": {
              "label": {
                "en": "RMSE of " + i18n(modelParam.observedProperty.label)
              },
              // TODO is stddev ok here? uncertml doesn't know RMSE
              "statisticalMeasure": "http://www.uncertml.org/statistics/standard-deviation"
            }
          }
        },
        "referencing": [{
          // FIXME the order could be different, or even be a x-y-z CRS
          "dimensions": ["x","y"],
          "srs": referencingUtil.getRefSystem(modelDomain, ['x','y'])
        }],
        "coverages": covjsons
      }
      return coll
    })
  })  
}

function zip (a, b) {
  return a.map((e, i) => [a[i], b[i]])
}