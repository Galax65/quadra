/**
 * FONTE DI VERITÀ delle versioni Quadra. Caricato dall'hub (browser)
 * e dagli script (Node). NON modificare a mano: usare `npm run bump`.
 */
(function (root) {
  var V = {
    "app": {
      "name": "Quadra",
      "version": "0.14.0"
    },
    "developer": {
      "name": "Galax65",
      "github": "https://github.com/Galax65",
      "badge": ""
    }
  }

  if (typeof window !== 'undefined') root.QUADRA_VERSIONS = V
  if (typeof module !== 'undefined' && module.exports) module.exports = V
})(typeof window !== 'undefined' ? window : this)
