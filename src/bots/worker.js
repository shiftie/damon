var currentFile = require('system').args[3];
var fs = require('fs');
var dirname = fs.absolute(currentFile).split('/');
// Needs to be loaded to be available across the lifecycle.
var utils = require('utils');
var system = require('system');
var pid = system.pid;

var opts, currentTask;

if (dirname.length > 1) {
    dirname.pop();
    dirname = dirname.join('/');
    fs.changeWorkingDirectory(dirname);
}

var casper = require('casper').create({
    clientScripts: ['./includes/start.js'],
    viewportSize: {
        width: 1024,
        height: 720
    },
    pageSettings: {
        loadImages: true,
        loadPlugins: true,
        localToRemoteUrlAccessEnabled: true,
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'
    },
    verbose: false,
    waitTimeout: 60000,
    logLevel: 'debug',
    exitOnError: false,
    // Overwrite logs to avoid having them in the console.
    onDie: function (casp, message, status) {
        log('casper died', message, status, 'ERROR');
    },
    onError: function (err, stack) {
        log('casper error', err, stack, 'ERROR');
    },
    onAlert: function (message) {
        log('casper alert', message, 'WARNING');
    },
    onStepTimeout: function _onStepTimeout(timeout, stepNum) {
        log('Maximum step execution timeout exceeded for step ' + stepNum, 'FATAL');
    },
    onTimeout: function _onTimeout(timeout) {
        log('Script timeout of ' + timeout + ' reached, exiting.', 'FATAL');
    },
    onWaitTimeout: function _onWaitTimeout(timeout) {
        log('Wait timeout of ' + timeout + ' expired, exiting.', 'FATAL');
    }
});

// removing default options passed by the Python executable
casper.cli.drop('cli');
casper.cli.drop('casper-path');

if (!casper.cli.has('tasks')) {
    casper
        .echo('worker n°' + pid + ' needs tasks... will shut down.')
        .exit();
}

try {
    opts = require(casper.cli.get('tasks'));
} catch (err) {
    console.log('No tasks found', err);
    casper.exit();
}

var tasks = opts.tasks;
var cwd = casper.cli.has('cwd') ? casper.cli.get('cwd') : dirname;
var config = opts.config;
var log = require('./log').config(casper, pid, logLevel);


var actions = require('./actions').config(casper, cwd);

// Prepare the navigation task.
var taskNavigate = {
    type: "navigate",
    params: {
        url: config.url
    }
};

taskNavigate.logId = logger.write(taskNavigate, 'TASK.START');
actions.navigate(config.url, function (err) {
    if (err) {
        log('Error Loading', err, 'FATAL');
    }
    tasks.forEach(function (task) {
        casper.then(function () {
            return actions.execute(task);
            try {
                return actions.execute(task);
            } catch (e) {
                log('Catched', e, 'FATAL');
            }
        });
    });
});

casper.on('error', function(err) {
    log('error', arguments, 'FATAL');
    logger.write(currentTask, 'TASK.FAIL');
});
casper.on('step.error', function(err) {
    log('step.error', arguments, 'FATAL');
    logger.write({ error: 'step error' }, 'TASK.ERROR');
    logger.write(currentTask, 'TASK.FAIL');
});
casper.on('step.timeout', function(err) {
    log('step.timeout', arguments, 'FATAL');
    logger.write({ error: 'timeout step' }, 'TASK.ERROR');
    logger.write(currentTask, 'TASK.FAIL');
});
casper.on('timeout', function(err) {
    log('timeout', arguments, 'FATAL');
    logger.write({ error: 'timeout' }, 'TASK.ERROR');
});
casper.on('waitFor.timeout', function(err) {
    log('waitFor.timeout', arguments, 'FATAL');
    logger.write({ error: 'timeout waitFor' }, 'TASK.ERROR');
    logger.write(currentTask, 'TASK.FAIL');
});

casper.run();
