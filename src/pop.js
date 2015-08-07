var Pop = function(userId, pass, host) {
    this.userId = userId;
    this.pass = pass;
    this.host = host;
    this.interval = 5;
}
var _ = require('underscore');
var async = require('async');
var Promise = require('bluebird');
var moment = require('moment');
var util = require('util');
var POP3Client = require('poplib');
var host = 'mailsv2014.japacom.co.jp';
var port = 110;
var totalmsgcount = 0;
var currentmsg = 0;
var MailParser = require('mailparser').MailParser;
var mailparser = new MailParser();
var _login = {};

util.inherits(Pop, require('events').EventEmitter);

Pop.prototype.login = function(options) {

    return this._newClient(options).then(function(client) {

        client.quit();
    });
}

Pop.prototype.setLogin = function(login) {
    _.extend(_login, login);
}

Pop.prototype.delete = function(uild) {
    var _this = this;

    return new Promise(function(resolve, reject) {

        _this._listUpUidls().then(function(result) {

            var client = result.client;
            var msgNo = _.indexOf(result.data, uild);

            if (msgNo <= 0) {
                client.quit();
                reject('msg not found:' + msgNo);
                return;
            }

            client.on("dele", function(status, msgnumber, data, rawdata) {

                client.quit();

                if (status === true) {
                    resolve();
                } else {
                    reject('delete error.')
                }
            });

            client.dele(msgNo);

        }).catch(reject);
    });
}

Pop.prototype.readAll = function(uidls) {
    var _this = this;

    return new Promise(function(resolve, reject) {

        _this._listUpUidls().then(function(result) {

            var mails = [];
            var client = result.client;
            var msgNos = result.data;
            var msgCount = result.data.length;
            var readNos = [];
            var current = '';
            var _next = null;

            if (_.isArray(uidls)) {

                _.forEach(uidls, function(v, i) {

                    var index = _.indexOf(result.data, v);

                    if (index >= 0) {

                        readNos.push({
                            msgNo: index,
                            uidl: v
                        });

                    }

                });
            } else {

                _.forEach(result.data, function(v, i) {

                    typeof v !== 'undefined' && readNos.push({
                        msgNo: i,
                        uidl: v
                    });

                });
            }

            client.on('retr', function(status, msgnumber, data, rawdata) {

                if (!status) {

                    client.quit();
                    reject('retr error');
                    return;

                }

                mailparser = new MailParser();

                mailparser.on('end', function(mail) {

                    // console.log(current.uidl, mail.subject);

                    mail.uidl = current.uidl;

                    if (mail.attachments) {

                        mail.files = [];

                        mail.attachments.forEach(function(attachment) {

                            mail.files.push(_.pick(attachment, ['fileName', 'length']));

                        });
                    }

                    mails.push(mail);

                    _this.emit('retr-success', {
                        uidl: current.uidl,
                        mail: mail
                    });

                    readMail();

                });

                mailparser.write(data);
                mailparser.end();

            });

            function readMail() {

                if (!readNos.length) {

                    _this.emit('retr-finished');

                    client.quit();
                    resolve(mails);
                    return;
                }

                current = readNos.shift();

                _this.emit('retr-prepare', {
                    uidl: current.uidl
                });

                client.retr(current.msgNo);
            }

            _this.emit('retr-start', {
                readMails: readNos.length
            });

            readMail();

        }).catch(reject);

    });
}

Pop.prototype.readUidls = function() {
    var _this = this;
    return new Promise(function(resolve, reject) {

        _this._listUpUidls().then(function(result) {

            result.client.quit();

            resolve({
                data: result.data,
                raw: result.raw
            });

        });

    });
}

Pop.prototype.list = function() {
    var _this = this;
    return new Promise(function(resolve, reject) {

        _this._listUp().then(function(result) {

            result.client.quit();

            console.log(result);

            resolve({
                data: result.data,
                raw: result.raw
            });
        });
    });
}

Pop.prototype._newClient = function(options) {

    var options = options || {};
    var _this = this;
    var setts = {
        userId: options.userId || _login.userId,
        pass: options.pass || _login.pass,
        host: options.host || _login.host
    }

    return new Promise(function(resolve, reject) {

        var client = new POP3Client(port, setts.host, {

            tlserrs: false,
            enabletls: false,
            debug: false

        });

        client.on('error', function(err) {
            reject(err);
        });

        client.on('connect', function() {
            client.login(setts.userId, setts.pass);
        });

        client.on('login', function(status) {
            if (status) {

                resolve(client);

            } else {

                reject('LOGIN/PASS failed');

            }
        });
    });
}

Pop.prototype._listUpUidls = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {

        _this._newClient().then(function(client) {

            client.on('uidl', function(status, msgnumber, data, rawdata) {

                if (!status) {

                    reject('uidl error');
                    return;

                }

                resolve({
                    client: client,
                    data: data,
                    raw: rawdata
                });
            });

            client.uidl();

        }).catch(reject);

    });
}

Pop.prototype._listUp = function() {
    var _this = this;

    return new Promise(function(resolve, reject) {

        _this._newClient().then(function(client) {

            client.on('list', function(status, msgcount, msgnumber, data, rawdata) {

                if (status === false) {

                    reject('LIST failed');

                }

                resolve({
                    client: client,
                    data: data,
                    raw: rawdata
                });
            });

            client.list();

        });
    });
}

module.exports = new Pop();