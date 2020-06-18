import { Process, startCommandProcess } from './runner';
import colors from 'colors';

const KEY_CTRL_B = '\u0002';
const KEY_CTRL_C = '\u0003';
const KEY_BACKSPACE = 127;

export class Ui {
    exitFocusCount: number = 0;
    focusProcessIndex: number | undefined;
    command: string = '';
    commandMode: boolean = false;

    startUserInterface(processes: Process[]) {
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        stdin.on('data', (key) => {
            const s = key.toString();
            if (s === KEY_CTRL_B) {
                this.exitFocusCount++;
                if (this.exitFocusCount === 2) {
                    console.log('lost focus');
                    this.focusProcessIndex = undefined;
                }
                return;
            } else {
                this.exitFocusCount = 0;
            }

            if (this.focusProcessIndex === undefined) {
                this.handleNonFocusedInput(processes, key, s);
            } else {
                this.handleFocusedInput(processes, key, s);
            }
        });
    }

    private handleFocusedInput(processes: Process[], key: any, s: string) {
        try {
            if (this.focusProcessIndex === undefined) {
                console.error('invalid state, handleFocusedInput should only be called if focusProcessIndex is set');
                return;
            }
            const p = processes[this.focusProcessIndex];
            if (s === KEY_CTRL_C) {
                console.error(`terminating ${p.color(p.title)}`);
                p.process?.kill();
                this.focusProcessIndex = undefined;
                return;
            }
            process.stdout.write(key);
            p.process?.stdin?.write(key);
        } catch (err) {
            console.error('failed', err);
        }
    }

    private handleNonFocusedInput(processes: Process[], key: any, s: string) {
        if (s === KEY_CTRL_C) {
            console.log('terminating processes');
            for (const p of processes) {
                p.process?.kill();
            }
        } else if (this.commandMode) {
            if (key.charCodeAt(0) === KEY_BACKSPACE) {
                if (this.command.length > 0) {
                    this.command = this.command.substr(0, this.command.length - 1);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    process.stdout.write(`:${this.command}`);
                }
            } else if (s === '\r') {
                process.stdout.write('\n');
                if (this.command === 'l' || this.command === 'list') {
                    this.handleListProcessesCommand(processes);
                } else if (this.command[0] === 'f') {
                    this.handleSetFocusCommand(processes);
                } else if (this.command[0] === 'r') {
                    this.handleRestartCommand(processes);
                } else if (this.command[0] === 'k') {
                    this.handleKillCommand(processes);
                } else if (this.command[0] === 'h') {
                    this.handleHistoryCommand(processes);
                } else {
                    console.error(`invalid command "${this.command}"`);
                }
                this.commandMode = false;
            } else {
                this.command += s;
                process.stdout.write(key);
            }
        } else {
            if (s === '?') {
                this.handleHelpCommand();
            } else if (s === 'l') {
                this.handleListProcessesCommand(processes);
            } else if (s === ':') {
                this.commandMode = true;
                this.command = '';
                process.stdout.write(key);
            } else {
                process.stdout.write(key);
            }
        }
    }

    private handleHelpCommand() {
        console.log('l, :l, :list   - list processes');
        console.log(':f<process>    - focus');
        console.log(':r<process>    - restart the process');
        console.log(':k<process>    - kill the process');
        console.log(':h<process>    - shows the most recent output from the process');
        console.log('Ctrl+b, Ctrl+b - exit focus');
    }

    private handleRestartCommand(processes: Process[]) {
        const processIndex = this.getProcessIndex(processes, this.command.substr(1));
        if (processIndex !== undefined) {
            const p = processes[processIndex];
            console.log(`restarting ${p.color(p.title)}`);
            try {
                const promise = p.promise;
                if (p.running) {
                    p.process?.kill();
                }
                if (p.promise) {
                    p.promise.then(() => {
                        startCommandProcess(p);
                    });
                } else {
                    startCommandProcess(p);
                }
            } catch (err) {
                console.error(`failed to kill process: ${err.message}`);
            }
        }
    }

    private handleKillCommand(processes: Process[]) {
        const processIndex = this.getProcessIndex(processes, this.command.substr(1));
        if (processIndex !== undefined) {
            const p = processes[processIndex];
            console.log(`killing ${p.color(p.title)}`);
            try {
                if (p.running) {
                    p.process?.kill();
                }
            } catch (err) {
                console.error(`failed to kill process: ${err.message}`);
            }
        }
    }

    private handleHistoryCommand(processes: Process[]) {
        const processIndex = this.getProcessIndex(processes, this.command.substr(1), { onlyRunning: false });
        if (processIndex !== undefined) {
            const p = processes[processIndex];
            for (const line of p.history) {
                console.log(`${p.color(p.title)}: ${line}`);
            }
        }
    }

    private handleSetFocusCommand(processes: Process[]) {
        const processIndex = this.getProcessIndex(processes, this.command.substr(1));
        if (processIndex !== undefined) {
            this.focusProcessIndex = processIndex;
            this.exitFocusCount = 0;
            const p = processes[processIndex];
            console.log(`set focus to ${p.color(p.title)}`);
        }
    }

    private handleListProcessesCommand(processes: Process[]) {
        for (let i = 0; i < processes.length; i++) {
            const p = processes[i];
            const command = Array.isArray(p.command) ? p.command.join(' ') : p.command;
            const status = p.running
                ? colors.green(`Running (${p.process?.pid})`.padEnd(18))
                : colors.red(`Exited (code: ${p.exitCode})`.padEnd(18));
            console.log(`${i}: ${status}: ${p.color(p.title)}: ${command}`);
        }
    }

    private getProcessIndex(
        processes: Process[],
        str: string,
        options?: { onlyRunning?: boolean },
    ): number | undefined {
        options = {
            onlyRunning: false,
            ...(options || {}),
        };
        const processIndex = parseInt(str, 10);

        if (isNaN(processIndex) || processIndex < 0 || processIndex >= processes.length) {
            console.error(`invalid process index "${str}"`);
            return undefined;
        }

        if (options.onlyRunning && !processes[processIndex].running) {
            console.error(`process not running`);
            return undefined;
        }

        return processIndex;
    }
}
