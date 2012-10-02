const {classes: Cc, interfaces: Ci, utils: Cu } = SpecialPowers.wrap(Components);

const permManager = Cc["@mozilla.org/permissionmanager;1"]
                      .getService(Ci.nsIPermissionManager);
var principal = SpecialPowers.getNodePrincipal(document);
var appStatus = SpecialPowers.wrap(principal).appStatus;
var isApp = false;
var source;

switch (appStatus) {
  case Ci.nsIPrincipal.APP_STATUS_NOT_INSTALLED:
  break;
  case Ci.nsIPrincipal.APP_STATUS_PRIVILEGED:
  case Ci.nsIPrincipal.APP_STATUS_CERTIFIED:
  case Ci.nsIPrincipal.APP_STATUS_INSTALLED:
    setupHarness();
    isApp = true;
  break;
  default:
  break;
}

// create the bridge between parent
// and app frame
function setupHarness() {
  function notifyParent(obj) {
    source.postMessage(JSON.stringify(obj), "*");
  }

  ['ok', 'is', 'isnot'].forEach(function(e) {
    window[e] = function(...args) {
      var params = {
        action: 'test',
        type: e,
        args: args,
      }
      notifyParent(params);
    };
  });

  SimpleTest = {}
  SimpleTest.finish = function () {
    var params = {
      action: 'done',
    }
    notifyParent(params);
  };

  SimpleTest.waitForExplicitFinish = function () {};

  function _handler(e) {
    var data = JSON.parse(e.data);

    // set source so that app version of SimpleTest works
    // force run of tests
    source = e.source;
    window.runTests(true);
  }

  window.addEventListener('message', _handler, false);
}
