angular.module('dashboardApp', ['ngMaterial', 'btford.socket-io'])
  .factory('socket', function (socketFactory) {
    var result = socketFactory({
      ioSocket: io.connect('http://' + document.domain + ':' + location.port)
    });

    result.forward('error');

    return result;
  })
  .controller('DashboardController', function(socket, $scope) {
    var dashboardController = this;
    dashboardController.devices = {};
    dashboardController.lastPhotosUrls = {};

    var lastRequestId = null;

    dashboardController.hasDevices = function() {
      return !angular.equals({}, dashboardController.devices);
    };

    dashboardController.requestPictures = function() {
      socket.emit('request-picture', {}, function(requestId) {
        lastRequestId = requestId;
        dashboardController.lastPhotosUrls = {};
      });
    };

    dashboardController.requestPicture = function(client_id) {
      socket.emit('request-picture', {
        'client_id': client_id,
        'request_id': lastRequestId
      }, function(requestId) {
        if (lastRequestId != requestId) {
          lastRequestId = requestId;
          dashboardController.lastPhotosUrls = {};
        }
      });
    };

    dashboardController.removeDevice = function(clientId) {
      delete dashboardController.devices[clientId];
    };
      });
    };

    function updateDevices() {
      socket.emit('get-devices', '', function (devices) {
        var localDevices = {};

        for (var i = 0; i < devices.length; ++i) {
          var device = devices[i];

          localDevices[device.client_id] = {
            client_id: device.client_id,
            name: device.name,
            connected: true
          };
        }

        dashboardController.devices = localDevices;
      });
    }

    $scope.$on('socket:error', function (ev, data) {
      console.log("Socket error.")
      console.log(ev);
      console.log(data);
    });

    socket.on('connect', function() {
      socket.emit('register-dashboard', '');
      updateDevices();
    });

    socket.on('device-registered', function(device) {
      dashboardController.devices[device.client_id] = {
        client_id: device.client_id,
        name: device.name,
        connected: true
      };
    });

    socket.on('device-disconnected', function(device) {
      dashboardController.devices[device.client_id].connected = false;
    });

    socket.on('picture-available', function(data) {
      if (data['request_id'] === lastRequestId) {
        dashboardController.lastPhotosUrls[data['client_id']] = "data:image/jpeg;base64," + data['image'];
      }
    });
  });
