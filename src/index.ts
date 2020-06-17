import yargs from 'yargs';

const myArgs = yargs.strict().usage('Usage: $0 <command> [options]').help('h').alias('h', 'help');

console.log(myArgs);
