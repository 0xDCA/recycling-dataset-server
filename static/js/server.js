angular.module('dashboardApp', ['btford.socket-io'])
  .factory('socket', function (socketFactory) {
    var result = socketFactory({
      ioSocket: io.connect('http://' + document.domain + ':' + location.port)
    });

    result.forward('error');

    return result;
  })
  .controller('DashboardController', function(socket, $scope) {
    var dashboardController = this;
    dashboardController.devices = [];
    dashboardController.lastPhotosUrls = {};
    dashboardController.lastRequestDevices = [];

    var lastRequestId = null;

    dashboardController.requestPictures = function() {
      socket.emit('request-picture', '', function(requestId) {
        lastRequestId = requestId;
        dashboardController.lastPhotosUrls = {};
        dashboardController.lastRequestDevices = angular.copy(dashboardController.devices);
      });
    };

    function updateDevices() {
      socket.emit('get-devices', '', function (devices) {
        dashboardController.devices = devices;
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
      dashboardController.devices.push(device);
    });

    socket.on('device-disconnected', function(device) {
      updateDevices();
    });

    socket.on('picture-available', function(data) {
      if (data['request_id'] === lastRequestId) {
        dashboardController.lastPhotosUrls[data['client_id']] = "data:image/jpeg;base64," + data['image'];
      }
    });
  });
