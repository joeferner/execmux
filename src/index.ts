import yargs from 'yargs';
import { readConfigFile } from './config';
import { runCommands } from './runner';

const myArgs = yargs.strict().usage('Usage: $0 [options] <config-file>').help('h').alias('h', 'help');
const myArgv = myArgs.argv;

async function run() {
    try {
        if (myArgv._.length !== 1) {
            myArgs.showHelp();
            process.exit(1);
            return;
        }
        const configFile = myArgv._[0];
        const config = await readConfigFile(configFile);

        await runCommands(config);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
        return;
    }
}

run();
