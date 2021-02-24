"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _uuid = require("uuid");

var _magic = _interopRequireDefault(require("./magic"));

var _jsBase = require("js-base64");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/**
 * @classdesc
 *
 * AWS wsp client
 *
 * @author Richard Reynolds richard@nautoguide.com
 *
 * @example
 * let queue = new wspClient();
 */
var wspClient = /*#__PURE__*/function () {
  function wspClient() {
    _classCallCheck(this, wspClient);
  }

  _createClass(wspClient, [{
    key: "onOpen",
    value: function onOpen() {
      console.log('Open');
    }
  }, {
    key: "onClose",
    value: function onClose(event) {
      console.log(event);
    }
  }, {
    key: "onMessage",
    value: function onMessage(message) {
      console.log(message);
    }
  }, {
    key: "onError",
    value: function onError(event) {
      console.log(event);
    }
  }, {
    key: "open",
    value: function open(config) {
      var self = this;
      var options = Object.assign({
        "url": "ws://localhost"
      }, config);
      self.frames = {};
      self.socket = new WebSocket(options.url);

      self.socket.onopen = function (event) {
        self.onOpen();
      };

      self.socket.onmessage = function (event) {
        var jsonData = JSON.parse(event.data);
        /*
         * Is this part of a multi packet?
         *
         * For AWS websockets size is limited so we split packets down into frames IE:
         *
         * { frame: 1, totalFrames: 10, data: "BASE64" }
         *
         * This decodes those frames, you will need to implement the split in your AWS websocket code
         */

        if (jsonData['frame'] !== undefined) {
          //console.log(`${jsonData['uuid']} - ${jsonData['frame']} of ${jsonData['totalFrames']}`);
          if (self.frames[jsonData['uuid']] === undefined) {
            self.frames[jsonData['uuid']] = {
              "total": 0,
              data: new Array(parseInt(jsonData['totalFrames']))
            };
          }

          if (!self.frames[jsonData['uuid']].data[parseInt(jsonData['frame']) - 1]) {
            self.frames[jsonData['uuid']].data[parseInt(jsonData['frame']) - 1] = _jsBase.Base64.decode(jsonData['data']);
            self.frames[jsonData['uuid']].total++;
          } else {
            console.log("Duplicate network packet!!! ".concat(jsonData['uuid'], " - ").concat(jsonData['frame']));
          }

          if (self.frames[jsonData['uuid']].total === jsonData['totalFrames']) {
            var realJsonData = JSON.parse(self.frames[jsonData['uuid']].data.join(''));
            self.frames[jsonData['uuid']] = null;
            delete self.frames[jsonData['uuid']];
            jsonData = realJsonData;
            deployEvent();
          } else if (self.frames[jsonData['uuid']].total > jsonData['totalFrames']) {
            console.log('WARNING NETWORK CRAZY');
          }
        } else {
          /*
           * Is this a super large packet using S3?
           */
          if (jsonData['s3']) {
            fetch(jsonData['s3'], {}).then(function (response) {
              if (!response.ok) {
                self.onError(response);
              }

              return response;
            }).then(function (response) {
              return response.blob();
            }).then(function (response) {
              var reader = new FileReader();
              reader.addEventListener('loadend', function () {
                jsonData = JSON.parse(reader.result);
                deployEvent();
              });
              reader.readAsText(response);
            })["catch"](function (error) {
              self.onError(error);
            });
          } else {
            deployEvent();
          }
        }

        function deployEvent() {
          self.onMessage(jsonData);
        }
      };

      self.socket.onclose = function (event) {
        self.onClose(event);
      };

      self.socket.onerror = function (event) {
        self.onError(event);
      };
    }
  }, {
    key: "close",
    value: function close(pid, json) {
      var self = this;
      self.frames = {};
      self.socket.close();
      return true;
    }
  }, {
    key: "send",
    value: function send(json) {
      var self = this;
      self.currentPacket = 0;
      self.totalPackets = 0;
      self.packetArray = [];
      self.uuid = (0, _uuid.v4)();
      var payload = JSON.stringify(json);

      if (payload.length > _magic["default"].MAX_BYTES) {
        self.totalPackets = Math.ceil(payload.length / _magic["default"].MAX_BYTES);

        for (var i = 0; i < self.totalPackets; i++) {
          var loc = i * _magic["default"].MAX_BYTES;
          var sub = payload.slice(loc, _magic["default"].MAX_BYTES + loc);
          self.packetArray.push(sub);
        }

        self._websocketSendPacket();
      } else {
        try {
          self.socket.send(payload);
        } catch (event) {
          self.onError(event);
        }
      }
    }
  }, {
    key: "_websocketSendPacket",
    value: function _websocketSendPacket() {
      var self = this;
      /*
       * more work?
       */

      if (self.currentPacket < self.totalPackets) {
        var packet = _jsBase.Base64.encode(self.packetArray.shift());

        self.currentPacket++;

        try {
          self.socket.send(JSON.stringify({
            "frame": self.currentPacket,
            "totalFrames": self.totalPackets,
            "uuid": self.uuid,
            "data": packet
          }));
        } catch (event) {
          self.onError(event);
        }

        setTimeout(function () {
          self._websocketSendPacket();
        }, 200);
      }
    }
  }]);

  return wspClient;
}();

var _default = wspClient;
exports["default"] = _default;