angular.module('dashboardApp', ['ngMaterial', 'btford.socket-io'])
  .factory('socket', function (socketFactory) {
    var result = socketFactory({
      ioSocket: io.connect('http://' + document.domain + ':' + location.port)
    });

    result.forward('error');

    return result;
  })
  .controller('DashboardController', function(socket, $scope, $mdDialog) {
    var dashboardController = this;
    dashboardController.devices = {};
    dashboardController.lastPhotosUrls = {};
    dashboardController.waitingForPhoto = {};

    var lastRequestId = null;

    dashboardController.hasDevices = function() {
      return !angular.equals({}, dashboardController.devices);
    };

    dashboardController.requestPictures = function() {
      angular.forEach(dashboardController.devices, function(value, key) {
        dashboardController.waitingForPhoto[key] = true;
      });
      
      socket.emit('request-picture', {}, function(requestId) {
        lastRequestId = requestId;
        dashboardController.lastPhotosUrls = {};
      });
    };

    dashboardController.requestPicture = function(clientId) {
      dashboardController.waitingForPhoto[clientId] = true;

      socket.emit('request-picture', {
        'client_id': clientId,
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

    dashboardController.showFullSizeImage = function($event, device, image_url) {
      if (image_url == null) {
        return;
      }

      function DialogController($scope, $mdDialog, device, image_url) {
        $scope.data = {
          zoom: 100.0
        };

        $scope.device = device;
        $scope.image_url = image_url;

        $scope.closeDialog = function() {
          $mdDialog.hide();
        };
      }

      var parentElement = angular.element(document.body);
      $mdDialog.show({
       parent: parentElement,
       targetEvent: $event,
       templateUrl: 'static/full_size_image_dialog.html',
       locals: {
         device: device,
         image_url: image_url
       },
       controller: DialogController
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
        delete dashboardController.waitingForPhoto[data['client_id']];
      }
    });
  });
