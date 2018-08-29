angular.module("app", [])
  .controller("MainCtrl", function ($scope) {
    $scope.heading = "{{=d.heading}}";
    $scope.text = "{{=d.text}}";
  });
