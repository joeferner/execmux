
# About

If you need to run many processes, keep an eye on them, and don't like having lots of terminal tabs open this might
be for you. `execmux` allows you to run all these processes in the same terminal window and still allow you to
interact with them and view their output.

# Install

```
npm install -g execmux
```

# Running

First you need a config file to specify what to run.

`my-project.json`

```json
{
  "commands": [
    {
      "title": "ls and exit",
      "command": ["ls", "/"]
    },
    {
      "title": "periodic output",
      "command": "./periodic-output.sh"
    },
    {
      "title": "bad process",
      "command": [
        "./missing-command.sh"
      ]
    },
    {
      "cwd": "../",
      "command": "npm run build:watch"
    }
  ]
}
```

Then run `execmux my-project.json`

Typing `?` will give you options on what you can do while things are running.
