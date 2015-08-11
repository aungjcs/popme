var NwBuilder = require('nw-builder');
var package = require('./src/package.json');
var os = require('os');
var platforms = [];
var nw;
var options = {};

if (os.type() === 'Windows_NT') {

    platforms.push('win32');
    platforms.push('win64');

}

options.appVersion = package.version;
options.appName    = 'nw';
options.buildDir   = './build';
options.buildType  = 'versioned';
options.files      = './src/**/**';
options.platforms  = platforms;

nw = new NwBuilder(options);

nw.on('log', console.log);

// Build returns a promise
nw.build().then(function() {
    console.log('arguments!', arguments);
    console.log('all done!');
}).catch(function(error) {
    console.error(error);
});