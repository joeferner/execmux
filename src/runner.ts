import { Config, ConfigCommand } from './config';
import { ChildProcessWithoutNullStreams, spawn, SpawnOptionsWithoutStdio } from 'child_process';
import { COLORS } from './colors';
import colors, { Color } from 'colors';
import path from 'path';

interface Process extends ConfigCommand {
    process: ChildProcessWithoutNullStreams;
    color: Color;
    title: string;
    running: boolean;
    exitCode?: number;
}

export async function runCommands(config: Config): Promise<void> {
    const promises: Promise<void>[] = [];
    const processes: Process[] = [];

    let exitFocus: number = 0;
    let focusProcessIndex: number | undefined;
    let command: string = '';
    let commandMode: boolean = false;
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', (key) => {
        const s = key.toString();
        if (s === '\u0002') {
            exitFocus++;
            if (exitFocus === 2) {
                console.log('lost focus');
                focusProcessIndex = undefined;
            }
            return;
        } else {
            exitFocus = 0;
        }

        if (focusProcessIndex === undefined) {
            if (s === '\u0003') {
                console.log('terminating processes');
                for (const process of processes) {
                    process.process.kill();
                }
            } else if (commandMode) {
                if (s === '\r') {
                    process.stdout.write(key);
                    if (command === 'l' || command === 'list') {
                        printListOfProcesses(processes);
                    } else if (command[0] === 'f') {
                        const processIndex = parseInt(command.substr(1), 10);
                        if (isNaN(processIndex) || processIndex < 0 || processIndex >= processes.length) {
                            console.error(`invalid process index "${command.substr(1)}"`);
                        } else if (!processes[processIndex].running) {
                            console.error(`process not running`);
                        } else {
                            focusProcessIndex = processIndex;
                            exitFocus = 0;
                            const p = processes[processIndex];
                            console.log(`set focus to ${p.color(p.title)}`);
                        }
                    } else {
                        console.error(`invalid command "${command}"`);
                    }
                    commandMode = false;
                }
                command += s;
                process.stdout.write(key);
            } else {
                if (s === '?') {
                    console.log('l, :l, :list   - list processes');
                    console.log(':f<process>    - focus');
                    console.log('Ctrl+a, Ctrl+a - exit focus');
                } else if (s === 'l') {
                    printListOfProcesses(processes);
                } else if (s === ':') {
                    commandMode = true;
                    command = '';
                    process.stdout.write(key);
                } else {
                    process.stdout.write(key);
                }
            }
        } else {
            try {
                const p = processes[focusProcessIndex];
                if (s === '\u0003') {
                    console.error(`terminating ${p.color(p.title)}`);
                    p.process.kill();
                    focusProcessIndex = undefined;
                    return;
                }
                process.stdout.write(key);
                p.process.stdin.write(key);
            } catch (err) {
                console.error('failed', err);
            }
        }
    });

    let colorIndex = 0;
    for (const c of config.commands) {
        promises.push(
            new Promise((resolve) => {
                const title = getTitle(c);
                const color = COLORS[colorIndex % COLORS.length];
                colorIndex++;
                try {
                    const spawnedProcess = spawnCommand(c);
                    const p: Process = {
                        ...c,
                        process: spawnedProcess,
                        color,
                        title,
                        running: true,
                    };
                    spawnedProcess.stdout.on('data', (data) => {
                        output(p, console.log, data);
                    });
                    spawnedProcess.stderr.on('data', (data) => {
                        console.error(`${color(title)}: ${data}`);
                    });
                    spawnedProcess.on('error', (err) => {
                        p.running = false;
                        console.error(`${color(title)}: ${colors.red('ERROR')}: ${err.message}`);
                    });
                    spawnedProcess.on('close', (code) => {
                        console.error(`${color(title)}: process exited with code: ${code === null ? 'KILLED' : code}`);
                        p.running = false;
                        p.exitCode = code === null ? -1 : code;
                        resolve();
                    });
                    processes.push(p);
                } catch (err) {
                    console.error(`${color(title)}: ${err.message}`);
                }
            }),
        );
    }

    await Promise.all(promises);
    process.exit(0);
}

function output(p: Process, writer: (str: string) => void, data: any): void {
    if (Buffer.isBuffer(data)) {
        data = data.toString();
    }
    if (data.split && data.replace) {
        data = data.replace(/\u001bc/g, '\n');
        const lines = (data as string).split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === lines.length - 1 && line === '') {
                continue;
            }
            writer(`${p.color(p.title)}: ${line}`);
        }
    } else {
        writer(`${p.color(p.title)}: ${data}`);
    }
}

function getCommandWorkingDirectory(command: ConfigCommand): string {
    if (command.cwd) {
        if (command.cwd.startsWith('/')) {
            return command.cwd;
        }
        return path.join(process.cwd(), command.cwd);
    }
    return process.cwd();
}

function spawnCommand(command: ConfigCommand): ChildProcessWithoutNullStreams {
    const options: SpawnOptionsWithoutStdio = {
        cwd: getCommandWorkingDirectory(command),
    };
    const parsedCommand = parseCommand(command.command);
    return spawn(parsedCommand[0], parsedCommand.slice(1), options);
}

function parseCommand(command: string | string[]): string[] {
    if (Array.isArray(command)) {
        return command;
    }
    return command.split(' ');
}

function getTitle(command: ConfigCommand): string {
    if (command.title) {
        return command.title;
    }
    if (Array.isArray(command.command)) {
        return command.command.join(' ');
    }
    return command.command;
}

function printListOfProcesses(processes: Process[]) {
    for (let i = 0; i < processes.length; i++) {
        const p = processes[i];
        const command = Array.isArray(p.command) ? p.command.join(' ') : p.command;
        const status = p.running
            ? colors.green(`Running (${p.process.pid})`.padEnd(18))
            : colors.red(`Exited (code: ${p.exitCode})`.padEnd(18));
        console.log(`${i}: ${status}: ${p.color(p.title)}: ${command}`);
    }
}
