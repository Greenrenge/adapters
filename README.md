`lerna link convert`
`lerna link`
`npx lerna add @kkg/captcha-packs --scope='@kkg/7stars'`

`npm run symlink` for enabling the scripts command under packages/\* folder works correctly

# Set Eslint-prettier works for any new package

please add following config in `.vscode/settings.json`

```
"eslint.workingDirectories": [
    {
      "directory": "providers/7stars", // HERE
      "!cwd": false
    }
  ]
```

# babel

add `.eslintignore` and `.bablerc` for added packages
