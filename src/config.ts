import Ajv, { ValidateFunction } from 'ajv';
import { promises as fs } from 'fs';
import { findFile } from './findFile';

export interface ConfigCommand {
    title?: string;
    command: string | string[];
    dir?: string;
}

export interface Config {
    commands: ConfigCommand[];
}

async function loadConfigSchema(): Promise<ValidateFunction> {
    const schema = JSON.parse(await fs.readFile(await findFile('src/config.schema.json'), 'utf8'));
    const ajv = new Ajv();
    return ajv.compile(schema);
}

export async function readConfigFile(configFile: string): Promise<Config> {
    let configFileContents: string;
    try {
        configFileContents = await fs.readFile(configFile, 'utf8');
    } catch (err) {
        throw new Error(`failed to read config file: ${err.message}`);
    }
    let configJson;
    try {
        configJson = JSON.parse(configFileContents);
    } catch (err) {
        throw new Error(`failed to parse config file as JSON: ${err.message}`);
    }
    const validate = await loadConfigSchema();
    if (!validate(configJson)) {
        if (validate.errors) {
            for (const error of validate.errors) {
                console.error(error);
            }
        }
        throw new Error('invalid config file');
    }
    return configJson as Config;
}
