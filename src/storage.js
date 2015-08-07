'use strict';

var _ = require('underscore');
var _base = {
    login: {
        userId: '',
        pass: '',
        host: '',
        interval: 1
    },
    mails: []
};
var _db = null;
var storage = {
    path: ''
};

storage.load = function() {
    if (_db === null) {

        try {

            _db = _.load(storage.path);

        } catch (ex) {
            _db = _.extend({}, _base);
        }
    }

    return _db;
}

storage.save = function() {

    _.save(_db, storage.path);

}

storage.clear = function() {

    _.extend(_db, _base);
    _.save(_db, storage.path);

}

storage.clone = function(list) {

    var newList = [];

    if (!_.isArray(list)) {
        return list;
    }

    list.forEach(function(item) {
        newList.push(_.extend({}, item));
    });

    return newList;
}

_.mixin(require('underscore-db'));

module.exports = storage;