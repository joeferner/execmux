import { Config, ConfigCommand } from './config';
import spawn from 'cross-spawn';
import child_process, { SpawnOptionsWithoutStdio } from 'child_process';
import { COLORS } from './colors';
import colors, { Color } from 'colors';
import path from 'path';
import { Ui } from './ui';

const MAX_HISTORY_LENGTH = 100;

export interface Process extends ConfigCommand {
    color: Color;
    title: string;
    running: boolean;
    history: string[];
    process?: child_process.ChildProcess;
    promise?: Promise<void>;
    exitCode?: number;
}

export async function runCommands(config: Config): Promise<void> {
    const processes: Process[] = [];

    new Ui().startUserInterface(processes);

    let colorIndex = 0;
    for (const c of config.commands) {
        processes.push(startCommand(c, colorIndex));
        colorIndex++;
    }

    while (true) {
        const watchPromises = processes.map((p) => p.promise);
        await Promise.all(watchPromises);
        if (!hasPromisesChanged(processes, watchPromises)) {
            break;
        }
    }
    process.exit(0);
}

function hasPromisesChanged(processes: Process[], watchPromises: (Promise<void> | undefined)[]) {
    for (let i = 0; i < processes.length; i++) {
        const p = processes[i];
        if (p.promise !== watchPromises[i]) {
            return true;
        }
    }
    return false;
}

function startCommand(c: ConfigCommand, colorIndex: number): Process {
    const title = getTitle(c);
    const color = COLORS[colorIndex % COLORS.length];
    const p: Process = {
        ...c,
        color,
        title,
        running: true,
        history: [],
    };
    startCommandProcess(p);
    return p;
}

export function startCommandProcess(p: Process) {
    p.promise = new Promise((resolve) => {
        try {
            const spawnedProcess = spawnCommand(p);
            p.process = spawnedProcess;
            p.running = true;
            spawnedProcess.stdout?.on('data', (data) => {
                output(p, data);
            });
            spawnedProcess.stderr?.on('data', (data) => {
                output(p, data);
            });
            spawnedProcess.on('error', (err) => {
                p.running = false;
                console.error(`${p.color(p.title)}: ${colors.red('ERROR')}: ${err.message}`);
            });
            spawnedProcess.on('close', (code) => {
                console.error(`${p.color(p.title)}: process exited with code: ${code === null ? 'KILLED' : code}`);
                p.running = false;
                p.exitCode = code === null ? -1 : code;
                resolve();
            });
        } catch (err) {
            console.error(`${p.color(p.title)}: ${err.message}`);
        }
    });
}

function spawnCommand(command: ConfigCommand): child_process.ChildProcess {
    const options: SpawnOptionsWithoutStdio = {
        cwd: getCommandWorkingDirectory(command),
    };
    const parsedCommand = parseCommand(command.command);
    return spawn(parsedCommand[0], parsedCommand.slice(1), options);
}

function output(p: Process, data: any): void {
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
            console.log(`${p.color(p.title)}: ${line}`);
            p.history.push(line);
        }
    } else {
        console.log(`${p.color(p.title)}: ${data}`);
        p.history.push(data);
    }
    while (p.history.length > MAX_HISTORY_LENGTH) {
        p.history.shift();
    }
}

function getCommandWorkingDirectory(command: ConfigCommand): string {
    if (command.dir) {
        if (command.dir.startsWith('/')) {
            return command.dir;
        }
        return path.join(process.cwd(), command.dir);
    }
    return process.cwd();
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
