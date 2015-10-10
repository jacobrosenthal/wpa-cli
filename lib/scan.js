var read = require('./read.js');
var PROMPTREGEX = require('./statics.js').PROMPTREGEX;
var RECEIVED = require('./statics.js').RECEIVED;
var OK = require('./statics.js').OK;
var debug = require('debug')('wpa-cli');

var spawn  = require('child_process').spawn;

var parseWifi = function (lines) {
  var ssids = [];
  lines.shift(); //drop header
  lines.forEach (function (line) {
    var columns = line.split('\t');

    var wifi = {
      mac: columns[0],
      frequency: columns[1],
      signal_level: columns[2],
      flags: columns[3],
      ssid: columns[4]
    }
    ssids.push(wifi);

  });
  return ssids;
};

var scan = function (callback) {

  var state = 'waiting';
  var command = spawn('wpa_cli');

  var processState = function (error, dataString) {
    if(error) {
      command.kill('SIGHUP');
      return callback(error);
    }

    var lines = dataString.split('\n');
    lines.pop(); //drop prompt
    var last = lines[lines.length-1];

    if (state === 'waiting') {
      debug('setting scan');
      command.stdin.write('scan\n');
      state = 'setting scanning';
      read(command.stdout, 10000, PROMPTREGEX, processState);
    // confirmation can get batched with received
    }else if (state === 'setting scanning') {
      if(last === OK){
        debug('scanning confirmed');
        // stay in setting scanning until we get scan results RECEIVED
        read(command.stdout, 10000, PROMPTREGEX, processState);
      }else if (last === RECEIVED){
        debug('setting scan_results');
        command.stdin.write('scan_results\n');
        state = 'setting scan_results';
        read(command.stdout, 10000, PROMPTREGEX, processState);
      }
    }else if (state === 'setting scan_results' && last.indexOf(':') >= 0) {
      debug('received scan results');
      state = 'received scan results';
      lines.shift(); //drop command echo
      var ssids = parseWifi(lines);
      command.stdin.write('quit\n');
      callback(null, ssids);
    }else {
      command.kill('SIGHUP');
      return callback(new Error('unknown return' + dataString));
    }
  };

  read(command.stdout, 10000, PROMPTREGEX, processState);
};

module.exports = scan;
