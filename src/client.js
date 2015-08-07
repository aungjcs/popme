(function($, ng, undefined) {

    var app = ng.module('nwjsApp', ['ngRoute', 'ngMessages']);
    var moment = require('moment');
    var _ = require('underscore');
    var path = require('path')
    var pop = require('./pop.js');
    var storage = require('./storage.js');
    var gui = require('nw.gui');
    var win = gui.Window.get();
    var saveAttr = ['cc', 'date', 'from', 'files', 'receiveDate', 'subject', 'to', 'uidl'];

    _.mixin(require('underscore-db'));

    $(function() {

        win.on('resize', setHeight);
        setHeight();

        //debug
        // var db = storage.load();
        // db.mails.length = 0;
        // storage.save();

        // ng.element('#MailController').scope().loadMail();
        // ng.element('#MailController').scope();
        ng.element('#MainNavController').scope().start();

        console.log('doc ready');
    });

    pop.removeAllListeners(['retr-start', 'retr-finished', 'retr-prepare', 'retr-success']);

    pop.on('retr-start', function(data) {
        console.log('retr-start', data);
    });

    pop.on('retr-finished', function(data) {
        console.log('retr-finished');
    });

    // pop.on('retr-prepare', function(data) {
    //     console.log('retr-prepare', data.uidl);
    // });

    pop.on('retr-success', function(data) {
        console.log('retr-success', data.uidl);
    });

    app.run(function() {
        //angular initialize
        storage.path = path.join(gui.App.dataPath, '/mails.json');
    });

    app.filter('mailFilter', function() {
        return function(vals) {
            var newVals = [];

            ng.forEach(vals, function(v, i) {
                !v.deleted && newVals.push(v);
            });

            return newVals;
        }
    });

    app.filter('parseNameFromAddress', function() {
        return function(val) {
            return val.indexOf('@') > 0 ? val.slice(0, val.indexOf('@')) : val;
        }
    });

    app.service('DialogService', function() {
        var el = ng.element([
            '<div class="modal fade" role="dialog">',
            '  <div class="modal-dialog" role="document">',
            '    <div class="modal-content">',
            '      <div class="modal-header">',
            '        <button type="button" class="close" data-dismiss="modal">',
            '           <span aria-hidden="true">&times;</span></button>',
            '        <h4 class="modal-title"></h4>',
            '      </div>',
            '      <div class="modal-body">',
            '      </div>',
            '      <div class="modal-footer">',
            '        <button type="button" class="btn btn-default cancel" data-dismiss="modal">Cancel</button>',
            '        <button type="button" class="btn btn-primary ok" data-dismiss="modal">OK</button>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join(''));

        var header = el.find('.modal-title');
        var body = el.find('.modal-body');
        var ok = el.find('.modal-footer button.ok');
        var cancel = el.find('.modal-footer button.cancel');
        var cb = null;

        el.on('click', 'button.ok', function($event) {
            var _cb = cb;

            cb = null;

            _cb({
                status: 'ok'
            });
        });

        el.on('hidden.bs.modal', function($event) {

            el.detach();

            if (cb) {
                cb({
                    status: 'cancel'
                });
                cb = null;
            }
        });

        this.alert = function(options) {

            cancel.hide();

            options = options || {};

            cb = options.closed || angular.noop;
            header.text(options.header || 'Alert');
            body.text(options.body || 'Alert');

            openDialog();

        }

        this.confirm = function(options) {

            cancel.show();

            options = options || {};

            cb = options.closed || angular.noop;
            header.text(options.header || 'Confirmation');
            body.text(options.body || 'Ok ?');

            openDialog();

        }

        function openDialog() {

            body.html(body.text().replace(/\n/ig, '<br>'));
            angular.element('body').append(el);
            el.modal('show');

        }
    });

    app.factory('MailFetchService', ['$rootScope', '$timeout', function($rootScope, $timeout) {

        var scope = $rootScope.$new();
        var timer;

        function listen() {
            var interval = storage.load().login.interval || 100;

            if(timer) {
                clearTimeout(timer);
            }

            timer = setTimeout(function () {

                timer = null;

                haveNewMails().then(function (result) {

                    if(result) {

                        var notification = new Notification("New mail", {
                            icon: 'img/mail.png',
                            body: 'New mail reached.'
                        });

                        notification.onclick = function () {
                            win.show();
                        }

                        $rootScope.$broadcast('fetchMail');
                    }

                    listen();
                    
                });

            }, interval * 1000);
        }

        function haveNewMails() {

            var mails = storage.load().mails;
            var reads;

            loadedUidls = _.pluck(mails, 'uidl');

            return pop.readUidls().then(function(serverUidls) {

                reads = _.filter(serverUidls.data, function(v) {

                    return v && !_.contains(loadedUidls, v);
                });

                return reads.length >= 1 ? true : false;

            });
        }

        return {
            listen: listen,
            $scope: scope
        };
    }]);

    app.controller('AttrController', ['$scope', function($scope) {
        this.name = 'AttrController';
    }])

    app.controller('MainNavController', function($rootScope, $scope, $element, $timeout, DialogService, MailFetchService) {

        var mailCount = 0;
        var readed = 0;

        $scope.greeting = 'Welcome!';
        $scope.ts = moment(new Date()).format('HH:mm:ss.SSS');
        $scope.loading = false;
        $scope.progress = 0;

        pop.on('retr-start', function(data) {

            readed = 0;
            mailCount = data.readMails;
            $scope.loading = true;
            $scope.updateProgress();
        });

        pop.on('retr-finished', function(data) {

            $scope.loading = false;
            $scope.updateProgress();
        });

        pop.on('retr-success', function(data) {

            readed = readed + 1;
            $scope.updateProgress();
        });

        $scope.$on('SettingSaved', function($event, setts) {

            var db = storage.load();
            var _setts = db.login;

            if (_setts.userId !== setts.userId || _setts.pass !== setts.pass || _setts.host !== setts.host) {

                // clear if login info has changed
                storage.clear();
            }

            db.login = setts;

            storage.save();

            $rootScope.$broadcast('fetchMail');
            MailFetchService.listen();

        });

        $scope.start = function() {

            var setts = storage.load().login;

            if (!setts.userId || !setts.pass || !setts.host) {

                $timeout(function() {
                    $scope.$broadcast('SettingDialogOpen');
                });

                return;
            }

            $rootScope.$broadcast('fetchMail');
            MailFetchService.listen();

        }

        $scope.updateProgress = function() {

            $scope.progress = calcProgress(mailCount, readed);
            $scope.$apply();

        }

        $scope.openDevtool = function() {

            if (!win.isDevToolsOpen()) {

                win.showDevTools();

            }
        }

        $scope.reloadApp = function() {

            win.reloadDev();

        }

        $scope.openSetup = function() {

            $scope.$broadcast('SettingDialogOpen');

        }

        $scope.clearAccount = function() {

            DialogService.confirm({
                closed: function(result) {

                    if (result.status !== 'ok') {
                        return;
                    }

                    storage.clear();
                    $rootScope.$broadcast('accountCleared');
                },
                header: 'アカウント削除の確認',
                body: '端末に保存されているアカウント情報とメールを全て削除します。\nよろしいですか？'
            });
        }

        $scope.refetch = function() {

            var db = storage.load();

            db.mails.length = 0;
            storage.save();
            $rootScope.$broadcast('fetchMail');

        }

        function calcProgress(cnt, cur) {
            return parseInt((cur / cnt) * 100, 10);
        }
    });

    app.controller('SettingDialogController', function($scope, $timeout, $element) {

        var settingDialog;
        var _baseSetts = {
            userId: '',
            pass: '',
            host: '',
            interval: 1
        };

        $scope.loginFailed = false;
        $scope.loginTesting = false;
        $scope.setts = {};

        angular.extend($scope.setts, _baseSetts);

        $scope.saveSetting = function() {

            var savedSetts = angular.extend({}, $scope.setts);
            $scope.loginTesting = true;
            $scope.loginFailed = false;

            pop.login(savedSetts).then(function() {

                settingDialog.modal('hide');
                angular.extend($scope.setts, _baseSetts);
                $scope.$emit('SettingSaved', savedSetts);

            }).catch(function() {

                $scope.loginFailed = true;

            }).finally(function() {
                $scope.loginTesting = false;
                $scope.$apply();
            });
        }

        $scope.$on('SettingDialogOpen', function() {

            var db = storage.load();

            $scope.setts = angular.extend({}, db.login);

            $timeout(function() {
                settingDialog.modal();
            });
        });

        $timeout(function() {

            settingDialog = $element;

            settingDialog.on('show.bs.modal', function(evt) {

            });

            settingDialog.on('hide.bs.modal', function(evt) {

            });
        });
    });

    app.controller('MailController', function($scope, $timeout, $element, DialogService) {

        $scope.mails = [];
        $scope.msgCount = 0;
        $scope.selectedItem = null;
        $scope.featching = false;

        $scope.$on('fetchMail', function($event) {
            var db = storage.load();
            var setts = db.login;

            console.log('on fetchMail');

            pop.setLogin(setts);

            $scope.fetchMail();
        });

        $scope.$on('accountCleared', function($event) {
            console.log('on accountCleared');

            $timeout(function () {
                $scope.mails.length = 0;
            });
        });

        $scope.fetchMail = function() {

            if($scope.featching) {
                console.log('featching');
                return;
            }

            var db = storage.load();

            $scope.featching = true;

            $scope.mails = storage.clone(db.mails);

            return pop.readUidls().then(function(serverUidls) {

                var reads, loadedUidls;

                loadedUidls = _.pluck(db.mails, 'uidl');

                reads = _.filter(serverUidls.data, function(v) {
                    return v && !_.contains(loadedUidls, v);
                });

                pop.readAll(reads).then(function(mails) {

                    mails.forEach(function(v) {

                        var mail = _.pick(v, saveAttr);

                        mail.ts = mail.date.getTime();

                        db.mails.push(mail);
                    });

                    storage.save();

                    $timeout(function () {
                        $scope.mails.length = 0;
                        $scope.mails = storage.clone(db.mails);
                        $scope.featching = false;
                    });
                });
            });
        }

        $scope.selected = function($event, item) {

            if (ng.element($event.target).parents().hasClass('dropdown')) {
                // cancel if click on dropdown
                return;
            }

            if ($scope.selectedItem === item) {
                return;
            }

            if ($scope.selectedItem !== null) {

                $scope.selectedItem.selectedClass = '';

            }

            $scope.selectedItem = item;
            item.selectedClass = 'active';

            $scope.$broadcast('MailSelected', item);

        }

        $scope.mailCount = function () {
            return _.filter($scope.mails, function (v) {
                return !v.deleted;
            }).length;
        }

        $scope.deleteMail = function($event, item) {
            item.deleted = true;

            var db = storage.load();
            var found = _.find(db.mails, function(v, i) {
                return item.uidl === v.uidl;
            });

            if (found) {
                found.deleted = true;
                storage.save();
            }
        }

        $scope.deleteMailFromServer = function($event, item) {

            pop.delete(item.uidl).then(function () {
                console.log('delete success');
                return 'delete ok'
            }).catch(function () {

                console.log('error', arguments);

                // DialogService.alert({
                //     header: 'メール削除失敗',
                //     body: '削除失敗が失敗しました。'
                // });

            });

        }

        $scope.openMailAction = function($event) {

        }
    });

    app.controller('MailContentController', function($scope, $timeout, $element) {

        $scope.$on('MailSelected', function(event, data) {

        })
    });

    function setHeight() {

        var maxHeight = $(window).height() - $('.mailListContainer').offset().top;

        $('.mailListContainer').height(maxHeight);
        $('.mailContentContainer').height(maxHeight);
        $('.mailContentContainer').width($(window).width() - $('.mailListContainer').width() - 20);

    }

})(jQuery, window.angular);