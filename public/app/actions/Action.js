export default class Action {
  constructor () {
    this._context = {}
  }
  /**
   * Set by AnalysisCatalogue._loadDistribution().
   */
  set context (val) {
    this._context = val
  }
  
  get context () {
    return this._context
  }
  
  /**
   * Called when the context that this action belongs to (e.g. dataset) is removed.
   * It allows the action to clean up any UI etc.
   */
  remove () {}
}