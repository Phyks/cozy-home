// Generated by CoffeeScript 1.10.0
var AppManager, ControllerClient, HttpClient, MemoryManager, async, fs, singleton,
  indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

fs = require('fs');

async = require('async');

HttpClient = require("request-json").JsonClient;

ControllerClient = require('cozy-clients').ControllerClient;

MemoryManager = require('./memory').MemoryManager;

AppManager = (function() {
  var status2XX;

  status2XX = function(res) {
    if (!res) {
      return false;
    }
    return res.statusCode / 100 === 2;
  };

  function AppManager() {
    this.proxyClient = new HttpClient("http://localhost:9104/");
    this.client = new ControllerClient({
      token: this.getAuthController()
    });
    this.memoryManager = new MemoryManager();
    this.queue = async.queue(this.processBlockingActions.bind(this), 1);
  }

  AppManager.prototype.processBlockingActions = function(action, done) {
    var app, callback, method, msg, processor;
    method = action.method, app = action.app, callback = action.callback;
    processor = this[method];
    if (processor != null) {
      return processor.call(this, app, function(err, result) {
        callback.call(null, err, result);
        return done();
      });
    } else {
      msg = "Cannot process action. Method '" + method + "' doesn't exist";
      console.log(msg);
      callback.call(null, msg);
      return done();
    }
  };

  AppManager.prototype.getAuthController = function() {
    var err, error, token;
    if (process.env.NODE_ENV === 'production') {
      try {
        token = process.env.TOKEN;
        return token;
      } catch (error) {
        err = error;
        console.log(err.message);
        console.log(err.stack);
        return null;
      }
    } else {
      return "";
    }
  };

  AppManager.prototype.checkMemory = function(callback) {
    return this.memoryManager.isEnoughMemory((function(_this) {
      return function(err, enoughMemory) {
        if (!enoughMemory) {
          if (err == null) {
            err = 'Not enough Memory';
          }
        }
        return callback.call(_this, err);
      };
    })(this));
  };

  AppManager.prototype.resetProxy = function(callback) {
    console.info("Request for proxy reseting...");
    return this.proxyClient.get("routes/reset", function(err, res, body) {
      if (!status2XX(res)) {
        if (err == null) {
          err = new Error("Something went wrong on proxy side when reseting routes");
        }
      }
      if (err) {
        console.log("Error reseting routes");
        console.log(err.message);
        console.log(err.stack);
        return callback(err);
      } else {
        console.info("Proxy successfully reseted.");
        return callback(null);
      }
    });
  };

  AppManager.prototype.installApp = function(app, callback) {
    var method;
    method = 'processInstall';
    return this.queue.push({
      method: method,
      app: app,
      callback: callback
    });
  };

  AppManager.prototype.processInstall = function(app, callback) {
    var manifest;
    manifest = app.getHaibuDescriptor();
    console.info("Request controller for spawning " + app.name + "...");
    return this.checkMemory((function(_this) {
      return function(err) {
        if (err) {
          return callback(err);
        }
        return _this.client.start(manifest, function(err, res, body) {
          if (!status2XX(res)) {
            if (err == null) {
              err = body;
            }
          }
          if (err) {
            console.log("Error spawning app: " + app.name);
            return callback(err);
          } else {
            console.info("Successfully spawned app: " + app.name);
            return callback(null, body);
          }
        });
      };
    })(this));
  };

  AppManager.prototype.updateApp = function(app, callback) {
    var method;
    method = 'processUpdate';
    return this.queue.push({
      method: method,
      app: app,
      callback: callback
    });
  };

  AppManager.prototype.processUpdate = function(app, callback) {
    var manifest;
    manifest = app.getHaibuDescriptor();
    console.info("Request controller for updating " + app.name + "...");
    return this.checkMemory((function(_this) {
      return function(err) {
        if (err) {
          return callback(err);
        }
        return _this.client.lightUpdate(manifest, function(err, res, body) {
          if (!status2XX(res)) {
            if (err == null) {
              err = new Error(body.error.message);
            }
          }
          if (err) {
            console.log("Error updating app: " + app.name);
            console.log(err.stack);
            return callback(err);
          } else {
            console.info("Successfully updated app: " + app.name);
            return callback(null, body);
          }
        });
      };
    })(this));
  };

  AppManager.prototype.changeBranch = function(app, branch, callback) {
    var method;
    method = 'processChangeBranch';
    app = [app, branch];
    return this.queue.push({
      method: method,
      app: app,
      callback: callback
    });
  };

  AppManager.prototype.processChangeBranch = function(params, callback) {
    var app, branch, manifest;
    app = params[0], branch = params[1];
    manifest = app.getHaibuDescriptor();
    console.info("Request controller for change " + app.name + " branch...");
    return this.client.changeBranch(manifest, branch, function(err, res, body) {
      if (!status2XX(res)) {
        if (err == null) {
          err = new Error(body.error.message);
        }
      }
      if (err) {
        console.log("Error change branch of app: " + app.name);
        console.log(err.stack);
        return callback(err);
      } else {
        console.info("Successfully branch change for app: " + app.name);
        return callback(null, body);
      }
    });
  };

  AppManager.prototype.uninstallApp = function(app, callback) {
    var method;
    method = 'processUninstall';
    return this.queue.push({
      method: method,
      app: app,
      callback: callback
    });
  };

  AppManager.prototype.processUninstall = function(app, callback) {
    var manifest;
    if (app != null) {
      manifest = app.getHaibuDescriptor();
      console.info("Request controller for cleaning " + app.name + "...");
      return this.client.clean(manifest, function(err, res, body) {
        var errMsg;
        if (!status2XX(res)) {
          if (err == null) {
            err = body.error;
          }
        }
        errMsg = 'application not installed';
        if ((err != null) && (err.indexOf != null) && err.indexOf(errMsg) === -1) {
          err = new Error(err);
          console.log("Error cleaning app: " + app.name);
          console.log(err.message);
          console.log(err.stack);
          return callback(err);
        } else {
          if (err) {
            console.log("[Warning] " + err);
          }
          console.info("Successfully cleaning app: " + app.name);
          return callback(null);
        }
      });
    } else {
      return callback(null);
    }
  };

  AppManager.prototype.checkAppStopped = function(app, callback) {
    return this.client.get('running', (function(_this) {
      return function(err, res, body) {
        var ref;
        if (err) {
          return callback(err);
        }
        if (ref = app.slug, indexOf.call(Object.keys(body.app), ref) >= 0) {
          return _this.client.stop(app.slug, function(err, res, body) {
            return callback(err);
          });
        } else {
          return callback();
        }
      };
    })(this));
  };

  AppManager.prototype.start = function(app, callback) {
    var manifest;
    manifest = app.getHaibuDescriptor();
    console.info("Request controller for starting " + app.name + "...");
    return this.checkAppStopped(app, (function(_this) {
      return function(err) {
        if (err != null) {
          console.log(err);
        }
        return _this.checkMemory(function(err) {
          if (err) {
            return callback(err);
          }
          return this.client.start(manifest, function(err, res, body) {
            if (!status2XX(res)) {
              if (err == null) {
                err = new Error(body.error.message);
              }
            }
            if (err) {
              console.log("Error starting app: " + app.name);
              console.log(err.message);
              console.log(err.stack);
              return callback(err);
            } else {
              console.info("Successfully starting app: " + app.name);
              return callback(null, res.body);
            }
          });
        });
      };
    })(this));
  };

  AppManager.prototype.stop = function(app, callback) {
    var manifest;
    manifest = app.getHaibuDescriptor();
    console.info("Request controller for stopping " + app.name + "...");
    return this.client.stop(app.slug, function(err, res, body) {
      if (!status2XX(res)) {
        if (err == null) {
          err = body.error;
        }
      }
      if (err && err.indexOf('application not started') === -1) {
        err = new Error(err);
        console.log("Error stopping app: " + app.name);
        console.log(err.message);
        console.log(err.stack);
        return callback(err);
      } else {
        if (err) {
          console.log("[Warning] " + err);
        }
        console.info("Successfully stopping app: " + app.name);
        return callback(null);
      }
    });
  };

  AppManager.prototype.updateStack = function(callback) {
    console.info("Request controller for updating stack...");
    return this.client.updateStack(function(err, res, body) {
      if (!status2XX(res)) {
        if (err == null) {
          err = new Error(body.error.message);
        }
      }
      if (err) {
        console.log("Error updating stack");
        console.log(err.stack);
        return callback(err);
      } else {
        console.info("Successfully updated stack");
        return callback(null, body);
      }
    });
  };

  AppManager.prototype.restartController = function(callback) {
    console.info("Request controller for restarting stack...");
    return this.client.restartController(function(err, res, body) {
      if (!status2XX(res)) {
        if (err == null) {
          err = new Error(body.error.message);
        }
      }
      if (err) {
        console.log("Error reboot stack");
        console.log(err.stack);
        return callback(err);
      } else {
        console.info("Successfully reboot stack");
        return callback(null, body);
      }
    });
  };

  return AppManager;

})();

module.exports.AppManager = AppManager;

singleton = new AppManager();

module.exports.get = function() {
  return singleton;
};
