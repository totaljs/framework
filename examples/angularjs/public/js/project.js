angular.module('project', ['ngRoute', 'firebase']).
  value('fbURL', 'https://angularjs-projects.firebaseio.com/').
  factory('Projects', function(angularFireCollection, fbURL) {
    return angularFireCollection(fbURL);
  }).config(function($routeProvider) {
    $routeProvider.
      when('/', {controller:ListCtrl, templateUrl:'/templates/list.html'}).
      when('/edit/:projectId', {controller:EditCtrl, templateUrl:'/templates/detail.html'}).
      when('/new', {controller:CreateCtrl, templateUrl:'/templates/detail.html'}).
      otherwise({redirectTo:'/'});
  });
 
function ListCtrl($scope, Projects) {
  $scope.projects = Projects;
}
 
function CreateCtrl($scope, $location, $timeout, Projects) {
  $scope.save = function() {
    Projects.add($scope.project, function() {
      $timeout(function() { $location.path('/'); });
    });
  };
}
 
function EditCtrl($scope, $location, $routeParams, angularFire, fbURL) {
  angularFire(fbURL + $routeParams.projectId, $scope, 'remote', {}).then(function() {
    $scope.project = angular.copy($scope.remote);
    $scope.project.$id = $routeParams.projectId;
    $scope.isClean = function() {
      return angular.equals($scope.remote, $scope.project);
    };
    $scope.destroy = function() {
      $scope.remote = null;
      $location.path('/');
    };
    $scope.save = function() {
      $scope.remote = angular.copy($scope.project);
      $location.path('/');
    };
  });
}