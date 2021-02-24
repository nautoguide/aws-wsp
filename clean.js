let shell = require('shelljs');

shell.rm(['src/aws-wsp/package.json']);
shell.rm('-rf','node_modules');
shell.rm('-rf','src/aws-wsp/node_modules');