var read = require('./read.js');
var PROMPTREGEX = require('./statics.js').PROMPTREGEX;
var OK = require('./statics.js').OK;
var debug = require('debug')('wpa-cli');

var spawn  = require('child_process').spawn;

var set = function (ssid, password, callback) {
  if(password.length<8) {
    return callback(new Error('password must be at least 8 characters'));
  }

  var state = 'waiting';
  var command = spawn('wpa_cli');
  var id = 0;

  var processState = function (error, dataString) {
    if(error) {
      command.kill('SIGHUP');
      return callback(error);
    }

    var lines = dataString.split('\n');
    lines.pop(); //drop prompt
    var last = lines[lines.length-1];

    if (state === 'waiting') {
      debug('add_network');
      command.stdin.write('add_network\n');
      state = 'add_network';
      read(command.stdout, 10000, PROMPTREGEX, processState);
    }else if (state === 'add_network') {
      id = last;
      debug('set_network ssid');
      state = 'set_network ssid';
      command.stdin.write('set_network ' + id + ' ssid \"' + ssid + '\"\n');
      read(command.stdout, 10000, PROMPTREGEX, processState);
    }else if (state === 'set_network ssid' && last === OK) {
      debug('set_network #' + id);
      state = 'set_network psk';
      command.stdin.write('set_network ' + id + ' psk \"' + password + '\"\n');
      read(command.stdout, 10000, PROMPTREGEX, processState);
    }else if (state === 'set_network psk' && last === OK) {
      debug('enable_network');
      state = 'enable_network';
      command.stdin.write('enable_network ' + id + '\n');
      read(command.stdout, 10000, PROMPTREGEX, processState);
    }else if (state === 'enable_network' && last === OK) {
      debug('save_config');
      state = 'save_config';
      command.stdin.write('save_config\n');
      read(command.stdout, 10000, PROMPTREGEX, processState);
    }else if (state === 'save_config' && last === OK) {
      debug('saved');
      command.kill('SIGHUP');
      return callback();
    }else {
      command.kill('SIGHUP');
      return callback(new Error('unknown return ' + dataString));
    }
  };

  read(command.stdout, 10000, PROMPTREGEX, processState);
};

module.exports = set;
