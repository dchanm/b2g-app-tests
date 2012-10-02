var PermUtils = (function () {
  function _log(aMsg) {
    dump("Permissions test: " + aMsg + "\n");
  }

  function _pprint(aObj) {
    _log("**** pprint " + aObj);
    for (var prop in aObj) {
      try {
        _log(prop + ": " + aObj[prop]);
      } catch(e) {
        _log(prop + ": FAILED" + e);
      }
    }
  }

  return {
    log: _log,
    pprint: _pprint,
  };
})();

var PermTest = (function () {
  const {classes: Cc, interfaces: Ci, utils: Cu } = SpecialPowers.wrap(Components);
  const Services = Cu.import("resource://gre/modules/Services.jsm").Services;
  const permManager = Cc["@mozilla.org/permissionmanager;1"]
                        .getService(Ci.nsIPermissionManager);

  const registry = Cu.import("resource://gre/modules/Webapps.jsm").DOMApplicationRegistry;

  var PACKAGE = true 
  var TEST_PATH =  "tests/webapi/"
  var APP_DOMAIN = "http://example.com/";
  var INSTALL_URL = APP_DOMAIN + TEST_PATH + (PACKAGE ? "app.zip" : "apps/webapp.sjs");

  /*
   * packaged apps have a different manifest url
   * format than webapps, not to be confused with
   * the install url
   *
   */

  function _toAppManifestURL(aURL) {
    if (PACKAGE) {
      return "jar:" + aURL+ "!manifest.webapp"; 
    }
    return aURL;
  }


  /*
   * functions required for test harness setup
   * and teardown
   */ 
  function addPermissions() {
    SpecialPowers.addPermission("browser", true, document);
    is(permManager.testPermissionFromPrincipal(SpecialPowers.getNodePrincipal(document), "browser"),
        Ci.nsIPermissionManager.ALLOW_ACTION,
        "Need browser permission to make app iframe"); 
    SpecialPowers.addPermission("webapps-manage", true, document);
    is(permManager.testPermissionFromPrincipal(SpecialPowers.getNodePrincipal(document), "webapps-manage"),
        Ci.nsIPermissionManager.ALLOW_ACTION,
        "Need webapps-manage permission to query apps");
  }

  function removePermissions() {
    SpecialPowers.removePermission("browser", document);  
    SpecialPowers.removePermission("webapps-manage", true, document);
  }



  function install(aAction, aInstallURL) {
    var req = window.navigator.mozApps[aAction](aInstallURL);
    req.onsuccess = function _onsuccess() {
      ok(true, "Successfully installed");
      createApp(_toAppManifestURL(aInstallURL));
    }

    req.onerror = function _onerror(e) {
      ok(false, "Failed to install: " + e);
      _cleanup();
    }

  }

  function createApp(aManifestURL) {
    // we have to create the app iframe after installing or the principal 
    // check will be wrong
    var origin = registry.getAppByManifestURL(aManifestURL).origin
    var content = document.getElementById('content');
    var app = document.createElement('iframe');
    app.setAttribute('id', 'app');
    app.setAttribute('mozbrowser', '');
    app.setAttribute('mozapp', aManifestURL);

    // check app on load and give it a reference to us
    app.addEventListener('load', function _notifyApp() {
      var principal = SpecialPowers.getNodePrincipal(app.contentDocument);
      var status = SpecialPowers.wrap(principal).appStatus
      is(status, Ci.nsIPrincipal.APP_STATUS_CERTIFIED, "App should be certified"); 
    /*
     * We need to postMessage to give child a
     * reference to parent since mozbrowser 
     * messes with window.parent, window.top, ...
     *
     */
      app.contentWindow.postMessage(JSON.stringify({}), "*");
    });

    app.src = origin + (PACKAGE ? "" : "/" + TEST_PATH) + "/app.html"
    content.appendChild(app);
  }


  function uninstall() {
    var pending = window.navigator.mozApps.getInstalled();
    pending.onsuccess = function _onsuccess() {
      var m = this.result;
      for (var i = 0; i < m.length; i++) {
        var app = m[i];

        function _uninstall() {
          var pendingUninstall = app.uninstall();

          pendingUninstall.onsuccess = function _onsuccess() {
            ok(true, "Succesfully uninstalled");
            _cleanup();
          };

          pending.onerror = function _onerror(e) {
            ok(false, "Failed to uninstall: " + e);
            _cleanup();
          };
        };
        _uninstall();
      }
    }
  }

  function _cleanup() {
    SimpleTest.finish();
  }

  function _reallyRun() {
    addPermissions();
    var action = 'install' + (PACKAGE ? 'Package' : '');
    install(action, INSTALL_URL);
  }

  return {
    run: function _run() {
      SpecialPowers.pushPrefEnv({'set': [["dom.mozBrowserFramesEnabled", true],                                     ["dom.mozApps.dev_mode", true]]},
                                _reallyRun);
    },
    finish: function _finish() {
      uninstall();
    },
    cleanup: _cleanup,
    accept: function _accept(aId) {
      var browser = Services.wm.getMostRecentWindow("navigator:browser");
      var content = browser.getContentWindow();

      var detail = {
        type: 'webapps-install-granted',
        id: aId,
      }
      // breaking abstraction and call eventhandler directly
      browser.CustomEventManager.handleEvent({'detail': detail});
    }
  }
})();

/* this doesn't work on b2g emulator,
*  PopupNotifications is not defined
*  TODO: setup lazyGetter for PopupNotifications jsm?
*/
/*
var popupPanel = Cc["@mozilla.org/appshell/window-mediator;1"].
     getService(Ci.nsIWindowMediator).
     getMostRecentWindow("navigator:browser").
     PopupNotifications.panel;

function onPopupShown() {
  popupPanel.removeEventListener("popupshown", onPopupShown, false);
  SpecialPowers.wrap(this).childNodes[0].button.doCommand();
}

popupPanel.addEventListener("popupshown", onPopupShown, false);
*/

function chromeHandler(e) {
  if (!e || !e.detail) {
    ok(false, "missing information");
    PermTest.cleanup();
  }

  switch (e.detail.type) {
  case 'webapps-ask-install':
    PermTest.accept(e.detail.id);
  break;
  default:
  break;
  }
}

SpecialPowers.addChromeEventListener('mozChromeEvent', chromeHandler);

function _handler(e) {
  var data = JSON.parse(e.data);
  switch (data.action) {
  case 'test':
    // handle SimpleTest messages from app
    switch(data.type) {
    case 'ok':
    case 'is':
    case 'isnot':
      window[data.type].apply(this, data.args);
    break; 
    default:
      ok(false, "unrecognized test type");
    break; 
    }
  break;
  case 'done':
    PermTest.finish();
  break;
  default:
    ok(false, e.data);
    ok(false, "Unexpected error");
    PermTest.cleanup();
  break;  
  }
}

window.addEventListener('message', _handler, false);
