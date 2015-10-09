//stream object to read from
//timeout to wait for regexp
//split to split on (new lines)
//callback in form of err, array of strings
module.exports = function (stream, timeout, regexp, callback) {

  var buffer = '';
  var timeoutId = null;

  var handleChunk = function (data) {

    buffer += data.toString('utf8');
    // console.log("buffer", buffer);

    var found = regexp.test(buffer);
    if (found) {
      return finished(null, buffer);
    }

  };

  var finished = function (err, chunks) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    stream.removeListener('data', handleChunk);
    return callback(err, chunks);
  };

  if (timeout && timeout > 0) {
    timeoutId = setTimeout(function () {
      timeoutId = null;
      return finished(new Error('receiveData timeout after ' + timeout + 'ms'));
    }, timeout);
  }
  stream.on('data', handleChunk);
};
