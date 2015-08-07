(function($, ng, undefined) {

    var Gaze = require('gaze').Gaze;
    var gaze = new Gaze('**/*');
    var gui = require('nw.gui');
    var win = gui.Window.get();
    var tray;

    gaze.on('all', function(event, filepath) {
        //win.reloadDev();
    });

    win.on('close', function () {
        this.hide();
    })

    tray = window.tray = new gui.Tray({
        icon: 'img/mail.png',
        title: 'Popme'
    });
 
    tray.tooltip = 'Popme';

    tray.on('click', function() {
        win.show();
    });

    var menu = new gui.Menu();

    menu.append(new gui.MenuItem({
        label: 'Quit',
        click: function () {
            win.close(true);
        }
    }));

    tray.menu = menu;

})(jQuery, window.angular);