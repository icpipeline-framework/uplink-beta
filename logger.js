var fs = require("fs");

// export for use elsewhere
var logger = (exports.logger = {});


// individual streams to direct log events to their respective logs by type.
// NOTE the options object as second arg to fs.createWriteStream - 'a' flag is for append
// NOTE all log entries output to console at the same time
var sysLogStream = fs.createWriteStream("./log/system.log", { flags: 'a', encoding: 'utf-8'})
var errorStream = fs.createWriteStream("./log/error.log", { flags: 'a', encoding: 'utf-8'})
var debugStream = fs.createWriteStream("./log/debug.log", { flags: 'a', encoding: 'utf-8'})

scriptProcessId = process.pid ;

let currentUnixTime = Math.floor(new Date().getTime() / 1000)

// utils for writing to each log file -
// adds formatted date and newline chars as files are appended to
// NOTE log files can be deleted at any time without breakage,
// it will recreate them and pick up where it left off.
logger.processLog = function(logType, evt) {
  //if type error then print to the error log as well
  evt = scriptProcessId + " - " +evt ;
  if (logType == 'e' ) {
    logger.error (evt)
  }
  phonehomeLogEntry = logger.syslog (evt)
  console.log(evt)
  return phonehomeLogEntry ;
}
logger.syslog = function(evt) {
  var logentry = new Date().toISOString() + " : " + evt + "\n"
  sysLogStream.write(logentry)
  return logentry;
  
  //console.log(logentry)
}

logger.debug = function(evt) {
  var logentry = new Date().toISOString() + " : " + evt + "\n"
  debugStream.write(logentry)
  //console.log(logentry)
}

logger.error = function(evt) {
  var logentry = new Date().toISOString() + " : " + evt + "\n"
  errorStream.write(logentry)
  //console.log(logentry)
}